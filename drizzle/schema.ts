import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  boolean,
  datetime,
  json,
  longtext,
  date
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for obra-digital
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name"),
  username: varchar("username", { length: 100 }),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["admin", "engenheiro", "cliente", "auxiliar"]).default("engenheiro").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Obras (Construction Projects)
 */
export const obras = mysqlTable("obras", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 50 }).notNull().unique(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cliente: varchar("cliente", { length: 255 }).notNull(),
  endereco: text("endereco").notNull(),
  cidade: varchar("cidade", { length: 100 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  cep: varchar("cep", { length: 10 }).notNull(),
  enderecoEntrega: text("enderecoEntrega"),
  responsavelTecnico: varchar("responsavelTecnico", { length: 255 }).notNull(),
  crea: varchar("crea", { length: 50 }),
  dataInicio: date("dataInicio").notNull(),
  dataPrevistTermino: date("dataPrevistTermino").notNull(),
  dataTermino: date("dataTermino"),
  status: mysqlEnum("status", ["planejamento", "em_andamento", "pausada", "finalizada"]).default("planejamento").notNull(),
  valorContrato: decimal("valorContrato", { precision: 15, scale: 2 }),
  descricao: longtext("descricao"),
  capaCaminhoArmazenamento: varchar("capaCaminhoArmazenamento", { length: 500 }),
  percentualAndamento: int("percentualAndamento").default(0),
  criadoPor: int("criadoPor").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Obra = typeof obras.$inferSelect;
export type InsertObra = typeof obras.$inferInsert;

/**
 * Diários de Obra (Daily Work Logs)
 */
export const diarios = mysqlTable("diarios", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  data: date("data").notNull(),
  horarioInicio: varchar("horarioInicio", { length: 5 }),
  horarioFim: varchar("horarioFim", { length: 5 }),
  responsavel: int("responsavel").notNull(),
  clima: mysqlEnum("clima", ["ensolarado", "nublado", "chuvoso", "tempestade", "ventania"]),
  temperatura: decimal("temperatura", { precision: 5, scale: 1 }),
  umidade: int("umidade"),
  observacoesGerais: longtext("observacoesGerais"),
  assinaturaMestre: varchar("assinaturaMestre", { length: 500 }),
  assinaturaEncarregado: varchar("assinaturaEncarregado", { length: 500 }),
  assinaturaCliente: varchar("assinaturaCliente", { length: 500 }),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Diario = typeof diarios.$inferSelect;
export type InsertDiario = typeof diarios.$inferInsert;

/**
 * Atividades Executadas (Activities in Daily Log)
 */
export const atividades = mysqlTable("atividades", {
  id: int("id").autoincrement().primaryKey(),
  diarioId: int("diarioId").notNull(),
  descricao: text("descricao").notNull(),
  local: varchar("local", { length: 255 }),
  status: mysqlEnum("status", ["nao_iniciada", "em_andamento", "concluida"]).default("em_andamento"),
  percentualConcluido: int("percentualConcluido").default(0),
  prioridade: mysqlEnum("prioridade", ["baixa", "media", "alta"]).default("media"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Atividade = typeof atividades.$inferSelect;
export type InsertAtividade = typeof atividades.$inferInsert;

/**
 * Mão de Obra (Workforce)
 */
export const maoDeObra = mysqlTable("mao_de_obra", {
  id: int("id").autoincrement().primaryKey(),
  diarioId: int("diarioId").notNull(),
  funcao: mysqlEnum("funcao", [
    "servente", "pedreiro", "carpinteiro", "armador", 
    "eletricista", "encanador", "pintor", "encarregado", "engenheiro"
  ]).notNull(),
  quantidade: int("quantidade").notNull(),
  horasTrabalhadas: decimal("horasTrabalhadas", { precision: 5, scale: 2 }),
  faltas: int("faltas").default(0),
  atrasos: int("atrasos").default(0),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type MaoDeObra = typeof maoDeObra.$inferSelect;
export type InsertMaoDeObra = typeof maoDeObra.$inferInsert;

/**
 * Equipamentos Utilizados (Equipment)
 */
export const equipamentos = mysqlTable("equipamentos", {
  id: int("id").autoincrement().primaryKey(),
  diarioId: int("diarioId").notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  quantidade: int("quantidade").notNull(),
  horasUso: decimal("horasUso", { precision: 8, scale: 2 }),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Equipamento = typeof equipamentos.$inferSelect;
export type InsertEquipamento = typeof equipamentos.$inferInsert;

/**
 * Materiais Utilizados (Materials)
 */
export const materiais = mysqlTable("materiais", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  unidade: varchar("unidade", { length: 50 }).notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }),
  fornecedor: varchar("fornecedor", { length: 255 }),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Material = typeof materiais.$inferSelect;
export type InsertMaterial = typeof materiais.$inferInsert;

/**
 * Movimentação de Materiais (Material Movement - Entry/Exit)
 */
export const movimentacaoMateriais = mysqlTable("movimentacao_materiais", {
  id: int("id").autoincrement().primaryKey(),
  materialId: int("materialId").notNull(),
  diarioId: int("diarioId"),
  tipo: mysqlEnum("tipo", ["entrada", "saida"]).notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  data: date("data").notNull(),
  observacoes: text("observacoes"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type MovimentacaoMaterial = typeof movimentacaoMateriais.$inferSelect;
export type InsertMovimentacaoMaterial = typeof movimentacaoMateriais.$inferInsert;

/**
 * Ocorrências e Impedimentos (Incidents/Issues)
 */
export const ocorrencias = mysqlTable("ocorrencias", {
  id: int("id").autoincrement().primaryKey(),
  diarioId: int("diarioId").notNull(),
  tipo: mysqlEnum("tipo", [
    "atraso_material", "falta_equipe", "chuva", "problema_projeto",
    "acidente", "nao_conformidade", "interferencia", "outro"
  ]).notNull(),
  descricao: longtext("descricao").notNull(),
  criticidade: mysqlEnum("criticidade", ["baixa", "media", "alta", "critica"]).default("media"),
  responsavel: int("responsavel"),
  prazoCorracao: date("prazoCorracao"),
  status: mysqlEnum("status", ["aberta", "em_andamento", "resolvida", "cancelada"]).default("aberta"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Ocorrencia = typeof ocorrencias.$inferSelect;
export type InsertOcorrencia = typeof ocorrencias.$inferInsert;

/**
 * Equipes/Empresas (Team/Company)
 */
export const equipes = mysqlTable("equipes", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId"),
  nome: varchar("nome", { length: 255 }).notNull(),
  empresa: varchar("empresa", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  contato: varchar("contato", { length: 255 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  ativo: boolean("ativo").default(true),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Equipe = typeof equipes.$inferSelect;
export type InsertEquipe = typeof equipes.$inferInsert;

/**
 * Equipe/Colaboradores (Team Members)
 */
export const colaboradores = mysqlTable("colaboradores", {
  id: int("id").autoincrement().primaryKey(),
  equipeId: int("equipeId").notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).unique(),
  funcao: varchar("funcao", { length: 100 }).notNull(),
  dataAdmissao: date("dataAdmissao"),
  dataDemissao: date("dataDemissao"),
  ativo: boolean("ativo").default(true),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Colaborador = typeof colaboradores.$inferSelect;
export type InsertColaborador = typeof colaboradores.$inferInsert;

/**
 * Presença/Frequência (Attendance)
 */
export const presenca = mysqlTable("presenca", {
  id: int("id").autoincrement().primaryKey(),
  colaboradorId: int("colaboradorId").notNull(),
  diarioId: int("diarioId").notNull(),
  data: date("data").notNull(),
  presente: boolean("presente").default(true),
  horarioChegada: varchar("horarioChegada", { length: 5 }),
  horarioSaida: varchar("horarioSaida", { length: 5 }),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Presenca = typeof presenca.$inferSelect;
export type InsertPresenca = typeof presenca.$inferInsert;

/**
 * Fotos e Documentos (Photos and Documents)
 */
export const midia = mysqlTable("midia", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId"),
  diarioId: int("diarioId"),
  atividades: int("atividades"),
  tipo: mysqlEnum("tipo", ["foto", "documento"]).notNull(),
  descricao: text("descricao"),
  caminhoArmazenamento: varchar("caminhoArmazenamento", { length: 500 }).notNull(),
  nomeOriginal: varchar("nomeOriginal", { length: 255 }),
  tamanhoBytes: int("tamanhoBytes"),
  mimeType: varchar("mimeType", { length: 100 }),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Midia = typeof midia.$inferSelect;
export type InsertMidia = typeof midia.$inferInsert;

/**
 * Pendências/RDO (Pending Tasks/Issues)
 */
export const pendencias = mysqlTable("pendencias", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  diarioId: int("diarioId"),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: longtext("descricao"),
  tipo: mysqlEnum("tipo", ["rdo", "pendencia", "nao_conformidade"]).default("pendencia"),
  status: mysqlEnum("status", ["aberta", "em_andamento", "resolvida", "cancelada"]).default("aberta"),
  prioridade: mysqlEnum("prioridade", ["baixa", "media", "alta", "critica"]).default("media"),
  responsavel: int("responsavel"),
  dataVencimento: date("dataVencimento"),
  dataResolucao: date("dataResolucao"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Pendencia = typeof pendencias.$inferSelect;
export type InsertPendencia = typeof pendencias.$inferInsert;

/**
 * Relatórios (Reports)
 */
export const relatorios = mysqlTable("relatorios", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  tipo: mysqlEnum("tipo", ["diario", "semanal", "mensal"]).notNull(),
  dataInicio: date("dataInicio").notNull(),
  dataFim: date("dataFim").notNull(),
  conteudo: longtext("conteudo"),
  caminhoArmazenamentoPDF: varchar("caminhoArmazenamentoPDF", { length: 500 }),
  geradoPor: int("geradoPor").notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Relatorio = typeof relatorios.$inferSelect;
export type InsertRelatorio = typeof relatorios.$inferInsert;

/**
 * Acesso por Obra (Access Control per Obra)
 */
export const acessoObra = mysqlTable("acesso_obra", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  permissao: mysqlEnum("permissao", ["visualizar", "editar", "admin"]).default("visualizar").notNull(),
  ativo: boolean("ativo").default(true),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type AcessoObra = typeof acessoObra.$inferSelect;
export type InsertAcessoObra = typeof acessoObra.$inferInsert;

/**
 * Acesso do Cliente (Client Access)
 */
export const acessoCliente = mysqlTable("acesso_cliente", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  tokenAcesso: varchar("tokenAcesso", { length: 255 }).unique(),
  dataExpiracao: datetime("dataExpiracao"),
  ativo: boolean("ativo").default(true),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type AcessoCliente = typeof acessoCliente.$inferSelect;
export type InsertAcessoCliente = typeof acessoCliente.$inferInsert;

/**
 * Logs de Auditoria (Audit Logs)
 */
export const logs = mysqlTable("logs", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId"),
  acao: varchar("acao", { length: 100 }).notNull(),
  tabela: varchar("tabela", { length: 100 }),
  registroId: int("registroId"),
  dadosAntigos: json("dadosAntigos"),
  dadosNovos: json("dadosNovos"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;

/**
 * Sugestões de LLM (LLM Suggestions)
 */
export const sugestoesLLM = mysqlTable("sugestoes_llm", {
  id: int("id").autoincrement().primaryKey(),
  diarioId: int("diarioId"),
  ocorrenciaId: int("ocorrenciaId"),
  tipo: mysqlEnum("tipo", ["resumo_diario", "sugestao_ocorrencia", "analise_produtividade"]).notNull(),
  sugestao: longtext("sugestao").notNull(),
  aprovada: boolean("aprovada").default(false),
  textofinal: longtext("textoFinal"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type SugestaoLLM = typeof sugestoesLLM.$inferSelect;
export type InsertSugestaoLLM = typeof sugestoesLLM.$inferInsert;

/**
 * Orçamentos de Obra
 */
export const orcamentos = mysqlTable("orcamentos", {
  id: int("id").autoincrement().primaryKey(),
  obraId: int("obraId"),
  nome: varchar("nome", { length: 255 }).notNull(),
  clienteNome: varchar("clienteNome", { length: 255 }),
  clienteTelefone: varchar("clienteTelefone", { length: 50 }),
  clienteEmail: varchar("clienteEmail", { length: 255 }),
  obraNomeRef: varchar("obraNomeRef", { length: 255 }),
  obraEndereco: varchar("obraEndereco", { length: 500 }),
  responsavel: varchar("responsavel", { length: 255 }),
  areaM2: decimal("areaM2", { precision: 10, scale: 2 }).default("0"),
  bdiPercent: decimal("bdiPercent", { precision: 5, scale: 2 }).default("0"),
  administracaoPercent: decimal("administracaoPercent", { precision: 5, scale: 2 }).default("0"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type Orcamento = typeof orcamentos.$inferSelect;
export type InsertOrcamento = typeof orcamentos.$inferInsert;

export const orcamentoItens = mysqlTable("orcamento_itens", {
  id: int("id").autoincrement().primaryKey(),
  orcamentoId: int("orcamentoId").notNull(),
  categoria: varchar("categoria", { length: 100 }),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  unidade: varchar("unidade", { length: 20 }),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).default("0"),
  precoUnitario: decimal("precoUnitario", { precision: 12, scale: 2 }).default("0"),
  ordem: int("ordem").default(0),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type OrcamentoItem = typeof orcamentoItens.$inferSelect;
export type InsertOrcamentoItem = typeof orcamentoItens.$inferInsert;
