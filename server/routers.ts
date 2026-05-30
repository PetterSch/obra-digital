import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "./_core/llm";
import { createSessionToken } from "./_core/auth";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";

// ============= ADMIN PROCEDURE =============
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  }
  return next({ ctx });
});

// ============= ENGINEERS & ADMINS PROCEDURE =============
const engineerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "engenheiro" && ctx.user.role !== "admin") {
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
        role: z.enum(["admin", "engenheiro", "cliente"]).default("engenheiro"),
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
    listUsers: adminProcedure.query(async () => {
      const users = await db.getAllUsers();
      // Não expõe o hash de senha
      return users.map((u: any) => ({
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
        role: z.enum(["admin", "engenheiro", "cliente"]),
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
        await db.deleteUser(input.id);
        return { success: true };
      }),

    resetPassword: adminProcedure
      .input(z.object({ id: z.number(), novaSenha: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const passwordHash = await bcrypt.hash(input.novaSenha, 10);
        await db.updateUserPassword(input.id, passwordHash);
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
          data: new Date(input.data),
          responsavel: ctx.user.id,
          ...(temperatura && { temperatura: parseFloat(temperatura) as unknown as string }),
        });

        if (maoDeObra && maoDeObra.length > 0) {
          for (const item of maoDeObra) {
            for (const colaboradorId of item.operariosPresentes) {
              await db.createPresenca({
                colaboradorId,
                diarioId: diario.id,
                data: new Date(input.data),
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
        funcao: z.enum(["servente", "pedreiro", "carpinteiro", "armador", "eletricista", "encanador", "pintor", "encarregado", "engenheiro"]),
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
          data: new Date(input.data),
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
        status: z.enum(["aberta", "em_andamento", "resolvida", "cancelada"]).optional(),
        criticidade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateOcorrencia(id, data);
      }),
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
          data: new Date(input.data),
        });
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
        status: z.enum(["aberta", "em_andamento", "resolvida", "cancelada"]).optional(),
        prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
        dataResolucao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, dataResolucao, ...data } = input;
        const updateData = {
          ...data,
          ...(dataResolucao && { dataResolucao: new Date(dataResolucao) as unknown as Date }),
        };
        return db.updatePendencia(id, updateData);
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

Principais Atividades Concluídas:
${consolidacao.principaisAtividades.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Ocorrências de Alta Criticidade:
${consolidacao.principaisOcorrencias.map((o, i) => `${i + 1}. ${o}`).join("\n")}

Equipamentos Utilizados: ${consolidacao.equipamentosUtilizados.join(", ")}

Gere um resumo executivo profissional em português que:
1. Resuma o progresso geral da obra
2. Destaque as atividades principais
3. Mencione as ocorrências críticas e seu impacto
4. Forneça recomendações para o próximo período
5. Mantenha tom profissional e objetivo`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um engenheiro civil experiente gerando relatórios de obra." },
            { role: "user", content: prompt },
          ],
        });

        const resumo = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : "Erro ao gerar resumo";

        return { resumo, consolidacao };
      }),
  }),
});

export type AppRouter = typeof appRouter;
