import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";
import { CATALOGO_ORCAMENTO, CATEGORIAS_ORCAMENTO } from "./catalogo-orcamento";
import { gerarPlanejamento } from "./planejamento-gerador";
import { createSessionToken } from "./_core/auth";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";

// Usuário master: controle total, invisível e protegido contra os demais
const MASTER_USERNAME = "pedroemilio";
const isMaster = (u: any) => u?.username === MASTER_USERNAME;

// ============= ADMIN PROCEDURE =============
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

// ============= ENGINEERS & ADMINS PROCEDURE =============
const engineerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "engenheiro" && ctx.user.role !== "admin" && ctx.user.role !== "auxiliar") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a engenheiros" });
  }
  return next({ ctx });
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
      .input(z.object({ email: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        // input.email pode ser e-mail OU usuário
        const user = await db.getUserByLogin(input.email);
        if (!user || !user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário/e-mail ou senha inválidos" });
        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário/e-mail ou senha inválidos" });
        const token = await createSessionToken(user.id, user.role, user.name ?? "");
        ctx.res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: false, maxAge: ONE_YEAR_MS, path: "/" });
        await db.updateLastSignedIn(user.id);
        return { success: true, user };
      }),

    register: publicProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
        username: z.string().min(3, "Usuário deve ter ao menos 3 caracteres"),
        email: z.string().email("E-mail inválido"),
        password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
        role: z.enum(["admin", "engenheiro", "cliente", "auxiliar"]).default("engenheiro"),
      }))
      .mutation(async () => {
        // Registro público desabilitado — somente administradores criam contas
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "O cadastro é feito apenas por administradores. Entre em contato com o responsável.",
        });
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { path: "/" });
      return { success: true };
    }),
  }),

  // ============= ADMIN: GESTÃO DE USUÁRIOS =============
  admin: router({
    listUsers: adminProcedure.query(async ({ ctx }) => {
      const users = await db.getAllUsers();
      const solicitanteMaster = isMaster(ctx.user);
      // O usuário master só é visível para ele mesmo
      return users
        .filter((u: any) => solicitanteMaster || !isMaster(u))
        .map((u: any) => ({
          id: u.id, name: u.name, username: u.username,
          email: u.email, role: u.role, lastSignedIn: u.lastSignedIn,
        }));
    }),

    createUser: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "engenheiro", "cliente", "auxiliar"]),
        obraIds: z.array(z.number()).default([]),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByEmailOrUsername(input.email, input.username);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "E-mail ou usuário já cadastrado" });
        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await db.createUser({
          name: input.name, email: input.email, username: input.username,
          passwordHash, role: input.role,
        });
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário" });
        // Concede acesso às obras selecionadas (admins veem tudo, não precisa)
        if (input.role !== "admin") {
          for (const obraId of input.obraIds) {
            await db.createAcessoObra({
              obraId, usuarioId: user.id,
              permissao: input.role === "cliente" ? "visualizar" : "editar",
              ativo: true,
            });
          }
        }
        return { success: true, user: { id: user.id, name: user.name } };
      }),

    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir a si mesmo" });
        }
        const alvo = await db.getUserById(input.id);
        if (isMaster(alvo) && !isMaster(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário protegido." });
        }
        await db.deleteUser(input.id);
        return { success: true };
      }),

    resetPassword: adminProcedure
      .input(z.object({ id: z.number(), novaSenha: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const alvo = await db.getUserById(input.id);
        if (isMaster(alvo) && !isMaster(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário protegido." });
        }
        const passwordHash = await bcrypt.hash(input.novaSenha, 10);
        await db.updateUserPassword(input.id, passwordHash);
        return { success: true };
      }),

    updateUser: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        username: z.string().min(3).optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "engenheiro", "cliente", "auxiliar"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const alvo = await db.getUserById(id);
        if (isMaster(alvo) && !isMaster(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Usuário protegido." });
        }
        await db.updateUserData(id, data);
        return { success: true };
      }),

    setUserObras: adminProcedure
      .input(z.object({ usuarioId: z.number(), obraIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        // Remove acessos antigos e recria
        const atuais = await db.getUserObras(input.usuarioId);
        for (const a of atuais as any[]) {
          await db.deleteAcessoObra(a.id);
        }
        for (const obraId of input.obraIds) {
          await db.createAcessoObra({ obraId, usuarioId: input.usuarioId, permissao: "visualizar", ativo: true });
        }
        return { success: true };
      }),
  }),

  // ============= OBRAS ROUTER =============
  obras: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // Admin vê todas; demais veem apenas as obras com acesso concedido
      if (ctx.user.role === "admin") return db.getAllObras();
      return db.getObrasVisiveis(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getObraById(input.id);
      }),

    create: engineerProcedure
      .input(z.object({
        codigo: z.string().min(1),
        nome: z.string().min(1),
        cliente: z.string().min(1),
        endereco: z.string().min(1),
        cidade: z.string().min(1),
        estado: z.string().length(2),
        cep: z.string().min(1),
        enderecoEntrega: z.string().optional(),
        cidadeEntrega: z.string().optional(),
        estadoEntrega: z.string().optional(),
        cepEntrega: z.string().optional(),
        responsavelTecnico: z.string().min(1),
        crea: z.string().optional(),
        dataInicio: z.string(),
        dataPrevistTermino: z.string(),
        valorContrato: z.string().optional(),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { dataInicio, dataPrevistTermino, ...data } = input;
        return db.createObra({
          ...data,
          dataInicio: new Date(dataInicio),
          dataPrevistTermino: new Date(dataPrevistTermino),
          criadoPor: ctx.user.id,
          status: "planejamento",
          percentualAndamento: 0,
        });
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        codigo: z.string().min(1).optional(),
        nome: z.string().min(1).optional(),
        cliente: z.string().optional(),
        endereco: z.string().optional(),
        cidade: z.string().optional(),
        estado: z.string().length(2).optional(),
        cep: z.string().optional(),
        enderecoEntrega: z.string().optional(),
        cidadeEntrega: z.string().optional(),
        estadoEntrega: z.string().optional(),
        cepEntrega: z.string().optional(),
        responsavelTecnico: z.string().optional(),
        crea: z.string().optional(),
        dataInicio: z.string().optional(),
        dataPrevistTermino: z.string().optional(),
        valorContrato: z.string().optional(),
        status: z.enum(["planejamento", "em_andamento", "pausada", "finalizada"]).optional(),
        percentualAndamento: z.number().min(0).max(100).optional(),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, dataInicio, dataPrevistTermino, valorContrato, ...data } = input;
        // Converte "R$ 250.000,00" -> "250000.00"; vazio/ inválido -> null
        const parseValor = (v?: string): string | null => {
          if (v == null || v.trim() === "") return null;
          const limpo = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
          const num = parseFloat(limpo);
          return isNaN(num) ? null : num.toString();
        };
        return db.updateObra(id, {
          ...data,
          ...(valorContrato !== undefined && { valorContrato: parseValor(valorContrato) }),
          ...(dataInicio && { dataInicio: new Date(dataInicio) }),
          ...(dataPrevistTermino && { dataPrevistTermino: new Date(dataPrevistTermino) }),
        } as any);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteObra(input.id);
      }),
  }),

  // ============= DIÁRIOS ROUTER =============
  diarios: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => {
        return db.getDiariosByObraId(input.obraId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getDiarioById(input.id);
      }),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        data: z.string(),
        horarioInicio: z.string().optional(),
        horarioFim: z.string().optional(),
        clima: z.enum(["ensolarado", "nublado", "chuvoso", "tempestade", "ventania"]).optional(),
        temperatura: z.string().optional(),
        umidade: z.number().optional(),
        observacoesGerais: z.string().optional(),
        maoDeObra: z.array(z.object({
          equipeId: z.number(),
          operariosPresentes: z.array(z.number()),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { temperatura, maoDeObra, ...data } = input;
        const diario = await db.createDiario({
          ...data,
          data: new Date(input.data + "T12:00:00"),
          responsavel: ctx.user.id,
          ...(temperatura && { temperatura: parseFloat(temperatura) as unknown as string }),
        });

        if (maoDeObra && maoDeObra.length > 0) {
          for (const item of maoDeObra) {
            for (const colaboradorId of item.operariosPresentes) {
              await db.createPresenca({
                colaboradorId,
                diarioId: diario.id,
                data: new Date(input.data + "T12:00:00"),
                presente: true,
              });
            }
          }
        }

        return diario;
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        clima: z.enum(["ensolarado", "nublado", "chuvoso", "tempestade", "ventania"]).optional(),
        temperatura: z.string().optional(),
        umidade: z.number().optional(),
        observacoesGerais: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateDiario(id, data);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteDiario(input.id);
      }),
  }),

  // ============= ATIVIDADES ROUTER =============
  atividades: router({
    listByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getAtividadesByDiarioId(input.diarioId);
      }),

    create: engineerProcedure
      .input(z.object({
        diarioId: z.number(),
        descricao: z.string().min(1),
        local: z.string().optional(),
        status: z.enum(["nao_iniciada", "em_andamento", "concluida"]).optional(),
        percentualConcluido: z.number().optional(),
        prioridade: z.enum(["baixa", "media", "alta"]).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createAtividade(input);
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        descricao: z.string().min(1).optional(),
        local: z.string().optional(),
        status: z.enum(["nao_iniciada", "em_andamento", "concluida"]).optional(),
        percentualConcluido: z.number().optional(),
        prioridade: z.enum(["baixa", "media", "alta"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateAtividade(id, data);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteAtividade(input.id);
      }),
  }),

  // ============= MÃO DE OBRA ROUTER =============
  maoDeObra: router({
    listByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getMaoDeObraByDiarioId(input.diarioId);
      }),

    create: engineerProcedure
      .input(z.object({
        diarioId: z.number(),
        funcao: z.string().min(1),
        quantidade: z.number().min(1),
        horasTrabalhadas: z.string().optional(),
        faltas: z.number().optional(),
        atrasos: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createMaoDeObra(input);
      }),
  }),

  // ============= EQUIPAMENTOS ROUTER =============
  equipamentos: router({
    listByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getEquipamentosByDiarioId(input.diarioId);
      }),

    create: engineerProcedure
      .input(z.object({
        diarioId: z.number(),
        nome: z.string().min(1),
        quantidade: z.number().min(1),
        horasUso: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createEquipamento(input);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteEquipamento(input.id);
      }),
  }),

  // ============= MATERIAIS ROUTER =============
  materiais: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => {
        return db.getMaterialsByObraId(input.obraId);
      }),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        nome: z.string().min(1),
        unidade: z.string().min(1),
        quantidade: z.string().optional(),
        fornecedor: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createMaterial(input);
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        unidade: z.string().min(1).optional(),
        quantidade: z.string().optional(),
        fornecedor: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateMaterial(id, data);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteMaterial(input.id);
      }),

    addMovimentacao: engineerProcedure
      .input(z.object({
        materialId: z.number(),
        tipo: z.enum(["entrada", "saida"]),
        quantidade: z.string(),
        data: z.string(),
        diarioId: z.number().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createMovimentacao({
          ...input,
          data: new Date(input.data + "T12:00:00"),
        });
      }),
  }),

  // ============= OCORRÊNCIAS ROUTER =============
  ocorrencias: router({
    listByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getOcorrenciasByDiarioId(input.diarioId);
      }),

    create: engineerProcedure
      .input(z.object({
        diarioId: z.number(),
        tipo: z.enum(["atraso_material", "falta_equipe", "chuva", "problema_projeto", "acidente", "nao_conformidade", "interferencia", "outro"]),
        descricao: z.string().min(1),
        criticidade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
        responsavel: z.number().optional(),
        prazoCorracao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { prazoCorracao, ...data } = input;
        return db.createOcorrencia({
          ...data,
          ...(prazoCorracao && { prazoCorracao: new Date(prazoCorracao) }),
        });
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        descricao: z.string().min(1).optional(),
        tipo: z.enum(["atraso_material", "falta_equipe", "chuva", "problema_projeto", "acidente", "nao_conformidade", "interferencia", "outro"]).optional(),
        status: z.enum(["aberta", "em_andamento", "resolvida", "cancelada"]).optional(),
        criticidade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateOcorrencia(id, data);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteOcorrencia(input.id); return { success: true }; }),
  }),

  // ============= COLABORADORES ROUTER =============
  colaboradores: router({
    listByEquipe: protectedProcedure
      .input(z.object({ equipeId: z.number() }))
      .query(async ({ input }) => {
        return db.getColaboradoresByEquipeId(input.equipeId);
      }),

    create: engineerProcedure
      .input(z.object({
        equipeId: z.number(),
        nome: z.string().min(1),
        cpf: z.string().optional(),
        funcao: z.string().min(1),
        dataAdmissao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { dataAdmissao, ...data } = input;
        return db.createColaborador({
          ...data,
          ativo: true,
          ...(dataAdmissao && { dataAdmissao: new Date(dataAdmissao) as unknown as Date }),
        });
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        cpf: z.string().optional(),
        funcao: z.string().min(1).optional(),
        ativo: z.boolean().optional(),
        dataAdmissao: z.string().optional(),
        dataDemissao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, dataAdmissao, dataDemissao, ...data } = input;
        const updateData = {
          ...data,
          ...(dataAdmissao !== undefined && { dataAdmissao: dataAdmissao ? new Date(dataAdmissao) as unknown as Date : null }),
          ...(dataDemissao !== undefined && { dataDemissao: dataDemissao ? new Date(dataDemissao) as unknown as Date : null }),
        };
        return db.updateColaborador(id, updateData);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteColaborador(input.id);
      }),
  }),

  // ============= PRESENÇA ROUTER =============
  presenca: router({
    listByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getPresencaByDiarioId(input.diarioId);
      }),

    // Resumo agrupado por equipe/empresa com contagem de presentes (para PDF)
    resumoByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getMaoDeObraResumoByDiario(input.diarioId);
      }),

    create: engineerProcedure
      .input(z.object({
        colaboradorId: z.number(),
        diarioId: z.number(),
        data: z.string(),
        presente: z.boolean(),
        horarioChegada: z.string().optional(),
        horarioSaida: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createPresenca({
          ...input,
          data: new Date(input.data + "T12:00:00"),
        });
      }),

    // Substitui toda a mão de obra (presenças) de um diário de uma vez (usado na edição)
    calendario: protectedProcedure
      .input(z.object({ obraId: z.number(), ano: z.number(), mes: z.number() }))
      .query(async ({ input }) => {
        const mm = String(input.mes).padStart(2, "0");
        const inicio = `${input.ano}-${mm}-01`;
        const lastDay = new Date(input.ano, input.mes, 0).getDate();
        const fim = `${input.ano}-${mm}-${String(lastDay).padStart(2, "0")}`;
        return db.getPresencaCalendario(input.obraId, inicio, fim);
      }),

    setForDiario: engineerProcedure
      .input(z.object({
        diarioId: z.number(),
        data: z.string(),
        maoDeObra: z.array(z.object({
          equipeId: z.number(),
          operariosPresentes: z.array(z.number()),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.deletePresencaByDiario(input.diarioId);
        for (const item of input.maoDeObra) {
          for (const colaboradorId of item.operariosPresentes) {
            await db.createPresenca({
              colaboradorId,
              diarioId: input.diarioId,
              data: new Date(input.data + "T12:00:00"),
              presente: true,
            });
          }
        }
        return { success: true };
      }),
  }),

  // ============= PENDÊNCIAS ROUTER =============
  pendencias: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => {
        return db.getPendenciasByObraId(input.obraId);
      }),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        diarioId: z.number().optional(),
        titulo: z.string().min(1),
        descricao: z.string().optional(),
        tipo: z.enum(["rdo", "pendencia", "nao_conformidade"]).optional(),
        prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
        responsavel: z.number().optional(),
        dataVencimento: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { dataVencimento, ...data } = input;
        return db.createPendencia({
          ...data,
          status: "aberta",
          ...(dataVencimento && { dataVencimento: new Date(dataVencimento) as unknown as Date }),
        });
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string().min(1).optional(),
        descricao: z.string().optional(),
        status: z.enum(["aberta", "em_andamento", "resolvida", "cancelada"]).optional(),
        prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
        dataVencimento: z.string().optional(),
        dataResolucao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, dataResolucao, dataVencimento, ...data } = input;
        const updateData = {
          ...data,
          ...(dataVencimento && { dataVencimento: new Date(dataVencimento) as unknown as Date }),
          ...(dataResolucao && { dataResolucao: new Date(dataResolucao) as unknown as Date }),
        };
        return db.updatePendencia(id, updateData);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePendencia(input.id);
        return { success: true };
      }),
  }),

  // ============= MÍDIA ROUTER =============
  midia: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => {
        return db.getMidiaByObraId(input.obraId);
      }),

    listByDiario: protectedProcedure
      .input(z.object({ diarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getMidiaByDiarioId(input.diarioId);
      }),

    upload: engineerProcedure
      .input(z.object({
        obraId: z.number().optional(),
        diarioId: z.number().optional(),
        tipo: z.enum(["foto", "documento"]),
        descricao: z.string().optional(),
        arquivo: z.string(), // data URL base64 (ex: "data:image/jpeg;base64,...")
        nomeOriginal: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { arquivo, ...data } = input;
        // Armazena a imagem como data URL direto no banco (sem S3)
        return db.createMidia({
          ...data,
          caminhoArmazenamento: arquivo,
          nomeOriginal: input.nomeOriginal,
          tamanhoBytes: arquivo.length,
          mimeType: input.mimeType,
        });
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteMidia(input.id);
      }),
  }),

  // ============= RELATÓRIOS ROUTER =============
  relatorios: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => {
        return db.getRelatoriosByObraId(input.obraId);
      }),

    gerarDiario: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const diarios = await db.getDiariosByObraId(input.obraId);
        const conteudo = JSON.stringify(diarios, null, 2);
        
        return db.createRelatorio({
          obraId: input.obraId,
          dataInicio: new Date(input.dataInicio),
          dataFim: new Date(input.dataFim),
          tipo: "diario",
          conteudo,
          geradoPor: ctx.user.id,
        });
      }),
  }),

  // ============= SUGESTÕES LLM ROUTER =============
  sugestoesLLM: router({
    list: engineerProcedure
      .input(z.object({
        obraId: z.number().optional(),
        aprovada: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        return db.getSugestoesLLM(input.obraId, input.aprovada);
      }),

    getById: engineerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSugestaoLLMById(input.id);
      }),

    gerarSugestao: engineerProcedure
      .input(z.object({
        diarioId: z.number().optional(),
        ocorrenciaId: z.number().optional(),
        tipo: z.enum(["resumo_diario", "sugestao_ocorrencia", "analise_produtividade"]),
        contexto: z.string(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `Você é um assistente especializado em gestão de obras civis. 
        Gere uma sugestão profissional e detalhada para o seguinte contexto:
        
        Tipo: ${input.tipo}
        Contexto: ${input.contexto}
        
        Forneça uma resposta bem estruturada, clara e pronta para ser usada em relatórios profissionais.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um assistente especializado em gestão de obras civis e diários de obra." },
            { role: "user", content: prompt },
          ],
        });

        const content = response.choices[0]?.message?.content;
        const sugestao = typeof content === 'string' ? content : "";

        return db.createSugestaoLLM({
          diarioId: input.diarioId,
          ocorrenciaId: input.ocorrenciaId,
          tipo: input.tipo,
          sugestao,
          aprovada: false,
        });
      }),

    aprovar: engineerProcedure
      .input(z.object({
        id: z.number(),
        textoFinal: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.updateSugestaoLLM(input.id, {
          aprovada: true,
          textofinal: input.textoFinal,
        });
      }),

    rejeitar: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteSugestaoLLM(input.id);
      }),

    atualizar: engineerProcedure
      .input(z.object({
        id: z.number(),
        sugestao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateSugestaoLLM(id, data);
      }),
  }),

  // ============= EQUIPES ROUTER =============
  equipes: router({
    // Lista equipes de uma obra específica (ou todas, se obraId omitido)
    list: protectedProcedure
      .input(z.object({ obraId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getEquipes(input?.obraId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEquipeById(input.id);
      }),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number().optional(),
        nome: z.string().min(1),
        empresa: z.string().min(1),
        cnpj: z.string().optional(),
        contato: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createEquipe(input);
      }),

    update: engineerProcedure
      .input(z.object({ 
        id: z.number(),
        nome: z.string().min(1),
        empresa: z.string().min(1),
        cnpj: z.string().optional(),
        contato: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateEquipe(id, data);
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteEquipe(input.id);
      }),
  }),

  // ============= ACESSO POR OBRA ROUTER =============
  acessoObra: router({
    getByObra: adminProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => {
        return db.getObraAccessList(input.obraId);
      }),

    getByUsuario: protectedProcedure
      .input(z.object({ usuarioId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserObras(input.usuarioId);
      }),

    create: adminProcedure
      .input(z.object({
        obraId: z.number(),
        usuarioId: z.number(),
        permissao: z.enum(["visualizar", "editar", "admin"]),
      }))
      .mutation(async ({ input }) => {
        return db.createAcessoObra({
          obraId: input.obraId,
          usuarioId: input.usuarioId,
          permissao: input.permissao,
          ativo: true,
        });
      }),

    update: adminProcedure
      .input(z.object({
        acessoId: z.number(),
        permissao: z.enum(["visualizar", "editar", "admin"]).optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.updateAcessoObra(input.acessoId, {
          permissao: input.permissao,
          ativo: input.ativo,
        });
      }),

    delete: adminProcedure
      .input(z.object({ acessoId: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteAcessoObra(input.acessoId);
      }),
  }),

  // ============= ACESSO CLIENTE ROUTER =============
  acessoCliente: router({
    gerarLink: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        usuarioId: z.number(),
        diasValidade: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const token = nanoid(32);
        const dataExpiracao = new Date();
        dataExpiracao.setDate(dataExpiracao.getDate() + (input.diasValidade || 30));

        return db.createAcessoCliente({
          obraId: input.obraId,
          usuarioId: input.usuarioId,
          tokenAcesso: token,
          dataExpiracao: dataExpiracao as unknown as Date,
          ativo: true,
        });
      }),
  }),

  // ============= CONSOLIDACAO ROUTER =============
  consolidacao: router({
    getPeriodo: protectedProcedure
      .input(z.object({
        obraId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        const dataInicio = new Date(input.dataInicio);
        const dataFim = new Date(input.dataFim);
        return db.getConsolidacaoPeriodo(input.obraId, dataInicio, dataFim);
      }),

    getMidias: protectedProcedure
      .input(z.object({
        obraId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
      }))
      .query(async ({ input }) => {
        const dataInicio = new Date(input.dataInicio);
        const dataFim = new Date(input.dataFim);
        return db.getMidiasConsolidadas(input.obraId, dataInicio, dataFim);
      }),

    gerarResumoLLM: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
        tipo: z.enum(["semanal", "quinzenal", "mensal"]),
      }))
      .mutation(async ({ input }) => {
        const dataInicio = new Date(input.dataInicio);
        const dataFim = new Date(input.dataFim);
        const consolidacao = await db.getConsolidacaoPeriodo(input.obraId, dataInicio, dataFim);

        if (!consolidacao || consolidacao.totalDiarios === 0) {
          return { resumo: "Nenhum diário registrado no período." };
        }

        const prompt = `Você é um engenheiro civil experiente. Gere um resumo profissional ${input.tipo} para um diário de obra baseado nos seguintes dados:

Período: ${input.dataInicio} a ${input.dataFim}
Total de Diários: ${consolidacao.totalDiarios}
Total de Atividades: ${consolidacao.totalAtividades}
Total de Ocorrências: ${consolidacao.totalOcorrencias}
Total de Fotos: ${consolidacao.totalFotos}
Clima Predominante: ${consolidacao.climaPredominate || "Não informado"}

Média de presença por equipe (média de operários presentes por dia trabalhado):
${((consolidacao as any).presencaEquipes ?? []).map((e: any) => `- ${e.equipeNome} (${e.empresa || "-"}): média ${e.mediaPresentes} de ${e.totalColaboradores} cadastrados, em ${e.diasComPresenca} dia(s)`).join("\n") || "Sem registros de presença."}

Atividades executadas no período (todas):
${(consolidacao.principaisAtividades ?? []).map((a: string, i: number) => `${i + 1}. ${a}`).join("\n")}

Ocorrências de Alta Criticidade:
${(consolidacao.principaisOcorrencias ?? []).map((o: string, i: number) => `${i + 1}. ${o}`).join("\n")}

Equipamentos Utilizados: ${(consolidacao.equipamentosUtilizados ?? []).join(", ")}

Gere um resumo executivo profissional em português que:
1. Resuma o progresso geral da obra
2. Destaque as atividades principais
3. Mencione as ocorrências críticas e seu impacto
4. Forneça recomendações para o próximo período
5. Mantenha tom profissional e objetivo`;

        // Gera resumo a partir dos dados (sem depender de IA)
        const gerarResumoDosDados = (): string => {
          const tipoLabel = { semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal" }[input.tipo];
          const clima = consolidacao.climaPredominate || "não informado";
          const partes: string[] = [];
          partes.push(
            `Resumo ${tipoLabel} referente ao período de ${input.dataInicio} a ${input.dataFim}. ` +
            `No período foram registrados ${consolidacao.totalDiarios} diário(s) de obra, ` +
            `totalizando ${consolidacao.totalAtividades} atividade(s) e ${consolidacao.maoDeObraTotal ?? 0} presença(s) de mão de obra. ` +
            `O clima predominante foi ${clima}.`
          );
          const presEq = (consolidacao as any).presencaEquipes ?? [];
          if (presEq.length) {
            partes.push("\n\nMédia de presença por equipe:\n" +
              presEq.map((e: any) => `• ${e.equipeNome}${e.empresa ? ` (${e.empresa})` : ""}: média de ${e.mediaPresentes} de ${e.totalColaboradores} cadastrado(s), em ${e.diasComPresenca} dia(s) trabalhado(s)`).join("\n"));
          }
          if (consolidacao.principaisAtividades?.length) {
            partes.push("\n\nAtividades executadas no período:\n" +
              consolidacao.principaisAtividades.map((a: string, i: number) => `${i + 1}. ${a}`).join("\n"));
          }
          if (consolidacao.totalOcorrencias > 0) {
            partes.push(`\n\nForam registradas ${consolidacao.totalOcorrencias} ocorrência(s) no período.`);
            if (consolidacao.principaisOcorrencias?.length) {
              partes.push("\nOcorrências de maior criticidade:\n" +
                consolidacao.principaisOcorrencias.map((o: string, i: number) => `${i + 1}. ${o}`).join("\n"));
            }
          } else {
            partes.push("\n\nNenhuma ocorrência crítica foi registrada no período.");
          }
          if (consolidacao.totalFotos > 0) {
            partes.push(`\n\nForam anexadas ${consolidacao.totalFotos} foto(s) ao longo do período.`);
          }
          return partes.join("");
        };

        let resumo: string;
        if (ENV.openaiApiKey) {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "Você é um engenheiro civil experiente gerando relatórios de obra." },
              { role: "user", content: prompt },
            ],
          });
          const conteudo = response.choices[0]?.message?.content;
          // Se a IA falhar ou retornar o stub, cai no resumo dos dados
          resumo = (typeof conteudo === "string" && !conteudo.startsWith("⚠️"))
            ? conteudo
            : gerarResumoDosDados();
        } else {
          resumo = gerarResumoDosDados();
        }

        return { resumo, consolidacao };
      }),
  }),

  // ============= PLANEJAMENTO ROUTER =============
  planejamento: router({
    list: protectedProcedure.query(async () => db.getPlanejamentos()),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => db.getPlanejamentoById(input.id)),

    // Lista orçamentos para escolher na criação
    orcamentosDisponiveis: protectedProcedure.query(async () => {
      const orcs = await db.getAllOrcamentos();
      return (orcs as any[]).map(o => ({ id: o.id, nome: o.nome, obraNomeRef: o.obraNomeRef, clienteNome: o.clienteNome }));
    }),

    create: engineerProcedure
      .input(z.object({
        nome: z.string().min(1),
        dataInicio: z.string(),
        orcamentoId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        let orcamentoData = null;
        let obraId: number | null = null;
        if (input.orcamentoId) {
          const orc = await db.getOrcamentoById(input.orcamentoId);
          if (orc) {
            const itens = await db.getItensByOrcamento(input.orcamentoId);
            const itensFmt = (itens as any[]).map(i => ({
              categoria: i.categoria, descricao: i.descricao,
              quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario),
            }));
            const valorTotal = itensFmt.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)
              * (1 + Number((orc as any).bdiPercent || 0) / 100) * (1 + Number((orc as any).administracaoPercent || 0) / 100);
            orcamentoData = { nome: (orc as any).nome, itens: itensFmt, valorTotal };
            obraId = (orc as any).obraId ?? null;
          }
        }
        const dados = gerarPlanejamento({ dataInicio: input.dataInicio, orcamento: orcamentoData });
        const id = await db.createPlanejamento({
          nome: input.nome, obraId, orcamentoId: input.orcamentoId ?? null,
          dataInicio: input.dataInicio, dados,
        });
        return { id };
      }),

    updateDados: engineerProcedure
      .input(z.object({ id: z.number(), dados: z.any() }))
      .mutation(async ({ input }) => {
        await db.updatePlanejamentoDados(input.id, input.dados);
        return { success: true };
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deletePlanejamento(input.id); return { success: true }; }),
  }),

  // ============= PROTOCOLOS DE ENVIO =============
  protocolos: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => db.getProtocolosByObra(input.obraId)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => db.getProtocoloById(input.id)),

    buscar: protectedProcedure
      .input(z.object({ obraId: z.number(), termo: z.string() }))
      .query(async ({ input }) => db.buscarNotasProtocolo(input.obraId, input.termo)),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        numero: z.string().optional(),
        observacao: z.string().optional(),
        notas: z.array(z.object({
          fornecedor: z.string().optional(), ordemCompra: z.string().optional(),
          pedido: z.string().optional(), nf: z.string().optional(), valor: z.number().optional(),
          dataEnvio: z.string().optional(), venc1: z.string().optional(),
          venc2: z.string().optional(), venc3: z.string().optional(), status: z.string().optional(), condicao: z.string().optional(),
        })).default([]),
      }))
      .mutation(async ({ input, ctx }) => db.createProtocolo({ ...input, criadoPor: ctx.user.name ?? ctx.user.username ?? undefined })),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        numero: z.string().optional(),
        observacao: z.string().optional(),
        notas: z.array(z.object({
          fornecedor: z.string().optional(), ordemCompra: z.string().optional(),
          pedido: z.string().optional(), nf: z.string().optional(), valor: z.number().optional(),
          dataEnvio: z.string().optional(), venc1: z.string().optional(),
          venc2: z.string().optional(), venc3: z.string().optional(), status: z.string().optional(), condicao: z.string().optional(),
        })).default([]),
      }))
      .mutation(async ({ input }) => { const { id, ...d } = input; await db.updateProtocolo(id, d); return { success: true }; }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteProtocolo(input.id); return { success: true }; }),
  }),

  // ============= PEDIDOS DE COMPRA =============
  pedidos: router({
    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => db.getPedidosByObra(input.obraId)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => db.getPedidoById(input.id)),

    buscar: protectedProcedure
      .input(z.object({ obraId: z.number(), termo: z.string() }))
      .query(async ({ input }) => db.buscarItensPedido(input.obraId, input.termo)),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number(), numero: z.string().optional(),
        observacao: z.string().optional(), status: z.string().optional(),
        dataEntrega: z.string().optional(), localAplicacao: z.string().optional(),
        itens: z.array(z.object({
          descricao: z.string().optional(), unidade: z.string().optional(),
          quantidade: z.number().optional(), observacao: z.string().optional(),
        })).default([]),
      }))
      .mutation(async ({ input, ctx }) => db.createPedido({ ...input, solicitante: ctx.user.name ?? ctx.user.username ?? undefined })),

    update: engineerProcedure
      .input(z.object({
        id: z.number(), numero: z.string().optional(), solicitante: z.string().optional(),
        observacao: z.string().optional(), status: z.string().optional(),
        dataEntrega: z.string().optional(), localAplicacao: z.string().optional(),
        itens: z.array(z.object({
          descricao: z.string().optional(), unidade: z.string().optional(),
          quantidade: z.number().optional(), observacao: z.string().optional(),
        })).default([]),
      }))
      .mutation(async ({ input }) => { const { id, ...d } = input; await db.updatePedido(id, d); return { success: true }; }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deletePedido(input.id); return { success: true }; }),
  }),

  // ============= SUPRIMENTOS =============
  suprimentos: router({
    listPedidosAprovacao: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => db.getPedidosParaAprovacao(input.obraId)),

    aprovarItem: engineerProcedure
      .input(z.object({
        itemId: z.number(),
        statusAprovacao: z.enum(["aprovado", "reprovado", "pendente"]),
        observacaoReprovacao: z.string().optional(),
        quantidade: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.atualizarAprovacaoItem(input.itemId, input.statusAprovacao, input.observacaoReprovacao, input.quantidade);
        return { success: true };
      }),
  }),

  // ============= CADASTRO: CATEGORIAS DE INSUMOS =============
  insumoCategorias: router({
    list: protectedProcedure.query(async () => db.getInsumoCategorias()),
    create: engineerProcedure.input(z.object({ nome: z.string().min(1), sigla: z.string().optional() }))
      .mutation(async ({ input }) => db.createInsumoCategoria(input.nome, input.sigla)),
    update: engineerProcedure.input(z.object({ id: z.number(), nome: z.string().min(1), sigla: z.string().optional() }))
      .mutation(async ({ input }) => { await db.updateInsumoCategoria(input.id, input.nome, input.sigla); return { success: true }; }),
    delete: engineerProcedure.input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteInsumoCategoria(input.id); return { success: true }; }),
    seed: engineerProcedure.mutation(async () => db.seedInsumoCategorias()),
  }),

  // ============= CADASTRO: FORNECEDORES =============
  fornecedores: router({
    list: protectedProcedure.query(async () => db.getFornecedores()),
    getById: protectedProcedure.input(z.object({ id: z.number() }))
      .query(async ({ input }) => db.getFornecedorById(input.id)),
    create: engineerProcedure.input(z.object({
      nome: z.string().min(1), nomeFantasia: z.string().optional().nullable(),
      tipo: z.enum(['fisica', 'juridica']).optional(),
      cpfCnpj: z.string().optional().nullable(), inscEstadual: z.string().optional().nullable(),
      inscMunicipal: z.string().optional().nullable(), endereco: z.string().optional().nullable(),
      complemento: z.string().optional().nullable(), numero: z.string().optional().nullable(),
      bairro: z.string().optional().nullable(), cidade: z.string().optional().nullable(),
      uf: z.string().optional().nullable(), cep: z.string().optional().nullable(),
      referencia: z.string().optional().nullable(), email: z.string().optional().nullable(),
      telefone: z.string().optional().nullable(), nomeContato: z.string().optional().nullable(),
      observacao: z.string().optional().nullable(),
    })).mutation(async ({ input }) => db.createFornecedor(input)),
    update: engineerProcedure.input(z.object({
      id: z.number(), nome: z.string().min(1).optional(), nomeFantasia: z.string().optional().nullable(),
      tipo: z.enum(['fisica', 'juridica']).optional().nullable(),
      cpfCnpj: z.string().optional().nullable(), inscEstadual: z.string().optional().nullable(),
      inscMunicipal: z.string().optional().nullable(), endereco: z.string().optional().nullable(),
      complemento: z.string().optional().nullable(), numero: z.string().optional().nullable(),
      bairro: z.string().optional().nullable(), cidade: z.string().optional().nullable(),
      uf: z.string().optional().nullable(), cep: z.string().optional().nullable(),
      referencia: z.string().optional().nullable(), email: z.string().optional().nullable(),
      telefone: z.string().optional().nullable(), nomeContato: z.string().optional().nullable(),
      observacao: z.string().optional().nullable(),
    })).mutation(async ({ input }) => { const { id, ...d } = input; await db.updateFornecedor(id, d); return { success: true }; }),
    delete: engineerProcedure.input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteFornecedor(input.id); return { success: true }; }),
    seed: engineerProcedure.mutation(async () => db.seedFornecedores()),
  }),

  // ============= CADASTRO: INSUMOS =============
  insumos: router({
    list: protectedProcedure.query(async () => db.getInsumos()),
    create: engineerProcedure.input(z.object({
      categoriaId: z.number().optional(), codigo: z.string().optional(),
      nome: z.string().min(1), unidade: z.string().optional(),
    })).mutation(async ({ input }) => db.createInsumo(input)),
    update: engineerProcedure.input(z.object({
      id: z.number(), categoriaId: z.number().optional(), codigo: z.string().optional(),
      nome: z.string().min(1).optional(), unidade: z.string().optional(), ativo: z.boolean().optional(),
    })).mutation(async ({ input }) => { const { id, ...d } = input; await db.updateInsumo(id, d); return { success: true }; }),
    delete: engineerProcedure.input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteInsumo(input.id); return { success: true }; }),
  }),

  // ============= CONFIG DA EMPRESA (compartilhada) =============
  empresa: router({
    // Todos os usuários autenticados leem (para usar nos PDFs)
    get: protectedProcedure.query(async () => {
      return db.getEmpresaConfig();
    }),
    // Apenas administradores editam
    update: adminProcedure
      .input(z.object({ config: z.any() }))
      .mutation(async ({ input }) => {
        await db.setEmpresaConfig(input.config);
        return { success: true };
      }),
  }),

  // ============= ORÇAMENTOS ROUTER =============
  orcamentos: router({
    // Catálogo base de serviços
    catalogo: protectedProcedure.query(() => {
      return { itens: CATALOGO_ORCAMENTO, categorias: CATEGORIAS_ORCAMENTO };
    }),

    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => db.getOrcamentosByObra(input.obraId)),

    // Lista todos os orçamentos (módulo independente)
    list: protectedProcedure.query(async () => db.getAllOrcamentos()),

    // Retorna orçamento + itens + totais calculados
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const orcamento = await db.getOrcamentoById(input.id);
        if (!orcamento) return null;
        const itens = await db.getItensByOrcamento(input.id);

        const custoDirecto = itens.reduce(
          (s: number, i: any) => s + Number(i.quantidade || 0) * Number(i.precoUnitario || 0), 0);
        const bdi = Number(orcamento.bdiPercent || 0);
        const adm = Number(orcamento.administracaoPercent || 0);
        const area = Number(orcamento.areaM2 || 0);

        const valorComBdi = custoDirecto * (1 + bdi / 100);
        const valorAdministracao = valorComBdi * (adm / 100);
        const valorTotal = valorComBdi + valorAdministracao;

        const custoM2SemAdm = area > 0 ? valorComBdi / area : 0;
        const custoM2ComAdm = area > 0 ? valorTotal / area : 0;

        return {
          orcamento,
          itens,
          totais: {
            custoDirecto,
            bdi, valorBdi: valorComBdi - custoDirecto, valorComBdi,
            adm, valorAdministracao,
            valorTotal,
            area,
            custoM2SemAdm,
            custoM2ComAdm,
          },
        };
      }),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number().optional(),
        nome: z.string().min(1),
        clienteNome: z.string().optional(),
        clienteTelefone: z.string().optional(),
        clienteEmail: z.string().optional(),
        obraNomeRef: z.string().optional(),
        obraEndereco: z.string().optional(),
        responsavel: z.string().optional(),
        areaM2: z.number().optional(),
        itens: z.array(z.object({
          categoria: z.string().optional(),
          descricao: z.string(),
          unidade: z.string().optional(),
          quantidade: z.number().optional(),
          precoUnitario: z.number().optional(),
        })).default([]),
      }))
      .mutation(async ({ input }) => {
        const orcamento = await db.createOrcamento({
          obraId: input.obraId ?? null,
          nome: input.nome,
          clienteNome: input.clienteNome ?? null,
          clienteTelefone: input.clienteTelefone ?? null,
          clienteEmail: input.clienteEmail ?? null,
          obraNomeRef: input.obraNomeRef ?? null,
          obraEndereco: input.obraEndereco ?? null,
          responsavel: input.responsavel ?? null,
          areaM2: (input.areaM2 ?? 0).toString(),
          bdiPercent: "0",
          administracaoPercent: "0",
        } as any);
        if (input.itens.length > 0) {
          await db.createOrcamentoItensBatch(input.itens.map((it, idx) => ({
            orcamentoId: orcamento.id,
            categoria: it.categoria ?? null,
            descricao: it.descricao,
            unidade: it.unidade ?? null,
            quantidade: (it.quantidade ?? 0).toString(),
            precoUnitario: (it.precoUnitario ?? 0).toString(),
            ordem: idx,
          })) as any);
        }
        return orcamento;
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().optional(),
        clienteNome: z.string().optional(),
        clienteTelefone: z.string().optional(),
        clienteEmail: z.string().optional(),
        obraNomeRef: z.string().optional(),
        obraEndereco: z.string().optional(),
        responsavel: z.string().optional(),
        areaM2: z.number().optional(),
        bdiPercent: z.number().optional(),
        administracaoPercent: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...d } = input;
        await db.updateOrcamento(id, {
          ...(d.nome !== undefined && { nome: d.nome }),
          ...(d.clienteNome !== undefined && { clienteNome: d.clienteNome }),
          ...(d.clienteTelefone !== undefined && { clienteTelefone: d.clienteTelefone }),
          ...(d.clienteEmail !== undefined && { clienteEmail: d.clienteEmail }),
          ...(d.obraNomeRef !== undefined && { obraNomeRef: d.obraNomeRef }),
          ...(d.obraEndereco !== undefined && { obraEndereco: d.obraEndereco }),
          ...(d.responsavel !== undefined && { responsavel: d.responsavel }),
          ...(d.areaM2 !== undefined && { areaM2: d.areaM2.toString() }),
          ...(d.bdiPercent !== undefined && { bdiPercent: d.bdiPercent.toString() }),
          ...(d.administracaoPercent !== undefined && { administracaoPercent: d.administracaoPercent.toString() }),
        } as any);
        return { success: true };
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteOrcamento(input.id); return { success: true }; }),

    addItem: engineerProcedure
      .input(z.object({
        orcamentoId: z.number(),
        categoria: z.string().optional(),
        descricao: z.string().min(1),
        unidade: z.string().optional(),
        quantidade: z.number().optional(),
        precoUnitario: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createOrcamentoItem({
          orcamentoId: input.orcamentoId,
          categoria: input.categoria ?? null,
          descricao: input.descricao,
          unidade: input.unidade ?? null,
          quantidade: (input.quantidade ?? 0).toString(),
          precoUnitario: (input.precoUnitario ?? 0).toString(),
          ordem: 999,
        } as any);
        return { success: true };
      }),

    updateItem: engineerProcedure
      .input(z.object({
        id: z.number(),
        descricao: z.string().optional(),
        unidade: z.string().optional(),
        quantidade: z.number().optional(),
        precoUnitario: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...d } = input;
        await db.updateOrcamentoItem(id, {
          ...(d.descricao !== undefined && { descricao: d.descricao }),
          ...(d.unidade !== undefined && { unidade: d.unidade }),
          ...(d.quantidade !== undefined && { quantidade: d.quantidade.toString() }),
          ...(d.precoUnitario !== undefined && { precoUnitario: d.precoUnitario.toString() }),
        });
        return { success: true };
      }),

    deleteItem: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await db.deleteOrcamentoItem(input.id); return { success: true }; }),
  }),

  // ============= MAPA DE COTAÇÃO =============
  mapaCotacao: router({
    listAll: protectedProcedure
      .query(async () => db.getAllMapas()),

    listByObra: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => db.getMapasByObra(input.obraId)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => db.getMapaById(input.id)),

    getItensAprovados: protectedProcedure
      .input(z.object({ obraId: z.number() }))
      .query(async ({ input }) => db.getItensAprovadosByObra(input.obraId)),

    create: engineerProcedure
      .input(z.object({
        obraId: z.number(),
        titulo: z.string().optional(),
        localAplicacao: z.string().optional(),
        dataAplicacao: z.string().optional(),
        itens: z.array(z.object({
          pedidoItemId: z.number().optional(),
          descricao: z.string(),
          unidade: z.string().optional(),
          quantidade: z.number().optional(),
          observacao: z.string().optional(),
          dataEntrega: z.string().optional(),
        })).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createMapa({ ...input, criadoPor: (ctx.user as any).name ?? (ctx.user as any).username });
      }),

    update: engineerProcedure
      .input(z.object({
        id: z.number(),
        titulo: z.string().optional(),
        localAplicacao: z.string().optional(),
        dataAplicacao: z.string().optional(),
        observacao: z.string().optional(),
        status: z.string().optional(),
        fornecedores: z.array(z.object({
          id: z.number(),
          nome: z.string().optional(),
          contato: z.string().optional(),
          telefone: z.string().optional(),
          desconto: z.number().optional(),
          frete: z.number().optional(),
          condicaoPagamento: z.string().optional(),
        })).optional(),
        itens: z.array(z.object({
          pedidoItemId: z.number().optional(),
          descricao: z.string(),
          unidade: z.string().optional(),
          quantidade: z.number().optional(),
          observacao: z.string().optional(),
          dataEntrega: z.string().optional(),
        })).optional(),
        cotacoes: z.array(z.object({
          itemIndex: z.number(),
          fornecedorId: z.number(),
          valorUnitario: z.number(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...d } = input;
        await db.updateMapa(id, d);
        return { success: true };
      }),

    addFornecedor: engineerProcedure
      .input(z.object({ mapaId: z.number() }))
      .mutation(async ({ input }) => db.addMapaFornecedor(input.mapaId)),

    removeFornecedor: engineerProcedure
      .input(z.object({ fornecedorId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeMapaFornecedor(input.fornecedorId);
        return { success: true };
      }),

    delete: engineerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteMapa(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
