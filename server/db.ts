import { eq, and, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  users,
  obras,
  diarios,
  atividades,
  maoDeObra,
  equipamentos,
  materiais,
  movimentacaoMateriais,
  ocorrencias,
  colaboradores,
  equipes,
  presenca,
  midia,
  pendencias,
  relatorios,
  acessoCliente,
  acessoObra,
  sugestoesLLM,
  orcamentos,
  orcamentoItens
} from "../drizzle/schema";
import * as demo from "./demo-store";
import { agruparItensPorFornecedor, proximoNumeroOC, type ItemSelecionadoOC } from "@shared/ordensCompra";

let _db: ReturnType<typeof drizzle> | null = null;

// Fallback: usado quando o Railway não injeta as variáveis no runtime.
// TODO: após confirmar funcionamento, rotacionar a senha do banco no Railway.
const FALLBACK_MYSQL =
  "mysql://root:RkVIIxZfszjZcyUQkbBkzdMhYIcdfZTp@" +
  "zephyr.proxy.rlwy.net:13889/railway";

// Aceita MYSQL_URL ou DATABASE_URL (Railway usa DATABASE_URL)
function getConnectionString(): string | undefined {
  return process.env.MYSQL_URL || process.env.DATABASE_URL || FALLBACK_MYSQL;
}

// Adiciona SSL na URL para Railway production
function buildDatabaseUrl(url: string): string {
  if (process.env.NODE_ENV === "production" && !url.includes("ssl")) {
    const separator = url.includes("?") ? "&" : "?";
    return url + separator + "ssl={\"rejectUnauthorized\":false}";
  }
  return url;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  const conn = getConnectionString();
  if (!_db && conn) {
    console.log("[DB] String de conexão encontrada, conectando ao MySQL...");
    try {
      const url = buildDatabaseUrl(conn);
      _db = drizzle(url);
      console.log("[DB] Conectado ao MySQL com sucesso!");
    } catch (error) {
      console.error("[DB] Erro ao conectar:", error);
      _db = null;
    }
  } else if (!conn) {
    console.log("[DB] Nenhuma string de conexão definida - modo demo ativo");
  }
  return _db;
}

// Aplica as migrations existentes em drizzle/*.sql automaticamente no boot.
// Não trava (não é interativo) e é seguro rodar várias vezes.
export async function runMigrations() {
  const conn = getConnectionString();
  if (!conn) {
    console.log("[Migrate] Sem banco - pulando migrations");
    return;
  }
  try {
    const { migrate } = await import("drizzle-orm/mysql2/migrator");
    const db = await getDb();
    if (!db) return;
    console.log("[Migrate] Aplicando migrations...");
    await migrate(db as any, { migrationsFolder: "./drizzle" });
    console.log("[Migrate] Migrations aplicadas com sucesso!");
  } catch (error) {
    console.error("[Migrate] Erro ao aplicar migrations (pode já estar aplicado):", error);
  }

  // Garante a coluna username (adiciona se ainda não existir)
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`ALTER TABLE users ADD COLUMN username VARCHAR(100)`);
      console.log("[Migrate] Coluna username adicionada");
    }
  } catch {
    // Coluna já existe — ok, ignora
  }

  // Converte funcao de ENUM para VARCHAR (permite funções personalizadas)
  for (const tabela of ["colaboradores", "mao_de_obra"]) {
    try {
      const db = await getDb();
      if (db) {
        await db.execute(sql.raw(`ALTER TABLE ${tabela} MODIFY funcao VARCHAR(100) NOT NULL`));
        console.log(`[Migrate] Coluna funcao de ${tabela} convertida para VARCHAR`);
      }
    } catch (e) {
      // Já convertido ou tabela não tem a coluna — ignora
    }
  }

  // Amplia caminhoArmazenamento para guardar imagens base64
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`ALTER TABLE midia MODIFY caminhoArmazenamento LONGTEXT NOT NULL`);
      console.log("[Migrate] midia.caminhoArmazenamento ampliado para LONGTEXT");
    }
  } catch {
    // Já aplicado — ignora
  }

  // Vincula equipes a obras
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`ALTER TABLE equipes ADD COLUMN obraId INT`);
      console.log("[Migrate] Coluna obraId adicionada em equipes");
    }
  } catch {
    // Já aplicado — ignora
  }

  // Tabelas de orçamento
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS orcamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        obraId INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        areaM2 DECIMAL(10,2) DEFAULT 0,
        bdiPercent DECIMAL(5,2) DEFAULT 0,
        administracaoPercent DECIMAL(5,2) DEFAULT 0,
        criadoEm TIMESTAMP DEFAULT NOW(),
        atualizadoEm TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS orcamento_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orcamentoId INT NOT NULL,
        categoria VARCHAR(100),
        descricao VARCHAR(500) NOT NULL,
        unidade VARCHAR(20),
        quantidade DECIMAL(12,3) DEFAULT 0,
        precoUnitario DECIMAL(12,2) DEFAULT 0,
        ordem INT DEFAULT 0,
        criadoEm TIMESTAMP DEFAULT NOW()
      )`);
      console.log("[Migrate] Tabelas de orçamento garantidas");
    }
  } catch {
    // Já existem — ignora
  }

  // orcamentos.obraId aceita NULL (orçamento independente de obra)
  try {
    const db = await getDb();
    if (db) await db.execute(sql`ALTER TABLE orcamentos MODIFY obraId INT NULL`);
  } catch { /* já aplicado */ }

  // Adiciona perfil "auxiliar" ao enum de role
  try {
    const db = await getDb();
    if (db) await db.execute(sql`ALTER TABLE users MODIFY COLUMN role ENUM('admin','engenheiro','cliente','auxiliar') NOT NULL DEFAULT 'engenheiro'`);
  } catch { /* já aplicado */ }

  // Tabela de config da empresa (compartilhada entre usuários)
  try {
    const db = await getDb();
    if (db) await db.execute(sql`CREATE TABLE IF NOT EXISTS empresa_config (
      id INT PRIMARY KEY, dados LONGTEXT, atualizadoEm TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
    )`);
  } catch { /* já existe */ }

  // CNO — Cadastro Nacional de Obras (adiciona se ainda não existir)
  try {
    const db = await getDb();
    if (db) await db.execute(sql`ALTER TABLE obras ADD COLUMN cno VARCHAR(30)`);
  } catch { /* já existe */ }

  // Endereço de entrega da obra (adiciona se ainda não existir)
  for (const col of [
    "enderecoEntrega TEXT", "cidadeEntrega VARCHAR(100)",
    "estadoEntrega VARCHAR(2)", "cepEntrega VARCHAR(10)",
  ]) {
    try {
      const db = await getDb();
      if (db) await db.execute(sql.raw(`ALTER TABLE obras ADD COLUMN ${col}`));
    } catch { /* já existe */ }
  }

  // Tabela de planejamentos
  try {
    const db = await getDb();
    if (db) await db.execute(sql`CREATE TABLE IF NOT EXISTS planejamentos (
      id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(255) NOT NULL,
      obraId INT, orcamentoId INT, dataInicio DATE, dados LONGTEXT,
      criadoEm TIMESTAMP DEFAULT NOW(), atualizadoEm TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
    )`);
  } catch { /* já existe */ }

  // Campos de cliente/obra no orçamento (módulo independente)
  for (const col of [
    "clienteNome VARCHAR(255)", "clienteTelefone VARCHAR(50)", "clienteEmail VARCHAR(255)",
    "obraNomeRef VARCHAR(255)", "obraEndereco VARCHAR(500)", "responsavel VARCHAR(255)",
  ]) {
    try {
      const db = await getDb();
      if (db) await db.execute(sql.raw(`ALTER TABLE orcamentos ADD COLUMN ${col}`));
    } catch { /* já existe */ }
  }

  // Protocolos de envio (notas/boletos enviados)
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS protocolos (
        id INT AUTO_INCREMENT PRIMARY KEY, obraId INT NOT NULL,
        numero VARCHAR(100), observacao TEXT,
        criadoEm TIMESTAMP DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS protocolo_notas (
        id INT AUTO_INCREMENT PRIMARY KEY, protocoloId INT NOT NULL,
        fornecedor VARCHAR(255), ordemCompra VARCHAR(100), pedido VARCHAR(100), nf VARCHAR(100),
        dataEnvio DATE, venc1 DATE, venc2 DATE, venc3 DATE, status VARCHAR(20), condicao VARCHAR(20), valor DECIMAL(12,2), ordem INT DEFAULT 0
      )`);
    }
  } catch { /* já existe */ }
  for (const col of ["status VARCHAR(20)", "condicao VARCHAR(20)", "valor DECIMAL(12,2)"]) {
    try {
      const db = await getDb();
      if (db) await db.execute(sql.raw(`ALTER TABLE protocolo_notas ADD COLUMN ${col}`));
    } catch { /* já existe */ }
  }
  try {
    const db = await getDb();
    if (db) await db.execute(sql.raw(`ALTER TABLE protocolos ADD COLUMN criadoPor VARCHAR(255)`));
  } catch { /* já existe */ }

  // Cadastro de insumos e categorias
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS insumo_categorias (
        id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(255) NOT NULL, sigla VARCHAR(20), criadoEm TIMESTAMP DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS insumos (
        id INT AUTO_INCREMENT PRIMARY KEY, categoriaId INT, codigo VARCHAR(50), nome VARCHAR(500) NOT NULL,
        unidade VARCHAR(20), ativo BOOLEAN DEFAULT TRUE, criadoEm TIMESTAMP DEFAULT NOW()
      )`);
    }
  } catch { /* já existe */ }

  // Migração: adicionar coluna sigla em insumo_categorias
  try {
    const db = await getDb();
    if (db) await db.execute(sql`ALTER TABLE insumo_categorias ADD COLUMN sigla VARCHAR(20)`);
  } catch { /* já existe */ }

  // Pedidos de compra (materiais)
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS pedidos_compra (
        id INT AUTO_INCREMENT PRIMARY KEY, obraId INT NOT NULL,
        numero VARCHAR(100), solicitante VARCHAR(255), observacao TEXT, status VARCHAR(20),
        criadoEm TIMESTAMP DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS pedido_itens (
        id INT AUTO_INCREMENT PRIMARY KEY, pedidoId INT NOT NULL,
        descricao VARCHAR(500), unidade VARCHAR(20), quantidade DECIMAL(12,2), observacao VARCHAR(500), ordem INT DEFAULT 0
      )`);
    }
  } catch { /* já existe */ }

  // Cada ALTER TABLE em bloco isolado para não abortar os demais se a coluna já existir
  const runAlter = async (stmt: ReturnType<typeof sql>) => {
    try { const db = await getDb(); if (db) await db.execute(stmt); } catch { /* coluna já existe */ }
  };
  await runAlter(sql`ALTER TABLE pedido_itens ADD COLUMN statusAprovacao VARCHAR(20) DEFAULT 'pendente'`);
  await runAlter(sql`ALTER TABLE pedido_itens ADD COLUMN observacaoReprovacao TEXT`);
  await runAlter(sql`ALTER TABLE pedido_itens ADD COLUMN valorEstimado DECIMAL(15,2)`);
  await runAlter(sql`ALTER TABLE pedidos_compra ADD COLUMN dataEntrega DATE`);
  await runAlter(sql`ALTER TABLE pedidos_compra ADD COLUMN localAplicacao VARCHAR(255)`);

  // Cadastro de Fornecedores
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS fornecedores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(500) NOT NULL,
        nomeFantasia VARCHAR(500),
        tipo ENUM('fisica','juridica') DEFAULT 'juridica',
        cpfCnpj VARCHAR(30),
        inscEstadual VARCHAR(100),
        inscMunicipal VARCHAR(100),
        endereco VARCHAR(500),
        complemento VARCHAR(255),
        numero VARCHAR(20),
        bairro VARCHAR(255),
        cidade VARCHAR(255),
        uf VARCHAR(2),
        cep VARCHAR(10),
        referencia VARCHAR(500),
        email VARCHAR(255),
        telefone VARCHAR(100),
        nomeContato VARCHAR(255),
        observacao TEXT,
        ativo BOOLEAN DEFAULT TRUE,
        criadoEm TIMESTAMP DEFAULT NOW()
      )`);
    }
  } catch { /* já existe */ }

  // Migração: adicionar coluna nomeContato em fornecedores
  await runAlter(sql`ALTER TABLE fornecedores ADD COLUMN nomeContato VARCHAR(255)`);
  await runAlter(sql`ALTER TABLE mapa_itens ADD COLUMN dataEntrega DATE`);

  // Mapa de Cotação
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS mapas_cotacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        obraId INT NOT NULL,
        numero VARCHAR(50),
        titulo VARCHAR(255),
        localAplicacao VARCHAR(255),
        dataAplicacao DATE,
        observacao TEXT,
        status VARCHAR(20) DEFAULT 'em_andamento',
        criadoPor VARCHAR(255),
        criadoEm TIMESTAMP DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS mapa_fornecedores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mapaId INT NOT NULL,
        ordem INT DEFAULT 1,
        nome VARCHAR(255),
        contato VARCHAR(255),
        telefone VARCHAR(100),
        desconto DECIMAL(15,2) DEFAULT 0,
        frete DECIMAL(15,2) DEFAULT 0,
        condicaoPagamento VARCHAR(255)
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS mapa_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mapaId INT NOT NULL,
        pedidoItemId INT,
        descricao VARCHAR(500),
        unidade VARCHAR(20),
        quantidade DECIMAL(12,2),
        observacao VARCHAR(500),
        ordem INT DEFAULT 0
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS mapa_cotacoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mapaItemId INT NOT NULL,
        mapaFornecedorId INT NOT NULL,
        valorUnitario DECIMAL(15,4) DEFAULT 0,
        UNIQUE KEY uq_item_forn (mapaItemId, mapaFornecedorId)
      )`);
    }
  } catch { /* já existe */ }

  // Ordens de Compra (geradas a partir dos mapas concluídos)
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS ordens_compra (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero INT NOT NULL,
        obraId INT NOT NULL,
        fornecedorNome VARCHAR(255),
        fornecedorId INT,
        status VARCHAR(20) DEFAULT 'previa',
        frete DECIMAL(15,2) DEFAULT 0,
        observacao TEXT,
        geradoPor VARCHAR(255),
        criadoEm TIMESTAMP DEFAULT NOW()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS ordem_compra_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ordemId INT NOT NULL,
        mapaItemId INT,
        mapaId INT,
        mapaFornecedorId INT,
        descricao VARCHAR(500),
        unidade VARCHAR(20),
        quantidade DECIMAL(12,2),
        valorUnitario DECIMAL(15,4)
      )`);
    }
  } catch { /* já existe */ }
}

export async function updateLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

// ============= OBRAS =============

export async function getObrasByUserId(userId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getObrasByUserId(userId);
  return db.select().from(obras).where(eq(obras.criadoPor, userId));
}

// Todas as obras (uso de admin)
export async function getAllObras() {
  const db = await getDb();
  if (!db) return demo.demo_getObrasByUserId(1);
  return db.select().from(obras);
}

// Obras visíveis para um usuário comum: as que ele criou + as com acesso concedido
export async function getObrasVisiveis(userId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getObrasByUserId(userId);
  const acessos = await db
    .select()
    .from(acessoObra)
    .where(and(eq(acessoObra.usuarioId, userId), eq(acessoObra.ativo, true)));
  const idsComAcesso = acessos.map(a => a.obraId);
  const todas = await db.select().from(obras);
  return todas.filter(o => o.criadoPor === userId || idsComAcesso.includes(o.id));
}

export async function getObraById(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getObraById(obraId) ?? undefined;
  const result = await db.select().from(obras).where(eq(obras.id, obraId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createObra(data: typeof obras.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createObra(data);
  const result = await db.insert(obras).values(data);
  return result;
}

export async function updateObra(obraId: number, data: Partial<typeof obras.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateObra(obraId, data);
  return db.update(obras).set(data).where(eq(obras.id, obraId));
}

export async function deleteObra(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_deleteObra(obraId);
  return db.delete(obras).where(eq(obras.id, obraId));
}

// ============= DIÁRIOS =============

export async function getDiariosByObraId(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getDiariosByObraId(obraId);
  return db.select().from(diarios).where(eq(diarios.obraId, obraId)).orderBy(desc(diarios.data));
}

export async function getDiarioById(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getDiarioById(diarioId) ?? undefined;
  const result = await db.select().from(diarios).where(eq(diarios.id, diarioId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createDiario(data: typeof diarios.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createDiario(data);
  await db.insert(diarios).values(data);
  const created = await db.select().from(diarios).where(eq(diarios.obraId, data.obraId)).orderBy(desc(diarios.id)).limit(1);
  return created[0];
}

export async function updateDiario(diarioId: number, data: Partial<typeof diarios.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateDiario(diarioId, data);
  return db.update(diarios).set(data).where(eq(diarios.id, diarioId));
}

export async function deleteDiario(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_deleteDiario(diarioId);
  return db.delete(diarios).where(eq(diarios.id, diarioId));
}

// ============= ATIVIDADES =============

export async function getAtividadesByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getAtividadesByDiarioId(diarioId);
  return db.select().from(atividades).where(eq(atividades.diarioId, diarioId));
}

export async function createAtividade(data: typeof atividades.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createAtividade(data);
  return db.insert(atividades).values(data);
}

export async function deleteAtividade(id: number) {
  const db = await getDb();
  if (!db) return;
  return db.delete(atividades).where(eq(atividades.id, id));
}

export async function updateAtividade(id: number, data: Partial<typeof atividades.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  return db.update(atividades).set(data).where(eq(atividades.id, id));
}

// ============= MÃO DE OBRA =============

export async function getMaoDeObraByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getMaoDeObraByDiarioId(diarioId);
  return db.select().from(maoDeObra).where(eq(maoDeObra.diarioId, diarioId));
}

export async function createMaoDeObra(data: typeof maoDeObra.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createMaoDeObra(data);
  return db.insert(maoDeObra).values(data);
}

// ============= EQUIPAMENTOS =============

export async function getEquipamentosByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getEquipamentosByDiarioId(diarioId);
  return db.select().from(equipamentos).where(eq(equipamentos.diarioId, diarioId));
}

export async function createEquipamento(data: typeof equipamentos.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createEquipamento(data);
  return db.insert(equipamentos).values(data);
}

export async function deleteEquipamento(id: number) {
  const db = await getDb();
  if (!db) return;
  return db.delete(equipamentos).where(eq(equipamentos.id, id));
}

// ============= MATERIAIS =============

export async function getMaterialsByObraId(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getMaterialsByObraId(obraId);
  return db.select().from(materiais).where(eq(materiais.obraId, obraId));
}

export async function createMaterial(data: typeof materiais.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createMaterial(data);
  return db.insert(materiais).values(data);
}

export async function updateMaterial(materialId: number, data: Partial<typeof materiais.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateMaterial(materialId, data);
  return db.update(materiais).set(data).where(eq(materiais.id, materialId));
}

export async function deleteMaterial(materialId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(movimentacaoMateriais).where(eq(movimentacaoMateriais.materialId, materialId));
  await db.delete(materiais).where(eq(materiais.id, materialId));
}

// ============= MOVIMENTAÇÃO DE MATERIAIS =============

export async function getMovimentacoesByMaterialId(materialId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getMovimentacoesByMaterialId(materialId);
  return db.select().from(movimentacaoMateriais).where(eq(movimentacaoMateriais.materialId, materialId)).orderBy(desc(movimentacaoMateriais.data));
}

export async function createMovimentacao(data: typeof movimentacaoMateriais.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createMovimentacao(data);
  return db.insert(movimentacaoMateriais).values(data);
}

// ============= OCORRÊNCIAS =============

export async function getOcorrenciasByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getOcorrenciasByDiarioId(diarioId);
  return db.select().from(ocorrencias).where(eq(ocorrencias.diarioId, diarioId));
}

export async function createOcorrencia(data: typeof ocorrencias.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createOcorrencia(data);
  return db.insert(ocorrencias).values(data);
}

export async function updateOcorrencia(ocorrenciaId: number, data: Partial<typeof ocorrencias.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateOcorrencia(ocorrenciaId, data);
  return db.update(ocorrencias).set(data).where(eq(ocorrencias.id, ocorrenciaId));
}

export async function deleteOcorrencia(id: number) {
  const db = await getDb();
  if (!db) return;
  return db.delete(ocorrencias).where(eq(ocorrencias.id, id));
}

// ============= COLABORADORES =============

export async function getColaboradoresByEquipeId(equipeId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getColaboradoresByEquipeId(equipeId);
  return db.select().from(colaboradores).where(eq(colaboradores.equipeId, equipeId)).orderBy(asc(colaboradores.nome));
}

export async function getEquipes(obraId?: number) {
  const db = await getDb();
  if (!db) return demo.demo_getEquipes();
  const cond = obraId != null
    ? and(eq(equipes.ativo, true), eq(equipes.obraId, obraId))
    : eq(equipes.ativo, true);
  return db.select().from(equipes).where(cond).orderBy(asc(equipes.nome));
}

export async function getEquipeById(id: number) {
  const db = await getDb();
  if (!db) return demo.demo_getEquipeById(id);
  const result = await db.select().from(equipes).where(eq(equipes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createEquipe(data: typeof equipes.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createEquipe(data);
  return db.insert(equipes).values(data);
}

export async function updateEquipe(id: number, data: Partial<typeof equipes.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateEquipe(id, data);
  return db.update(equipes).set(data).where(eq(equipes.id, id));
}

export async function deleteEquipe(id: number) {
  const db = await getDb();
  if (!db) return demo.demo_deleteEquipe(id);
  return db.delete(equipes).where(eq(equipes.id, id));
}

export async function createColaborador(data: typeof colaboradores.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createColaborador(data);
  return db.insert(colaboradores).values(data);
}

export async function updateColaborador(colaboradorId: number, data: Partial<typeof colaboradores.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateColaborador(colaboradorId, data);
  return db.update(colaboradores).set(data).where(eq(colaboradores.id, colaboradorId));
}

export async function deleteColaborador(colaboradorId: number) {
  const db = await getDb();
  if (!db) return demo.demo_deleteColaborador(colaboradorId);
  return db.delete(colaboradores).where(eq(colaboradores.id, colaboradorId));
}

// ============= PRESENÇA =============

export async function getPresencaByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getPresencaByDiarioId(diarioId);
  return db.select().from(presenca).where(eq(presenca.diarioId, diarioId));
}

export async function createPresenca(data: typeof presenca.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createPresenca(data);
  return db.insert(presenca).values(data);
}

export async function deletePresencaByDiario(diarioId: number) {
  const db = await getDb();
  if (!db) return;
  return db.delete(presenca).where(eq(presenca.diarioId, diarioId));
}

// Calendário de presença por equipe/operário num período (mês)
export async function getPresencaCalendario(obraId: number, inicio: string, fim: string) {
  const db = await getDb();
  if (!db) return { equipes: [], dias: [] };
  const ds = await db.select({ id: diarios.id, data: diarios.data })
    .from(diarios)
    .where(and(eq(diarios.obraId, obraId), gte(diarios.data, inicio as any), lte(diarios.data, fim as any)));
  if (ds.length === 0) return { equipes: [], dias: [] };
  const diarioIds = ds.map((d) => d.id);
  const dataById = new Map(ds.map((d) => [d.id, d.data]));
  const fmt = (d: any) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

  const pres = await db.select({
      diarioId: presenca.diarioId, colaboradorId: presenca.colaboradorId, presente: presenca.presente,
      equipeId: colaboradores.equipeId,
    })
    .from(presenca)
    .innerJoin(colaboradores, eq(presenca.colaboradorId, colaboradores.id))
    .where(inArray(presenca.diarioId, diarioIds));

  const diasMap = new Map<string, Record<number, { presentes: number; operarios: number[] }>>();
  for (const p of pres) {
    if (p.presente === false) continue;
    const dataStr = fmt(dataById.get(p.diarioId));
    let dia = diasMap.get(dataStr);
    if (!dia) { dia = {}; diasMap.set(dataStr, dia); }
    let pe = dia[p.equipeId];
    if (!pe) { pe = { presentes: 0, operarios: [] }; dia[p.equipeId] = pe; }
    pe.presentes += 1; pe.operarios.push(p.colaboradorId);
  }
  const dias = Array.from(diasMap.entries()).map(([data, porEquipe]) => ({ data, porEquipe }));

  const equipeIds = Array.from(new Set(pres.map((p) => p.equipeId)));
  let equipesOut: any[] = [];
  if (equipeIds.length) {
    const eqs = await db.select({ id: equipes.id, nome: equipes.nome, empresa: equipes.empresa })
      .from(equipes).where(inArray(equipes.id, equipeIds));
    const cols = await db.select({ id: colaboradores.id, equipeId: colaboradores.equipeId, nome: colaboradores.nome, funcao: colaboradores.funcao, ativo: colaboradores.ativo })
      .from(colaboradores).where(inArray(colaboradores.equipeId, equipeIds));
    equipesOut = eqs.map((e) => {
      const cs = cols.filter((c) => c.equipeId === e.id);
      const ativos = cs.filter((c) => c.ativo !== false);
      return { ...e, totalColaboradores: (ativos.length || cs.length), colaboradores: cs.map((c) => ({ id: c.id, nome: c.nome, funcao: c.funcao })) };
    });
  }
  return { equipes: equipesOut, dias };
}

// Resumo de mão de obra do diário, agrupado por equipe/empresa (para PDF)
export async function getMaoDeObraResumoByDiario(diarioId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      equipeId: equipes.id,
      equipeNome: equipes.nome,
      empresa: equipes.empresa,
      colaboradorId: colaboradores.id,
      funcao: colaboradores.funcao,
      presente: presenca.presente,
    })
    .from(presenca)
    .innerJoin(colaboradores, eq(presenca.colaboradorId, colaboradores.id))
    .innerJoin(equipes, eq(colaboradores.equipeId, equipes.id))
    .where(eq(presenca.diarioId, diarioId));

  const mapa = new Map<number, { equipeId: number; equipeNome: string; empresa: string; presentes: number; funcoes: Record<string, number>; operarios: number[] }>();
  for (const r of rows) {
    if (r.presente === false) continue;
    let g = mapa.get(r.equipeId);
    if (!g) { g = { equipeId: r.equipeId, equipeNome: r.equipeNome, empresa: r.empresa, presentes: 0, funcoes: {}, operarios: [] }; mapa.set(r.equipeId, g); }
    g.presentes += 1;
    g.operarios.push(r.colaboradorId);
    if (r.funcao) g.funcoes[r.funcao] = (g.funcoes[r.funcao] || 0) + 1;
  }
  return Array.from(mapa.values());
}

// ============= MÍDIA =============

export async function getMidiaByObraId(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getMidiaByObraId(obraId);
  return db.select().from(midia).where(eq(midia.obraId, obraId));
}

export async function getMidiaByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getMidiaByDiarioId(diarioId);
  return db.select().from(midia).where(eq(midia.diarioId, diarioId));
}

export async function createMidia(data: typeof midia.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createMidia(data);
  return db.insert(midia).values(data);
}

export async function deleteMidia(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(midia).where(eq(midia.id, id));
}

// ============= PENDÊNCIAS =============

export async function getPendenciasByObraId(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getPendenciasByObraId(obraId);
  return db.select().from(pendencias).where(eq(pendencias.obraId, obraId)).orderBy(desc(pendencias.criadoEm));
}

export async function createPendencia(data: typeof pendencias.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createPendencia(data);
  return db.insert(pendencias).values(data);
}

export async function updatePendencia(pendenciaId: number, data: Partial<typeof pendencias.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updatePendencia(pendenciaId, data);
  return db.update(pendencias).set(data).where(eq(pendencias.id, pendenciaId));
}

export async function deletePendencia(pendenciaId: number) {
  const db = await getDb();
  if (!db) return;
  return db.delete(pendencias).where(eq(pendencias.id, pendenciaId));
}

// ============= RELATÓRIOS =============

export async function getRelatoriosByObraId(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getRelatoriosByObraId(obraId);
  return db.select().from(relatorios).where(eq(relatorios.obraId, obraId)).orderBy(desc(relatorios.criadoEm));
}

export async function createRelatorio(data: typeof relatorios.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createRelatorio(data);
  return db.insert(relatorios).values(data);
}

// ============= ACESSO CLIENTE =============

export async function getAcessoClienteByToken(token: string) {
  const db = await getDb();
  if (!db) return demo.demo_getAcessoClienteByToken(token) ?? undefined;
  const result = await db.select().from(acessoCliente).where(eq(acessoCliente.tokenAcesso, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createAcessoCliente(data: typeof acessoCliente.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createAcessoCliente(data);
  return db.insert(acessoCliente).values(data);
}

// ============= SUGESTÕES LLM =============

export async function getSugestoesLLMByDiarioId(diarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getSugestoesLLMByDiarioId(diarioId);
  return db.select().from(sugestoesLLM).where(eq(sugestoesLLM.diarioId, diarioId));
}

export async function createSugestaoLLM(data: typeof sugestoesLLM.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createSugestaoLLM(data);
  return db.insert(sugestoesLLM).values(data);
}

export async function updateSugestaoLLM(sugestaoId: number, data: Partial<typeof sugestoesLLM.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateSugestaoLLM(sugestaoId, data);
  return db.update(sugestoesLLM).set(data).where(eq(sugestoesLLM.id, sugestaoId));
}

export async function getSugestoesLLM(obraId?: number, aprovada?: boolean) {
  const db = await getDb();
  if (!db) return demo.demo_getSugestoesLLM(obraId, aprovada);
  const conditions = [];
  if (aprovada !== undefined) conditions.push(eq(sugestoesLLM.aprovada, aprovada));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  if (whereClause) return db.select().from(sugestoesLLM).where(whereClause).orderBy(desc(sugestoesLLM.criadoEm));
  return db.select().from(sugestoesLLM).orderBy(desc(sugestoesLLM.criadoEm));
}

export async function getSugestaoLLMById(id: number) {
  const db = await getDb();
  if (!db) return demo.demo_getSugestaoLLMById(id) ?? undefined;
  const result = await db.select().from(sugestoesLLM).where(eq(sugestoesLLM.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteSugestaoLLM(id: number) {
  const db = await getDb();
  if (!db) return demo.demo_deleteSugestaoLLM(id);
  return db.delete(sugestoesLLM).where(eq(sugestoesLLM.id, id));
}

// ============= ACESSO POR OBRA =============

export async function getUserAccessToObra(usuarioId: number, obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getUserAccessToObra(usuarioId, obraId);
  const result = await db.select().from(acessoObra).where(and(eq(acessoObra.usuarioId, usuarioId), eq(acessoObra.obraId, obraId), eq(acessoObra.ativo, true))).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getObraAccessList(obraId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getObraAccessList(obraId);
  return await db.select().from(acessoObra).where(eq(acessoObra.obraId, obraId));
}

export async function getUserObras(usuarioId: number) {
  const db = await getDb();
  if (!db) return demo.demo_getUserObras(usuarioId);
  const access = await db.select().from(acessoObra).where(and(eq(acessoObra.usuarioId, usuarioId), eq(acessoObra.ativo, true)));
  if (access.length === 0) return [];
  const obraIds = access.map(a => a.obraId);
  return await db.select().from(obras).where((obra) => sql`${obra.id} IN (${sql.join(obraIds)})`);
}

export async function createAcessoObra(data: typeof acessoObra.$inferInsert) {
  const db = await getDb();
  if (!db) return demo.demo_createAcessoObra(data);
  return db.insert(acessoObra).values(data);
}

export async function updateAcessoObra(acessoId: number, data: Partial<typeof acessoObra.$inferInsert>) {
  const db = await getDb();
  if (!db) return demo.demo_updateAcessoObra(acessoId, data);
  return db.update(acessoObra).set(data).where(eq(acessoObra.id, acessoId));
}

export async function deleteAcessoObra(acessoId: number) {
  const db = await getDb();
  if (!db) return demo.demo_deleteAcessoObra(acessoId);
  return db.delete(acessoObra).where(eq(acessoObra.id, acessoId));
}

// ============= CONSOLIDATION FOR PERIODIC SUMMARIES =============

// Agrupa textos equivalentes (ignora maiúsculas/acentos/espaços/pontuação) para
// evitar duplicidade da mesma atividade escrita de formas diferentes.
function agruparTextos(itens: (string | null | undefined)[]): string[] {
  const grupos = new Map<string, { count: number; forms: Map<string, number> }>();
  for (const raw of itens) {
    const desc = (raw || "").trim();
    if (!desc) continue;
    const key = desc.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
    if (!key) continue;
    let g = grupos.get(key);
    if (!g) { g = { count: 0, forms: new Map() }; grupos.set(key, g); }
    g.count++;
    g.forms.set(desc, (g.forms.get(desc) || 0) + 1);
  }
  return Array.from(grupos.values()).map((g) => {
    const formaMaisComum = Array.from(g.forms.entries()).sort((a, b) => b[1] - a[1])[0][0];
    return g.count > 1 ? `${formaMaisComum} (${g.count}x)` : formaMaisComum;
  });
}

export async function getConsolidacaoPeriodo(obraId: number, dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  if (!db) return demo.demo_getConsolidacaoPeriodo(obraId, dataInicio, dataFim);

  // Get all diarios in the period
  const diariosPeriodo = await db.select().from(diarios)
    .where(
      and(
        eq(diarios.obraId, obraId),
        gte(diarios.data, dataInicio),
        lte(diarios.data, dataFim)
      )
    )
    .orderBy(asc(diarios.data));

  if (diariosPeriodo.length === 0) {
    return {
      totalDiarios: 0,
      totalAtividades: 0,
      totalOcorrencias: 0,
      totalFotos: 0,
      principaisAtividades: [],
      principaisOcorrencias: [],
      climaPredominate: null,
      maoDeObraTotal: 0,
      equipamentosUtilizados: [],
      materiaisMovimentados: [],
    };
  }

  // Get all related data
  const diarioIds = diariosPeriodo.map(d => d.id);
  
  const atividadesPeriodo = await db.select().from(atividades)
    .where(inArray(atividades.diarioId, diarioIds));

  const ocorrenciasPeriodo = await db.select().from(ocorrencias)
    .where(inArray(ocorrencias.diarioId, diarioIds));

  const midiasPeriodo = await db.select().from(midia)
    .where(inArray(midia.diarioId, diarioIds));

  const equipamentosPeriodo = await db.select().from(equipamentos)
    .where(inArray(equipamentos.diarioId, diarioIds));

  const materiaisPeriodo = await db.select().from(movimentacaoMateriais)
    .where(inArray(movimentacaoMateriais.diarioId, diarioIds));

  // Presença por equipe (média de presentes por dia)
  const presencaPeriodo = await db.select({
      diarioId: presenca.diarioId, presente: presenca.presente,
      equipeId: colaboradores.equipeId, equipeNome: equipes.nome, empresa: equipes.empresa,
    })
    .from(presenca)
    .innerJoin(colaboradores, eq(presenca.colaboradorId, colaboradores.id))
    .innerJoin(equipes, eq(colaboradores.equipeId, equipes.id))
    .where(inArray(presenca.diarioId, diarioIds));
  const presentesValidos = presencaPeriodo.filter((p) => p.presente !== false);
  const porEquipeMap = new Map<number, { equipeNome: string; empresa: string; porDia: Map<number, number> }>();
  for (const p of presentesValidos) {
    let e = porEquipeMap.get(p.equipeId);
    if (!e) { e = { equipeNome: p.equipeNome, empresa: p.empresa, porDia: new Map() }; porEquipeMap.set(p.equipeId, e); }
    e.porDia.set(p.diarioId, (e.porDia.get(p.diarioId) || 0) + 1);
  }
  const equipeIdsPres = Array.from(porEquipeMap.keys());
  const totalColabPorEquipe = new Map<number, number>();
  if (equipeIdsPres.length) {
    const cols = await db.select({ equipeId: colaboradores.equipeId, ativo: colaboradores.ativo })
      .from(colaboradores).where(inArray(colaboradores.equipeId, equipeIdsPres));
    for (const c of cols) totalColabPorEquipe.set(c.equipeId, (totalColabPorEquipe.get(c.equipeId) || 0) + (c.ativo !== false ? 1 : 0));
  }
  const presencaEquipes = Array.from(porEquipeMap.entries()).map(([eqId, e]) => {
    const dias = Array.from(e.porDia.values());
    const media = dias.length ? dias.reduce((s, n) => s + n, 0) / dias.length : 0;
    return {
      equipeNome: e.equipeNome, empresa: e.empresa,
      mediaPresentes: Math.round(media * 10) / 10,
      diasComPresenca: dias.length,
      totalColaboradores: totalColabPorEquipe.get(eqId) || 0,
    };
  }).sort((a, b) => b.mediaPresentes - a.mediaPresentes);

  // Calculate climate predominance
  const climaCounts = diariosPeriodo.reduce((acc, d) => {
    if (d.clima) {
      acc[d.clima] = (acc[d.clima] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const climaPredominate = Object.entries(climaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Get unique equipment used
  const equipamentosUnicos = Array.from(new Set(equipamentosPeriodo.map(e => e.nome)));

  // Get material movements summary
  const materiaisResumido = materiaisPeriodo.reduce((acc, m) => {
    const existing = acc.find(x => x.materialId === m.materialId);
    if (existing) {
      existing.quantidade += parseFloat(m.quantidade as unknown as string) || 0;
      existing.movimentacoes += 1;
    } else {
      acc.push({
        materialId: m.materialId,
        quantidade: parseFloat(m.quantidade as unknown as string) || 0,
        movimentacoes: 1,
      });
    }
    return acc;
  }, [] as Array<{ materialId: number; quantidade: number; movimentacoes: number }>);

  return {
    totalDiarios: diariosPeriodo.length,
    totalAtividades: atividadesPeriodo.length,
    totalOcorrencias: ocorrenciasPeriodo.length,
    totalFotos: midiasPeriodo.length,
    principaisAtividades: agruparTextos(atividadesPeriodo.map(a => a.descricao)),
    principaisOcorrencias: agruparTextos(ocorrenciasPeriodo.map(o => o.descricao)),
    climaPredominate,
    maoDeObraTotal: presentesValidos.length,
    presencaEquipes,
    equipamentosUtilizados: equipamentosUnicos,
    materiaisMovimentados: materiaisResumido,
    diarios: diariosPeriodo,
    atividades: atividadesPeriodo,
    ocorrencias: ocorrenciasPeriodo,
    midias: midiasPeriodo,
  };
}

export async function getMidiasConsolidadas(obraId: number, dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  if (!db) return [];

  const diariosPeriodo = await db.select().from(diarios)
    .where(
      and(
        eq(diarios.obraId, obraId),
        gte(diarios.data, dataInicio),
        lte(diarios.data, dataFim)
      )
    );

  const diarioIds = diariosPeriodo.map(d => d.id);
  if (diarioIds.length === 0) return [];

  return await db.select().from(midia)
    .where(inArray(midia.diarioId, diarioIds))
    .orderBy(desc(midia.criadoEm));
}

// Get material by ID for consolidation
export async function getMaterialById(materialId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(materiais).where(eq(materiais.id, materialId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getConsolidacaoPeriodoType() {
  // Type helper for consolidation return type
  return null as any;
}

// ─── Usuário demo (modo sem banco de dados) ───────────────────────────────
// Permite login local sem MySQL. Credenciais: pedroemilio / localhost7
const DEMO_USER = {
  id: 1,
  name: "Pedro Emílio",
  email: "pedroemilio",
  passwordHash: "$2b$10$Wp6aD81npggMkem4ivqAmekBGSlW3FLEYKwafH481SDIf41fqbm06",
  role: "admin" as const,
  createdAt: new Date(),
  lastSignedIn: new Date(),
};

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return id === 1 ? DEMO_USER : null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [DEMO_USER];
  return db.select().from(users);
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(acessoObra).where(eq(acessoObra.usuarioId, id));
  await db.delete(users).where(eq(users.id, id));
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function updateUserData(id: number, data: { name?: string; username?: string; email?: string; role?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data as any).where(eq(users.id, id));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return email === "pedroemilio" ? DEMO_USER : null;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

// Busca por e-mail OU usuário (login flexível)
export async function getUserByLogin(login: string) {
  const db = await getDb();
  if (!db) return login === "pedroemilio" ? DEMO_USER : null;
  const result = await db
    .select()
    .from(users)
    .where(sql`${users.email} = ${login} OR ${users.username} = ${login}`)
    .limit(1);
  return result[0] ?? null;
}

// Verifica se já existe usuário com aquele e-mail ou username
export async function getUserByEmailOrUsername(email: string, username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(users)
    .where(sql`${users.email} = ${email} OR ${users.username} = ${username}`)
    .limit(1);
  return result[0] ?? null;
}

export async function createUser(data: { name: string; email: string; username?: string; passwordHash: string; role?: "user" | "admin" | "engenheiro" | "cliente" }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.insert(users).values({
    name: data.name,
    email: data.email,
    username: data.username ?? null,
    passwordHash: data.passwordHash,
    role: (data.role as any) ?? "engenheiro",
    lastSignedIn: new Date(),
  } as any);
  return getUserByEmail(data.email);
}

// ============= ORÇAMENTOS =============

export async function getOrcamentosByObra(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orcamentos).where(eq(orcamentos.obraId, obraId)).orderBy(desc(orcamentos.criadoEm));
}

export async function getAllOrcamentos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orcamentos).orderBy(desc(orcamentos.criadoEm));
}

export async function getOrcamentoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r = await db.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
  return r[0] ?? null;
}

export async function createOrcamento(data: typeof orcamentos.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");
  const [res]: any = await db.insert(orcamentos).values(data);
  const id = res?.insertId;
  if (id) {
    const r = await db.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
    if (r[0]) return r[0];
  }
  // Fallback: pega o último criado
  const r = await db.select().from(orcamentos).orderBy(desc(orcamentos.id)).limit(1);
  return r[0];
}

export async function updateOrcamento(id: number, data: Partial<typeof orcamentos.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orcamentos).set(data).where(eq(orcamentos.id, id));
}

export async function deleteOrcamento(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(orcamentoItens).where(eq(orcamentoItens.orcamentoId, id));
  await db.delete(orcamentos).where(eq(orcamentos.id, id));
}

export async function getItensByOrcamento(orcamentoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orcamentoItens).where(eq(orcamentoItens.orcamentoId, orcamentoId)).orderBy(asc(orcamentoItens.ordem));
}

export async function createOrcamentoItem(data: typeof orcamentoItens.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");
  await db.insert(orcamentoItens).values(data);
}

export async function createOrcamentoItensBatch(itens: typeof orcamentoItens.$inferInsert[]) {
  const db = await getDb();
  if (!db || itens.length === 0) return;
  await db.insert(orcamentoItens).values(itens);
}

export async function updateOrcamentoItem(id: number, data: Partial<typeof orcamentoItens.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orcamentoItens).set(data).where(eq(orcamentoItens.id, id));
}

export async function deleteOrcamentoItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(orcamentoItens).where(eq(orcamentoItens.id, id));
}

// ============= CONFIG DA EMPRESA (compartilhada) =============

export async function getEmpresaConfig(): Promise<any> {
  const db = await getDb();
  if (!db) return {};
  try {
    const r: any = await db.execute(sql`SELECT dados FROM empresa_config WHERE id = 1`);
    const rows = Array.isArray(r) ? r[0] : r;
    const dados = rows?.[0]?.dados;
    return dados ? JSON.parse(dados) : {};
  } catch {
    return {};
  }
}

export async function setEmpresaConfig(config: any): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const json = JSON.stringify(config);
  await db.execute(sql`INSERT INTO empresa_config (id, dados) VALUES (1, ${json})
    ON DUPLICATE KEY UPDATE dados = ${json}`);
}

// ============= PLANEJAMENTOS =============

export async function getPlanejamentos() {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`SELECT id, nome, obraId, orcamentoId, dataInicio, criadoEm FROM planejamentos ORDER BY criadoEm DESC`);
  return Array.isArray(r) ? r[0] : r;
}

export async function getPlanejamentoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r: any = await db.execute(sql`SELECT * FROM planejamentos WHERE id = ${id} LIMIT 1`);
  const rows = Array.isArray(r) ? r[0] : r;
  const row = rows?.[0];
  if (!row) return null;
  return { ...row, dados: row.dados ? JSON.parse(row.dados) : {} };
}

export async function createPlanejamento(data: { nome: string; obraId?: number | null; orcamentoId?: number | null; dataInicio?: string | null; dados: any }) {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");
  const json = JSON.stringify(data.dados);
  const r: any = await db.execute(sql`INSERT INTO planejamentos (nome, obraId, orcamentoId, dataInicio, dados)
    VALUES (${data.nome}, ${data.obraId ?? null}, ${data.orcamentoId ?? null}, ${data.dataInicio ?? null}, ${json})`);
  const res = Array.isArray(r) ? r[0] : r;
  return res?.insertId;
}

export async function updatePlanejamentoDados(id: number, dados: any) {
  const db = await getDb();
  if (!db) return;
  const json = JSON.stringify(dados);
  await db.execute(sql`UPDATE planejamentos SET dados = ${json} WHERE id = ${id}`);
}

export async function deletePlanejamento(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM planejamentos WHERE id = ${id}`);
}

// ============= PROTOCOLOS DE ENVIO =============
type ProtocoloNotaInput = { fornecedor?: string; ordemCompra?: string; pedido?: string; nf?: string; valor?: number; dataEnvio?: string; venc1?: string; venc2?: string; venc3?: string; status?: string; condicao?: string };

export async function getProtocolosByObra(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`
    SELECT p.id, p.numero, p.observacao, p.criadoEm, p.criadoPor,
      (SELECT COUNT(*) FROM protocolo_notas n WHERE n.protocoloId = p.id) AS totalNotas,
      (SELECT GROUP_CONCAT(DISTINCT n.status) FROM protocolo_notas n WHERE n.protocoloId = p.id) AS statuses
    FROM protocolos p WHERE p.obraId = ${obraId} ORDER BY p.id DESC`);
  return (r[0] ?? r) as any[];
}

export async function getProtocoloById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const ph: any = await db.execute(sql`SELECT * FROM protocolos WHERE id = ${id} LIMIT 1`);
  const protocolo = (ph[0] ?? ph)[0];
  if (!protocolo) return null;
  const nr: any = await db.execute(sql`SELECT * FROM protocolo_notas WHERE protocoloId = ${id} ORDER BY ordem, id`);
  const notas = (nr[0] ?? nr) as any[];
  return { ...protocolo, notas };
}

export async function createProtocolo(data: { obraId: number; numero?: string; observacao?: string; criadoPor?: string; notas: ProtocoloNotaInput[] }) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const res: any = await db.execute(sql`INSERT INTO protocolos (obraId, numero, observacao, criadoPor) VALUES (${data.obraId}, ${data.numero ?? null}, ${data.observacao ?? null}, ${data.criadoPor ?? null})`);
  const id = (res[0]?.insertId ?? res.insertId) as number;
  await inserirNotas(id, data.notas);
  return { id };
}

export async function updateProtocolo(id: number, data: { numero?: string; observacao?: string; notas: ProtocoloNotaInput[] }) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE protocolos SET numero = ${data.numero ?? null}, observacao = ${data.observacao ?? null} WHERE id = ${id}`);
  await db.execute(sql`DELETE FROM protocolo_notas WHERE protocoloId = ${id}`);
  await inserirNotas(id, data.notas);
}

async function inserirNotas(protocoloId: number, notas: ProtocoloNotaInput[]) {
  const db = await getDb();
  if (!db) return;
  let ordem = 0;
  for (const n of notas || []) {
    await db.execute(sql`INSERT INTO protocolo_notas (protocoloId, fornecedor, ordemCompra, pedido, nf, valor, dataEnvio, venc1, venc2, venc3, status, condicao, ordem)
      VALUES (${protocoloId}, ${n.fornecedor ?? null}, ${n.ordemCompra ?? null}, ${n.pedido ?? null}, ${n.nf ?? null}, ${n.valor ?? null},
        ${n.dataEnvio || null}, ${n.venc1 || null}, ${n.venc2 || null}, ${n.venc3 || null}, ${n.status ?? null}, ${n.condicao ?? null}, ${ordem++})`);
  }
}

export async function buscarNotasProtocolo(obraId: number, termo: string) {
  const db = await getDb();
  if (!db) return [];
  const like = `%${termo}%`;
  const r: any = await db.execute(sql`
    SELECT n.id, n.fornecedor, n.ordemCompra, n.pedido, n.nf, n.dataEnvio, n.status, n.condicao,
      n.venc1, n.venc2, n.venc3, p.id AS protocoloId, p.numero AS protocoloNumero
    FROM protocolo_notas n JOIN protocolos p ON n.protocoloId = p.id
    WHERE p.obraId = ${obraId} AND (
      n.fornecedor LIKE ${like} OR n.ordemCompra LIKE ${like} OR n.pedido LIKE ${like}
      OR n.nf LIKE ${like} OR n.status LIKE ${like} OR p.numero LIKE ${like})
    ORDER BY p.id DESC LIMIT 100`);
  return (r[0] ?? r) as any[];
}

export async function deleteProtocolo(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM protocolo_notas WHERE protocoloId = ${id}`);
  await db.execute(sql`DELETE FROM protocolos WHERE id = ${id}`);
}

// ============= PEDIDOS DE COMPRA =============
type PedidoItemInput = { descricao?: string; unidade?: string; quantidade?: number; observacao?: string };

export async function getPedidosByObra(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`
    SELECT p.id, p.numero, p.solicitante, p.observacao, p.status, p.criadoEm, p.dataEntrega,
      (SELECT COUNT(*) FROM pedido_itens i WHERE i.pedidoId = p.id) AS totalItens
    FROM pedidos_compra p WHERE p.obraId = ${obraId} ORDER BY p.id DESC`);
  return (r[0] ?? r) as any[];
}

export async function getPedidoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const ph: any = await db.execute(sql`SELECT * FROM pedidos_compra WHERE id = ${id} LIMIT 1`);
  const pedido = (ph[0] ?? ph)[0];
  if (!pedido) return null;
  const ir: any = await db.execute(sql`SELECT * FROM pedido_itens WHERE pedidoId = ${id} ORDER BY ordem, id`);
  return { ...pedido, itens: (ir[0] ?? ir) as any[] };
}

async function inserirPedidoItens(pedidoId: number, itens: PedidoItemInput[]) {
  const db = await getDb();
  if (!db) return;
  let ordem = 0;
  for (const it of itens || []) {
    await db.execute(sql`INSERT INTO pedido_itens (pedidoId, descricao, unidade, quantidade, observacao, ordem)
      VALUES (${pedidoId}, ${it.descricao ?? null}, ${it.unidade ?? null}, ${it.quantidade ?? null}, ${it.observacao ?? null}, ${ordem++})`);
  }
}

export async function createPedido(data: { obraId: number; numero?: string; solicitante?: string; observacao?: string; status?: string; dataEntrega?: string; localAplicacao?: string; itens: PedidoItemInput[] }) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const res: any = await db.execute(sql`INSERT INTO pedidos_compra (obraId, numero, solicitante, observacao, status, dataEntrega, localAplicacao)
    VALUES (${data.obraId}, ${data.numero ?? null}, ${data.solicitante ?? null}, ${data.observacao ?? null}, ${data.status ?? "aberto"}, ${data.dataEntrega ?? null}, ${data.localAplicacao ?? null})`);
  const id = (res[0]?.insertId ?? res.insertId) as number;
  await inserirPedidoItens(id, data.itens);
  return { id };
}

export async function updatePedido(id: number, data: { numero?: string; solicitante?: string; observacao?: string; status?: string; dataEntrega?: string; localAplicacao?: string; itens: PedidoItemInput[] }) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE pedidos_compra SET numero = ${data.numero ?? null}, solicitante = COALESCE(${data.solicitante ?? null}, solicitante), observacao = ${data.observacao ?? null}, status = ${data.status ?? null}, dataEntrega = ${data.dataEntrega ?? null}, localAplicacao = ${data.localAplicacao ?? null} WHERE id = ${id}`);
  await db.execute(sql`DELETE FROM pedido_itens WHERE pedidoId = ${id}`);
  await inserirPedidoItens(id, data.itens);
}

export async function deletePedido(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM pedido_itens WHERE pedidoId = ${id}`);
  await db.execute(sql`DELETE FROM pedidos_compra WHERE id = ${id}`);
}

// ============= SUPRIMENTOS: APROVAÇÃO =============

export async function getPedidosParaAprovacao(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  // Retorna TODOS os pedidos da obra com seus itens e status de aprovação.
  // A separação em "aguardando / aprovados / reprovados" é feita no front.
  const r: any = await db.execute(sql`
    SELECT p.id, p.numero, p.solicitante, p.observacao, p.status, p.criadoEm
    FROM pedidos_compra p
    WHERE p.obraId = ${obraId}
      AND (p.status IS NULL OR p.status NOT IN ('recebido','cancelado'))
    ORDER BY p.id DESC`);
  const pedidos = (r[0] ?? r) as any[];
  for (const p of pedidos) {
    const ir: any = await db.execute(sql`
      SELECT id, descricao, unidade, quantidade, observacao, valorEstimado,
             COALESCE(statusAprovacao,'pendente') AS statusAprovacao, observacaoReprovacao
      FROM pedido_itens WHERE pedidoId = ${p.id} ORDER BY ordem, id`);
    p.itens = (ir[0] ?? ir) as any[];
  }
  return pedidos;
}

export async function atualizarAprovacaoItem(itemId: number, statusAprovacao: string, observacaoReprovacao?: string, quantidade?: number) {
  const db = await getDb();
  if (!db) return;
  if (quantidade != null) {
    await db.execute(sql`
      UPDATE pedido_itens
      SET statusAprovacao = ${statusAprovacao}, observacaoReprovacao = ${observacaoReprovacao ?? null}, quantidade = ${quantidade}
      WHERE id = ${itemId}`);
  } else {
    await db.execute(sql`
      UPDATE pedido_itens
      SET statusAprovacao = ${statusAprovacao}, observacaoReprovacao = ${observacaoReprovacao ?? null}
      WHERE id = ${itemId}`);
  }
  // Recalcula status do pedido pai
  const ir: any = await db.execute(sql`SELECT statusAprovacao FROM pedido_itens WHERE pedidoId = (SELECT pedidoId FROM pedido_itens WHERE id = ${itemId})`);
  const itens = (ir[0] ?? ir) as any[];
  const todos = itens.map((i: any) => i.statusAprovacao ?? 'pendente');
  let novoStatus: string;
  if (todos.every((s: string) => s === 'aprovado')) novoStatus = 'aprovado_total';
  else if (todos.every((s: string) => s === 'reprovado')) novoStatus = 'reprovado';
  else if (todos.some((s: string) => s !== 'pendente')) novoStatus = 'aprovado_parcial';
  else novoStatus = 'aberto';
  const pr: any = await db.execute(sql`SELECT pedidoId FROM pedido_itens WHERE id = ${itemId} LIMIT 1`);
  const pedidoId = ((pr[0] ?? pr)[0])?.pedidoId;
  if (pedidoId) await db.execute(sql`UPDATE pedidos_compra SET status = ${novoStatus} WHERE id = ${pedidoId}`);
}

export async function buscarItensPedido(obraId: number, termo: string) {
  const db = await getDb();
  if (!db) return [];
  const like = `%${termo}%`;
  const r: any = await db.execute(sql`
    SELECT i.id, i.descricao, i.unidade, i.quantidade, i.observacao,
      p.id AS pedidoId, p.numero AS pedidoNumero, p.status AS pedidoStatus
    FROM pedido_itens i JOIN pedidos_compra p ON i.pedidoId = p.id
    WHERE p.obraId = ${obraId} AND (
      i.descricao LIKE ${like} OR i.observacao LIKE ${like} OR p.numero LIKE ${like} OR p.solicitante LIKE ${like})
    ORDER BY p.id DESC LIMIT 100`);
  return (r[0] ?? r) as any[];
}

// ============= CADASTRO: CATEGORIAS DE INSUMOS =============
export async function getInsumoCategorias() {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`SELECT id, nome, sigla, criadoEm,
    (SELECT COUNT(*) FROM insumos i WHERE i.categoriaId = c.id) AS totalInsumos
    FROM insumo_categorias c ORDER BY c.nome`);
  return (r[0] ?? r) as any[];
}
export async function createInsumoCategoria(nome: string, sigla?: string) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const res: any = await db.execute(sql`INSERT INTO insumo_categorias (nome, sigla) VALUES (${nome}, ${sigla ?? null})`);
  return { id: (res[0]?.insertId ?? res.insertId) as number };
}
export async function updateInsumoCategoria(id: number, nome: string, sigla?: string) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE insumo_categorias SET nome = ${nome}, sigla = ${sigla ?? null} WHERE id = ${id}`);
}
export async function deleteInsumoCategoria(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM insumo_categorias WHERE id = ${id}`);
}

const CATEGORIAS_PADRAO = [
  { sigla: "ACO", nome: "AÇO CONSTRUÇÃO CIVIL" },
  { sigla: "EST", nome: "AÇO ESTRUTURAS METÁLICAS" },
  { sigla: "IMP", nome: "ADITIVOS E IMPERMEABILIZANTES" },
  { sigla: "ALV", nome: "ALVENARIAS" },
  { sigla: "ARC", nome: "AR CONDICIONADO" },
  { sigla: "CDO", nome: "CANTEIRO DE OBRAS" },
  { sigla: "IBS", nome: "INSUMOS BÁSICOS - DIVERSOS" },
  { sigla: "ELT", nome: "ELÉTRICOS - INFRAESTRUTURA E CABEAMENTOS" },
  { sigla: "HID", nome: "HIDRÁULICOS" },
  { sigla: "TR", nome: "TRIBUTOS" },
  { sigla: "SPD", nome: "SISTEMA DE PROTEÇÃO DESCARGAS ATMOSFÉRICAS - SPDA" },
  { sigla: "EEL", nome: "EQUIPAMENTOS ELÉTRICOS - LEVES" },
  { sigla: "EEM", nome: "EQUIPAMENTOS ELÉTRICOS - MOVIMENTAÇÃO DE CARGA" },
  { sigla: "EMEC", nome: "EQUIPAMENTOS MECÂNICOS - MOVIMENTAÇÃO DE CARGA" },
  { sigla: "ESP", nome: "ESPAÇADORES PLÁSTICOS" },
  { sigla: "FER", nome: "FERRAMENTAS - USO MANUAL" },
  { sigla: "FDM", nome: "FORMAS DE MADEIRA" },
  { sigla: "GAB", nome: "GABARITO / LOCAÇÃO" },
  { sigla: "LOC", nome: "LOCAÇÃO DE EQUIPAMENTOS ELÉTRICOS - LEVES" },
  { sigla: "LOCM", nome: "LOCAÇÃO DE EQUIPAMENTOS ELÉTRICOS - MOV. DE CARGA" },
  { sigla: "LOM", nome: "LOUÇAS E METAIS SANITÁRIOS" },
  { sigla: "ILU", nome: "ILUMINAÇÃO" },
  { sigla: "ACBE", nome: "ACABAMENTOS ELÉTRICOS" },
  { sigla: "LIMP", nome: "MATERIAL DE LIMPEZA E HIGIENE" },
  { sigla: "PIN", nome: "MATERIAL DE PINTURA" },
  { sigla: "REV", nome: "REVESTIMENTOS CERÂMICOS" },
  { sigla: "ESQA", nome: "ESQUADRIAS DE ALUMÍNIO" },
  { sigla: "ESQM", nome: "ESQUADRIAS DE MADEIRA" },
  { sigla: "ESQV", nome: "ESQUADRIAS DE VIDROS" },
  { sigla: "ESMT", nome: "ESQUADRIAS METÁLICAS" },
  { sigla: "MO", nome: "MÃO DE OBRA" },
  { sigla: "EPI", nome: "EPI" },
  { sigla: "ALM", nome: "ALIMENTAÇÃO" },
  { sigla: "INC", nome: "PREVENÇÃO E COMBATE A INCÊNDIO" },
  { sigla: "PAV", nome: "PAVIMENTAÇÃO EXTERNA" },
  { sigla: "PROJ", nome: "PROJETOS" },
  { sigla: "SETEC", nome: "SERVIÇOS TÉCNICOS" },
  { sigla: "TAE", nome: "TAXAS E EMOLUMENTOS" },
  { sigla: "CADM", nome: "CUSTOS ADMINISTRATIVOS" },
  { sigla: "COB", nome: "TELHADO / COBERTURA" },
  { sigla: "MOB", nome: "MOBILIÁRIO" },
  { sigla: "TRSP", nome: "TRANSPORTE" },
  { sigla: "LAPM", nome: "LAJES PRÉ MOLDADAS" },
  { sigla: "EPC", nome: "EPC - EQUIPAMENTOS PROTEÇÃO COLETIVA" },
  { sigla: "MGS", nome: "MÁRMORES, GRANITOS E SINTÉTICOS" },
  { sigla: "CONC", nome: "CONCESSIONÁRIAS" },
  { sigla: "MOA", nome: "MÃO DE OBRA ADMINISTRATIVA" },
  { sigla: "DEC", nome: "DESPESAS COMERCIAIS" },
  { sigla: "LOCV", nome: "LOCAÇÃO DE VEÍCULOS" },
  { sigla: "PLAN", nome: "PLANEJAMENTO" },
];

export async function seedInsumoCategorias() {
  const db = await getDb();
  if (!db) return { inseridas: 0 };
  let inseridas = 0;
  for (const cat of CATEGORIAS_PADRAO) {
    const existe: any = await db.execute(sql`SELECT id FROM insumo_categorias WHERE sigla = ${cat.sigla}`);
    const rows = existe[0] ?? existe;
    if (!Array.isArray(rows) || rows.length === 0) {
      await db.execute(sql`INSERT INTO insumo_categorias (nome, sigla) VALUES (${cat.nome}, ${cat.sigla})`);
      inseridas++;
    }
  }
  return { inseridas };
}

// ============= CADASTRO: INSUMOS =============
export async function getInsumos() {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`
    SELECT i.id, i.categoriaId, i.codigo, i.nome, i.unidade, i.ativo, c.nome AS categoriaNome, c.sigla AS categoriaSigla
    FROM insumos i LEFT JOIN insumo_categorias c ON i.categoriaId = c.id
    ORDER BY c.nome, i.nome`);
  return (r[0] ?? r) as any[];
}
export async function createInsumo(data: { categoriaId?: number; codigo?: string; nome: string; unidade?: string }) {
  const db = await getDb();
  if (!db) return { id: 0 };
  let codigo = data.codigo ?? null;
  if (!codigo && data.categoriaId) {
    const catR: any = await db.execute(sql`SELECT sigla FROM insumo_categorias WHERE id = ${data.categoriaId}`);
    const catRows = catR[0] ?? catR;
    const sigla = Array.isArray(catRows) && catRows[0]?.sigla ? catRows[0].sigla : null;
    if (sigla) {
      const cntR: any = await db.execute(sql`SELECT COUNT(*) AS cnt FROM insumos WHERE categoriaId = ${data.categoriaId}`);
      const cntRows = cntR[0] ?? cntR;
      const cnt = Array.isArray(cntRows) ? Number(cntRows[0]?.cnt ?? 0) : 0;
      codigo = `${sigla}${cnt + 1}`;
    }
  }
  const res: any = await db.execute(sql`INSERT INTO insumos (categoriaId, codigo, nome, unidade)
    VALUES (${data.categoriaId ?? null}, ${codigo}, ${data.nome}, ${data.unidade ?? null})`);
  return { id: (res[0]?.insertId ?? res.insertId) as number, codigo };
}
export async function updateInsumo(id: number, data: { categoriaId?: number; codigo?: string; nome?: string; unidade?: string; ativo?: boolean }) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE insumos SET
    categoriaId = ${data.categoriaId ?? null}, codigo = ${data.codigo ?? null},
    nome = ${data.nome ?? null}, unidade = ${data.unidade ?? null}, ativo = ${data.ativo ?? true}
    WHERE id = ${id}`);
}
export async function deleteInsumo(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM insumos WHERE id = ${id}`);
}

// ============= MAPA DE COTAÇÃO =============

export async function getMapasByObra(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`
    SELECT m.*,
      (SELECT COUNT(*) FROM mapa_itens WHERE mapaId = m.id) AS totalItens,
      (SELECT COUNT(*) FROM mapa_fornecedores WHERE mapaId = m.id AND nome IS NOT NULL AND nome != '') AS totalFornecedores
    FROM mapas_cotacao m WHERE m.obraId = ${obraId} ORDER BY m.criadoEm DESC`);
  return (r[0] ?? r) as any[];
}

export async function getMapaById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const mr: any = await db.execute(sql`SELECT * FROM mapas_cotacao WHERE id = ${id}`);
  const mapaRows = (mr[0] ?? mr) as any[];
  if (!mapaRows.length) return null;
  const mapa = mapaRows[0];
  const fr: any = await db.execute(sql`SELECT * FROM mapa_fornecedores WHERE mapaId = ${id} ORDER BY ordem`);
  const ir: any = await db.execute(sql`SELECT * FROM mapa_itens WHERE mapaId = ${id} ORDER BY ordem`);
  const itensRows = (ir[0] ?? ir) as any[];
  let cotacoesRows: any[] = [];
  if (itensRows.length > 0) {
    const cr: any = await db.execute(sql`
      SELECT mc.* FROM mapa_cotacoes mc
      JOIN mapa_itens mi ON mc.mapaItemId = mi.id
      WHERE mi.mapaId = ${id}`);
    cotacoesRows = (cr[0] ?? cr) as any[];
  }
  return { ...mapa, fornecedores: (fr[0] ?? fr) as any[], itens: itensRows, cotacoes: cotacoesRows };
}

export async function createMapa(data: {
  obraId: number; titulo?: string; localAplicacao?: string; dataAplicacao?: string; criadoPor?: string;
  itens: { pedidoItemId?: number; descricao: string; unidade?: string; quantidade?: number; observacao?: string; }[];
}) {
  const db = await getDb();
  if (!db) return { id: 0, numero: '001' };
  const nr: any = await db.execute(sql`SELECT COUNT(*) AS cnt FROM mapas_cotacao WHERE obraId = ${data.obraId}`);
  const cnt = Number(((nr[0] ?? nr) as any[])[0]?.cnt ?? 0);
  const numero = String(cnt + 1).padStart(3, '0');
  const res: any = await db.execute(sql`INSERT INTO mapas_cotacao (obraId, numero, titulo, localAplicacao, dataAplicacao, criadoPor)
    VALUES (${data.obraId}, ${numero}, ${data.titulo ?? null}, ${data.localAplicacao ?? null}, ${data.dataAplicacao ?? null}, ${data.criadoPor ?? null})`);
  const mapaId = (res[0]?.insertId ?? res.insertId) as number;
  await db.execute(sql`INSERT INTO mapa_fornecedores (mapaId, ordem) VALUES (${mapaId}, 1)`);
  for (let i = 0; i < data.itens.length; i++) {
    const item = data.itens[i];
    await db.execute(sql`INSERT INTO mapa_itens (mapaId, pedidoItemId, descricao, unidade, quantidade, observacao, ordem, dataEntrega)
      VALUES (${mapaId}, ${item.pedidoItemId ?? null}, ${item.descricao}, ${item.unidade ?? null}, ${item.quantidade ?? 1}, ${item.observacao ?? null}, ${i + 1}, ${(item as any).dataEntrega ?? null})`);
  }
  return { id: mapaId, numero };
}

export async function addMapaFornecedor(mapaId: number) {
  const db = await getDb();
  if (!db) return { id: 0, ordem: 1 };
  const nr: any = await db.execute(sql`SELECT COUNT(*) AS cnt FROM mapa_fornecedores WHERE mapaId = ${mapaId}`);
  const cnt = Number(((nr[0] ?? nr) as any[])[0]?.cnt ?? 0);
  const ordem = cnt + 1;
  const res: any = await db.execute(sql`INSERT INTO mapa_fornecedores (mapaId, ordem) VALUES (${mapaId}, ${ordem})`);
  const id = (res[0]?.insertId ?? res.insertId) as number;
  return { id, ordem };
}

export async function removeMapaFornecedor(fornecedorId: number) {
  const db = await getDb();
  if (!db) return;
  const mr: any = await db.execute(sql`SELECT mapaId FROM mapa_fornecedores WHERE id = ${fornecedorId} LIMIT 1`);
  const mapaId = ((mr[0] ?? mr) as any[])[0]?.mapaId;
  await db.execute(sql`DELETE FROM mapa_cotacoes WHERE mapaFornecedorId = ${fornecedorId}`);
  await db.execute(sql`DELETE FROM mapa_fornecedores WHERE id = ${fornecedorId}`);
  if (mapaId) {
    const rem: any = await db.execute(sql`SELECT id FROM mapa_fornecedores WHERE mapaId = ${mapaId} ORDER BY ordem ASC`);
    const ids = ((rem[0] ?? rem) as any[]).map((r: any) => r.id);
    for (let i = 0; i < ids.length; i++) {
      await db.execute(sql`UPDATE mapa_fornecedores SET ordem = ${i + 1} WHERE id = ${ids[i]}`);
    }
  }
}

export async function updateMapa(id: number, data: {
  titulo?: string; localAplicacao?: string; dataAplicacao?: string; observacao?: string; status?: string;
  fornecedores?: { id: number; nome?: string; contato?: string; telefone?: string; desconto?: number; frete?: number; condicaoPagamento?: string; }[];
  itens?: { pedidoItemId?: number; descricao: string; unidade?: string; quantidade?: number; observacao?: string; }[];
  cotacoes?: { itemIndex: number; fornecedorId: number; valorUnitario: number; }[];
}) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE mapas_cotacao SET
    titulo = ${data.titulo ?? null}, localAplicacao = ${data.localAplicacao ?? null},
    dataAplicacao = ${data.dataAplicacao ?? null}, observacao = ${data.observacao ?? null},
    status = ${data.status ?? 'em_andamento'}
    WHERE id = ${id}`);
  if (data.fornecedores) {
    for (const f of data.fornecedores) {
      await db.execute(sql`UPDATE mapa_fornecedores SET
        nome = ${f.nome ?? null}, contato = ${f.contato ?? null}, telefone = ${f.telefone ?? null},
        desconto = ${f.desconto ?? 0}, frete = ${f.frete ?? 0}, condicaoPagamento = ${f.condicaoPagamento ?? null}
        WHERE id = ${f.id}`);
    }
  }
  if (data.itens !== undefined) {
    // Delete old cotacoes before deleting items
    const oldR: any = await db.execute(sql`SELECT id FROM mapa_itens WHERE mapaId = ${id}`);
    const oldIds = ((oldR[0] ?? oldR) as any[]).map((r: any) => r.id);
    for (const oid of oldIds) {
      await db.execute(sql`DELETE FROM mapa_cotacoes WHERE mapaItemId = ${oid}`);
    }
    await db.execute(sql`DELETE FROM mapa_itens WHERE mapaId = ${id}`);
    const newItemIds: number[] = [];
    for (let i = 0; i < data.itens.length; i++) {
      const item = data.itens[i];
      const ir: any = await db.execute(sql`INSERT INTO mapa_itens (mapaId, pedidoItemId, descricao, unidade, quantidade, observacao, ordem, dataEntrega)
        VALUES (${id}, ${item.pedidoItemId ?? null}, ${item.descricao}, ${item.unidade ?? null}, ${item.quantidade ?? 1}, ${item.observacao ?? null}, ${i + 1}, ${(item as any).dataEntrega ?? null})`);
      newItemIds.push((ir[0]?.insertId ?? ir.insertId) as number);
    }
    if (data.cotacoes) {
      for (const c of data.cotacoes) {
        const newItemId = newItemIds[c.itemIndex];
        if (newItemId && c.valorUnitario > 0) {
          await db.execute(sql`INSERT INTO mapa_cotacoes (mapaItemId, mapaFornecedorId, valorUnitario)
            VALUES (${newItemId}, ${c.fornecedorId}, ${c.valorUnitario})
            ON DUPLICATE KEY UPDATE valorUnitario = ${c.valorUnitario}`);
        }
      }
    }
  }
}

export async function deleteMapa(id: number) {
  const db = await getDb();
  if (!db) return;
  const oldR: any = await db.execute(sql`SELECT id FROM mapa_itens WHERE mapaId = ${id}`);
  const oldIds = ((oldR[0] ?? oldR) as any[]).map((r: any) => r.id);
  for (const oid of oldIds) {
    await db.execute(sql`DELETE FROM mapa_cotacoes WHERE mapaItemId = ${oid}`);
  }
  await db.execute(sql`DELETE FROM mapa_itens WHERE mapaId = ${id}`);
  await db.execute(sql`DELETE FROM mapa_fornecedores WHERE mapaId = ${id}`);
  await db.execute(sql`DELETE FROM mapas_cotacao WHERE id = ${id}`);
}

export async function getAllMapas() {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`
    SELECT m.*, o.nome AS obraNome,
      (SELECT COUNT(*) FROM mapa_itens WHERE mapaId = m.id) AS totalItens,
      (SELECT COUNT(*) FROM mapa_fornecedores WHERE mapaId = m.id AND nome IS NOT NULL AND nome != '') AS totalFornecedores
    FROM mapas_cotacao m JOIN obras o ON m.obraId = o.id
    ORDER BY m.criadoEm DESC`);
  return (r[0] ?? r) as any[];
}

export async function getItensAprovadosByObra(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`
    SELECT i.id, i.descricao, i.unidade, i.quantidade, i.observacao,
      p.id AS pedidoId, p.numero AS pedidoNumero,
      p.localAplicacao AS pedidoLocalAplicacao,
      p.dataEntrega AS pedidoDataEntrega
    FROM pedido_itens i JOIN pedidos_compra p ON i.pedidoId = p.id
    WHERE p.obraId = ${obraId} AND i.statusAprovacao = 'aprovado'
    ORDER BY p.numero, i.ordem`);
  return (r[0] ?? r) as any[];
}

// ============= ORDENS DE COMPRA =============

/** IDs de itens de mapa já consumidos por alguma OC ativa (prévia ou gerada). */
async function getMapaItensConsumidos(db: any): Promise<Set<number>> {
  const cr: any = await db.execute(sql`
    SELECT DISTINCT oci.mapaItemId FROM ordem_compra_itens oci
    JOIN ordens_compra oc ON oci.ordemId = oc.id
    WHERE oc.status IN ('previa','gerada') AND oci.mapaItemId IS NOT NULL`);
  return new Set(((cr[0] ?? cr) as any[]).map((r: any) => Number(r.mapaItemId)));
}

/**
 * "PEDIDOS PRONTOS": mapas concluídos da obra com seus itens ainda não
 * consumidos por nenhuma OC. Cada item traz a lista de fornecedores que o
 * cotaram (com preço e frete) e a marcação do melhor preço.
 */
export async function getPedidosProntos(obraId: number) {
  const db = await getDb();
  if (!db) return [];
  const mr: any = await db.execute(sql`
    SELECT * FROM mapas_cotacao WHERE obraId = ${obraId} AND status = 'concluido' ORDER BY numero`);
  const mapas = (mr[0] ?? mr) as any[];
  if (!mapas.length) return [];
  const consumidos = await getMapaItensConsumidos(db);

  const resultado: any[] = [];
  for (const mapa of mapas) {
    const ir: any = await db.execute(sql`SELECT * FROM mapa_itens WHERE mapaId = ${mapa.id} ORDER BY ordem`);
    const itens = ((ir[0] ?? ir) as any[]).filter((it: any) => !consumidos.has(Number(it.id)));
    if (!itens.length) continue;

    const fr: any = await db.execute(sql`
      SELECT * FROM mapa_fornecedores WHERE mapaId = ${mapa.id} AND nome IS NOT NULL AND nome != '' ORDER BY ordem`);
    const fornecedores = (fr[0] ?? fr) as any[];

    const qr: any = await db.execute(sql`
      SELECT mc.* FROM mapa_cotacoes mc JOIN mapa_itens mi ON mc.mapaItemId = mi.id
      WHERE mi.mapaId = ${mapa.id}`);
    const cotacoes = (qr[0] ?? qr) as any[];

    const itensOut = itens.map((it: any) => {
      const cots = cotacoes
        .filter((c: any) => Number(c.mapaItemId) === Number(it.id) && Number(c.valorUnitario) > 0)
        .map((c: any) => {
          const f = fornecedores.find((ff: any) => Number(ff.id) === Number(c.mapaFornecedorId));
          if (!f) return null;
          return {
            mapaFornecedorId: Number(f.id),
            nome: f.nome,
            valorUnitario: Number(c.valorUnitario),
            frete: Number(f.frete ?? 0),
            melhor: false,
          };
        })
        .filter(Boolean) as any[];
      const min = cots.reduce((m: number, c: any) => Math.min(m, c.valorUnitario), Infinity);
      cots.forEach((c: any) => { c.melhor = c.valorUnitario === min; });
      return {
        mapaItemId: Number(it.id),
        descricao: it.descricao,
        unidade: it.unidade,
        quantidade: Number(it.quantidade ?? 1),
        fornecedores: cots,
      };
    }).filter((it: any) => it.fornecedores.length > 0);

    if (itensOut.length) {
      resultado.push({ mapaId: Number(mapa.id), numero: mapa.numero, titulo: mapa.titulo, itens: itensOut });
    }
  }
  return resultado;
}

/** OC completa (cabeçalho + itens + dados da obra). */
export async function getOrdemCompraById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r: any = await db.execute(sql`
    SELECT oc.*, o.nome AS obraNome, o.codigo AS obraCodigo, o.endereco AS obraEndereco,
           o.enderecoEntrega AS obraEnderecoEntrega
    FROM ordens_compra oc JOIN obras o ON oc.obraId = o.id WHERE oc.id = ${id} LIMIT 1`);
  const oc = ((r[0] ?? r) as any[])[0];
  if (!oc) return null;
  const ir: any = await db.execute(sql`SELECT * FROM ordem_compra_itens WHERE ordemId = ${id} ORDER BY id`);
  const itens = ((ir[0] ?? ir) as any[]).map((it: any) => ({
    ...it,
    quantidade: Number(it.quantidade ?? 0),
    valorUnitario: Number(it.valorUnitario ?? 0),
  }));
  return { ...oc, frete: Number(oc.frete ?? 0), itens };
}

/** Lista OCs da obra por status, com total calculado. */
export async function getOrdensCompra(obraId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const r: any = status
    ? await db.execute(sql`
        SELECT oc.*,
          (SELECT COALESCE(SUM(quantidade * valorUnitario), 0) FROM ordem_compra_itens WHERE ordemId = oc.id) AS totalItens,
          (SELECT COUNT(*) FROM ordem_compra_itens WHERE ordemId = oc.id) AS qtdItens
        FROM ordens_compra oc WHERE oc.obraId = ${obraId} AND oc.status = ${status} ORDER BY oc.numero`)
    : await db.execute(sql`
        SELECT oc.*,
          (SELECT COALESCE(SUM(quantidade * valorUnitario), 0) FROM ordem_compra_itens WHERE ordemId = oc.id) AS totalItens,
          (SELECT COUNT(*) FROM ordem_compra_itens WHERE ordemId = oc.id) AS qtdItens
        FROM ordens_compra oc WHERE oc.obraId = ${obraId} ORDER BY oc.numero`);
  return ((r[0] ?? r) as any[]).map((oc: any) => {
    const totalItens = Number(oc.totalItens ?? 0);
    const frete = Number(oc.frete ?? 0);
    return { ...oc, totalItens, frete, valorTotal: totalItens + frete };
  });
}

/**
 * Gera 1+ OCs em status "prévia" a partir dos itens selecionados,
 * agrupando por fornecedor escolhido. Frete é importado do mapa por fornecedor
 * (somado entre mapas distintos quando o grupo abrange mais de um mapa).
 * Retorna as OCs criadas (completas).
 */
export async function createOrdensCompra(
  obraId: number,
  selecionados: { mapaItemId: number; mapaFornecedorId: number; quantidade?: number }[],
  geradoPor?: string,
) {
  const db = await getDb();
  if (!db) return [];

  // Enriquecer cada item com dados do mapa, fornecedor e preço cotado.
  const enriched: ItemSelecionadoOC[] = [];
  for (const sel of selecionados) {
    const ir: any = await db.execute(sql`SELECT * FROM mapa_itens WHERE id = ${sel.mapaItemId} LIMIT 1`);
    const item = ((ir[0] ?? ir) as any[])[0];
    if (!item) continue;
    const fr: any = await db.execute(sql`SELECT * FROM mapa_fornecedores WHERE id = ${sel.mapaFornecedorId} LIMIT 1`);
    const forn = ((fr[0] ?? fr) as any[])[0];
    if (!forn) continue;
    const qr: any = await db.execute(sql`
      SELECT valorUnitario FROM mapa_cotacoes WHERE mapaItemId = ${sel.mapaItemId} AND mapaFornecedorId = ${sel.mapaFornecedorId} LIMIT 1`);
    const cot = ((qr[0] ?? qr) as any[])[0];
    enriched.push({
      mapaItemId: sel.mapaItemId,
      mapaId: Number(item.mapaId),
      mapaFornecedorId: sel.mapaFornecedorId,
      fornecedorNome: forn.nome ?? "",
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: sel.quantidade != null ? Number(sel.quantidade) : Number(item.quantidade ?? 1),
      valorUnitario: cot ? Number(cot.valorUnitario) : 0,
    });
  }
  if (!enriched.length) return [];

  const grupos = agruparItensPorFornecedor(enriched);
  const criadasIds: number[] = [];
  for (const g of grupos) {
    // Frete: soma do frete do fornecedor (por nome) em cada mapa distinto do grupo.
    let frete = 0;
    for (const mapaId of g.mapaIds) {
      const fr: any = await db.execute(sql`
        SELECT frete FROM mapa_fornecedores WHERE mapaId = ${mapaId} AND nome = ${g.fornecedorNome} LIMIT 1`);
      const row = ((fr[0] ?? fr) as any[])[0];
      frete += row ? Number(row.frete ?? 0) : 0;
    }
    // Próximo número global.
    const nr: any = await db.execute(sql`SELECT numero FROM ordens_compra`);
    const numeros = ((nr[0] ?? nr) as any[]).map((r: any) => Number(r.numero));
    const numero = proximoNumeroOC(numeros);

    const res: any = await db.execute(sql`
      INSERT INTO ordens_compra (numero, obraId, fornecedorNome, status, frete, geradoPor)
      VALUES (${numero}, ${obraId}, ${g.fornecedorNome}, 'previa', ${frete}, ${geradoPor ?? null})`);
    const ordemId = (res[0]?.insertId ?? res.insertId) as number;

    for (const it of g.itens) {
      await db.execute(sql`
        INSERT INTO ordem_compra_itens (ordemId, mapaItemId, mapaId, mapaFornecedorId, descricao, unidade, quantidade, valorUnitario)
        VALUES (${ordemId}, ${it.mapaItemId}, ${it.mapaId}, ${it.mapaFornecedorId}, ${it.descricao}, ${it.unidade ?? null}, ${it.quantidade}, ${it.valorUnitario})`);
    }
    criadasIds.push(ordemId);
  }
  const ocs = await Promise.all(criadasIds.map(id => getOrdemCompraById(id)));
  return ocs.filter(Boolean);
}

/** Edita frete/observação de uma OC ainda em prévia. */
export async function updateOrdemCompra(id: number, data: { frete?: number; observacao?: string }) {
  const db = await getDb();
  if (!db) return { success: false };
  const r: any = await db.execute(sql`SELECT status FROM ordens_compra WHERE id = ${id} LIMIT 1`);
  const st = ((r[0] ?? r) as any[])[0]?.status;
  if (st !== "previa") return { success: false, message: "Só é possível editar OCs em prévia." };
  await db.execute(sql`UPDATE ordens_compra SET
    frete = COALESCE(${data.frete ?? null}, frete),
    observacao = COALESCE(${data.observacao ?? null}, observacao)
    WHERE id = ${id}`);
  return { success: true };
}

/** Confirma a prévia: status passa para "gerada". */
export async function confirmarOrdemCompra(id: number) {
  const db = await getDb();
  if (!db) return { success: false };
  await db.execute(sql`UPDATE ordens_compra SET status = 'gerada' WHERE id = ${id} AND status = 'previa'`);
  return { success: true };
}

/** Cancela uma prévia (não confirmada) — os itens voltam para PEDIDOS PRONTOS. */
export async function cancelarOrdemCompra(id: number) {
  const db = await getDb();
  if (!db) return { success: false };
  const r: any = await db.execute(sql`SELECT status FROM ordens_compra WHERE id = ${id} LIMIT 1`);
  const st = ((r[0] ?? r) as any[])[0]?.status;
  if (st !== "previa") return { success: false, message: "Só prévias podem ser canceladas." };
  await db.execute(sql`DELETE FROM ordem_compra_itens WHERE ordemId = ${id}`);
  await db.execute(sql`DELETE FROM ordens_compra WHERE id = ${id}`);
  return { success: true };
}

// ============= CADASTRO: FORNECEDORES =============

export async function getFornecedores() {
  const db = await getDb();
  if (!db) return [];
  const r: any = await db.execute(sql`SELECT * FROM fornecedores WHERE ativo = TRUE ORDER BY nome`);
  return (r[0] ?? r) as any[];
}

export async function getFornecedorById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const r: any = await db.execute(sql`SELECT * FROM fornecedores WHERE id = ${id} LIMIT 1`);
  const rows = (r[0] ?? r) as any[];
  return rows[0] ?? null;
}

type FornecedorInput = {
  nome: string; nomeFantasia?: string | null; tipo?: string | null;
  cpfCnpj?: string | null; inscEstadual?: string | null; inscMunicipal?: string | null;
  endereco?: string | null; complemento?: string | null; numero?: string | null;
  bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null;
  referencia?: string | null; email?: string | null; telefone?: string | null;
  nomeContato?: string | null; observacao?: string | null;
};

export async function createFornecedor(d: FornecedorInput) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const res: any = await db.execute(sql`INSERT INTO fornecedores
    (nome, nomeFantasia, tipo, cpfCnpj, inscEstadual, inscMunicipal, endereco, complemento, numero, bairro, cidade, uf, cep, referencia, email, telefone, nomeContato, observacao)
    VALUES (${d.nome}, ${d.nomeFantasia ?? null}, ${d.tipo ?? 'juridica'}, ${d.cpfCnpj ?? null},
      ${d.inscEstadual ?? null}, ${d.inscMunicipal ?? null}, ${d.endereco ?? null}, ${d.complemento ?? null},
      ${d.numero ?? null}, ${d.bairro ?? null}, ${d.cidade ?? null}, ${d.uf ?? null}, ${d.cep ?? null},
      ${d.referencia ?? null}, ${d.email ?? null}, ${d.telefone ?? null}, ${d.nomeContato ?? null}, ${d.observacao ?? null})`);
  return { id: (res[0]?.insertId ?? res.insertId) as number };
}

export async function updateFornecedor(id: number, d: Partial<FornecedorInput>) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE fornecedores SET
    nome = COALESCE(${d.nome ?? null}, nome),
    nomeFantasia = ${d.nomeFantasia ?? null},
    tipo = ${d.tipo ?? null},
    cpfCnpj = ${d.cpfCnpj ?? null},
    inscEstadual = ${d.inscEstadual ?? null},
    inscMunicipal = ${d.inscMunicipal ?? null},
    endereco = ${d.endereco ?? null},
    complemento = ${d.complemento ?? null},
    numero = ${d.numero ?? null},
    bairro = ${d.bairro ?? null},
    cidade = ${d.cidade ?? null},
    uf = ${d.uf ?? null},
    cep = ${d.cep ?? null},
    referencia = ${d.referencia ?? null},
    email = ${d.email ?? null},
    telefone = ${d.telefone ?? null},
    nomeContato = ${d.nomeContato ?? null},
    observacao = ${d.observacao ?? null}
    WHERE id = ${id}`);
}

export async function deleteFornecedor(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE fornecedores SET ativo = FALSE WHERE id = ${id}`);
}


const FORNECEDORES_SEED = [
  { nome: 'GLOBALTEC S/A', nomeFantasia: 'GLOBALTEC S/A', tipo: 'juridica', cpfCnpj: '1664949000159', inscEstadual: 'ISENTO', inscMunicipal: null, endereco: '2º AV. QD.01 LT.42  SL.15/18 ED. ATLANTA B. CENTER', complemento: null, numero: null, bairro: 'VERA CRUZ', cidade: 'APARECIDA DE GOIÂNIA', uf: 'GO', cep: '74905090', referencia: 'CONDOMÍNIO CIDADE EMPRESARIAL', email: 'suporte@uau.com.br' },
  { nome: 'MINISTÉRIO DA FAZENDA', nomeFantasia: 'SECRETARIA DA RECEITA FEDERAL DO BRASIL', tipo: 'juridica', cpfCnpj: '394460000141', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR DE AUTARQUIAS SUL QUADRA 6 BLOCO O', complemento: null, numero: null, bairro: 'Zona Cívico-Administrativa', cidade: 'Brasília', uf: 'DF', cep: '70070917', referencia: null, email: null },
  { nome: 'INSTITUTO NACIONAL DA SEGURIDADE SOCIAL', nomeFantasia: 'INSS', tipo: 'juridica', cpfCnpj: '29979036000140', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'MARC MAX LOCAÇÃO DE EQUIPAMENTOS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'MAX LOCAÇÕES', tipo: 'juridica', cpfCnpj: '31945283000178', inscEstadual: '07.885.902/001-76', inscMunicipal: null, endereco: 'SIA QUADRA 4C BLOCO C, LOTE 23, LOJA 23', complemento: null, numero: '23', bairro: 'ZONA INDÚSTRIAL', cidade: 'BRASÍLIA', uf: 'DF', cep: '71200045', referencia: null, email: 'comercial@maxlocacoes.com.br' },
  { nome: 'OBJETIVA ATACADISTA DA CONSTRUÇÃO LTDA', nomeFantasia: 'OBJETIVA ATACADISTA', tipo: 'juridica', cpfCnpj: '5059270000191', inscEstadual: '07.433.931/001-87', inscMunicipal: null, endereco: 'SGCV LOTE 02', complemento: null, numero: null, bairro: 'ZONA INDUSTRIAL (GUARÁ)', cidade: 'BRASÍLIA', uf: 'DF', cep: '71215520', referencia: null, email: 'reginaldo.objetiva@gmail.com' },
  { nome: 'SR ACABAMENTOS LTDA', nomeFantasia: 'SÓ REPAROS', tipo: 'juridica', cpfCnpj: '26443804000159', inscEstadual: '07.310.431/001-09', inscMunicipal: null, endereco: 'SIA TRECHO 01', complemento: null, numero: '1010', bairro: 'ZONA INDUSTRIAL (GUARÁ)', cidade: 'Brasília', uf: 'DF', cep: '71200010', referencia: null, email: 'paulino@soreparos.com.br' },
  { nome: 'RIACHO TINTAS EIRELI EPP', nomeFantasia: 'RIACHO TINTAS', tipo: 'juridica', cpfCnpj: '3073454000180', inscEstadual: '07.394.721/001-14', inscMunicipal: null, endereco: 'SCLRN 716 BLOCO D', complemento: null, numero: '63', bairro: 'ASA NORTE', cidade: 'Brasília', uf: 'DF', cep: '70770534', referencia: null, email: 'raimundo@riachotintas.com.br' },
  { nome: 'R. CERVELINE REVESTIMENTOS LTDA', nomeFantasia: 'ATELIE DO REVESTIMENTO', tipo: 'juridica', cpfCnpj: '44865657000600', inscEstadual: '07.463.525/002-40', inscMunicipal: null, endereco: 'SAAN QUADRA 5 LOTE 64 LETRA A', complemento: null, numero: null, bairro: 'Zona INDUSTRIALl', cidade: 'BRASILIA', uf: 'DF', cep: '70632500', referencia: null, email: null },
  { nome: 'DAMASCO MATERIAL ELÉTRICO HIDRÁULICO E FERRANGENS LTDA', nomeFantasia: 'DAMASCO', tipo: 'juridica', cpfCnpj: '37054319000452', inscEstadual: '07.331.310/001-88', inscMunicipal: null, endereco: 'SIA TRECHO 17 RUA 10', complemento: null, numero: '495', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200228', referencia: null, email: 'wilson@grupodamasco.com.br' },
  { nome: 'LUCIANA SOUZA DA SILVA', nomeFantasia: 'LUCIANA', tipo: 'fisica', cpfCnpj: '4225133508', inscEstadual: null, inscMunicipal: null, endereco: 'QR 321 CONJUNTO 5', complemento: null, numero: '19', bairro: 'SAMAMBAIA SUL', cidade: 'Brasília', uf: 'DF', cep: '72309305', referencia: null, email: 'luciana@rcengenharia.com.br' },
  { nome: 'KINGSPAN - ISOESTE CONSTRUTIVOS ISOTERMICOS SA', nomeFantasia: 'ISOESTE', tipo: 'juridica', cpfCnpj: '289348000140', inscEstadual: '10.130.779-9', inscMunicipal: null, endereco: 'RUA VP 5D QUADRA 08 MOD. 6/8 E 10/21 -', complemento: null, numero: null, bairro: 'DISTRITO AGROINDUSTRIAL ANÁPOLIS - DAIA', cidade: 'ANAPÓLIS', uf: 'GO', cep: '75132120', referencia: null, email: null },
  { nome: 'PADILHA IMPERMEABILIZANTES LTDA', nomeFantasia: 'PADILHA IMPERMEABILIZANTES', tipo: 'juridica', cpfCnpj: '28899635000191', inscEstadual: '07.831.187/001-19', inscMunicipal: null, endereco: 'QS 5', complemento: null, numero: null, bairro: 'AREAL (AGUAS CLARAS)', cidade: 'BRASILIA', uf: 'DF', cep: '71955000', referencia: null, email: 'chagas@padilha.com.br' },
  { nome: 'RICARDO BARBOSA CARVALHO', nomeFantasia: 'DISK AREIA CRISTALINA', tipo: 'juridica', cpfCnpj: '17027791000146', inscEstadual: '10.554.433-7', inscMunicipal: null, endereco: 'AVENIDA FLAMENGO,QUADRA 29 LOTE 01', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'CRISTALINA', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'RIO DAS PEDRAS MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'TIJOLÃO', tipo: 'juridica', cpfCnpj: '10392814000172', inscEstadual: '10.436.383-5', inscMunicipal: null, endereco: 'AVENIDA FLAMENGO QD 01, LT 06', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ROBERTO RODRIGUES DE OLIVEIRA ME', nomeFantasia: 'AREGRAIA', tipo: 'juridica', cpfCnpj: '13767316000155', inscEstadual: '10.504.114-9', inscMunicipal: null, endereco: 'RUA 98, QD 86 LOTE, 1 CENTRO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CONSTART CONSTRUTORA E ARTEFATOS LTDA', nomeFantasia: 'CONSTART CONSTRUTORA E ARTEFATOS', tipo: 'juridica', cpfCnpj: '9613477000117', inscEstadual: '10.665.532-9', inscMunicipal: null, endereco: 'AV. TIRADENTES QD 44 LOTE 04', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MDR CRISTALINA FERRO E AÇO LTDA', nomeFantasia: 'MDR CRISTALINA FERRO E ACO', tipo: 'juridica', cpfCnpj: '31402674000146', inscEstadual: '10.737.328-9', inscMunicipal: null, endereco: 'AVENIDA FLAMENGO Nº 07 QD 32 LOTE 07', complemento: null, numero: '7', bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PB LOCACOES DE EQUIPAMENTOS LTDA', nomeFantasia: 'PB LOCACOES DE EQUIPAMENTOS', tipo: 'juridica', cpfCnpj: '45728302000119', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 1', complemento: null, numero: null, bairro: 'Residencial Villa Suiça', cidade: 'Cidade Ocidental', uf: 'GO', cep: '72890000', referencia: null, email: null },
  { nome: 'SÃO GERALDO  MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'SAO GERALDO AACABAMENTOS E COMPLEMENTOS', tipo: 'juridica', cpfCnpj: '1034396000312', inscEstadual: '07.313.979/003-46', inscMunicipal: null, endereco: 'STRC TRECHO 03 CONJUNTO  A', complemento: null, numero: null, bairro: 'ZONA INDUSTRIAL GUARÁ', cidade: 'Brasília', uf: 'DF', cep: '71225531', referencia: null, email: null },
  { nome: 'NOVA ATACADISTA PARA CONSTRUÇÃO LTDA', nomeFantasia: 'NOVA ATACADISTA PARA CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '26392294000138', inscEstadual: '07.786.634/001-56', inscMunicipal: null, endereco: 'SMAS', complemento: null, numero: null, bairro: 'ZONA INDUSTRIAL GUARÁ', cidade: 'Brasília', uf: 'DF', cep: '71215300', referencia: null, email: null },
  { nome: 'PRO TELAS COMERCIO E INDUSTRIA LTDA', nomeFantasia: 'PREMOLDADOS 3 IRMÃOS', tipo: 'juridica', cpfCnpj: '569582000121', inscEstadual: '07.317.674/001-05', inscMunicipal: null, endereco: 'QUADRA 1', complemento: null, numero: null, bairro: 'SETOR INDUSTRIAL CEILANDIA', cidade: 'Brasília', uf: 'DF', cep: '72265010', referencia: null, email: null },
  { nome: 'CONCREMINAS CONCRETOS LTDA', nomeFantasia: 'CONCREMINAS', tipo: 'juridica', cpfCnpj: '44363037000150', inscEstadual: null, inscMunicipal: '362015560204202', endereco: 'RUA PROF° MARIA COELI N° 13 CENTRO', complemento: null, numero: null, bairro: null, cidade: 'SÃO GOTARDO', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'HERMAQUINA LOCADORA DE ANDAIMES EIRELI', nomeFantasia: 'HERMAQUINA LOCAÇAO', tipo: 'juridica', cpfCnpj: '37065588000171', inscEstadual: null, inscMunicipal: null, endereco: 'QI 25', complemento: null, numero: null, bairro: 'SETOR INDUSTRIAL TAGUATINGA', cidade: 'Brasília', uf: 'DF', cep: '72135250', referencia: null, email: null },
  { nome: 'CONSTRUÇÃO & CIA', nomeFantasia: 'CONSTRUÇAO E CIA', tipo: 'juridica', cpfCnpj: '34964104000138', inscEstadual: '003.551.890/0040', inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: 'SÃO GOTARDO', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'LIVRARIA E PAPELARIA AGUAS CLARAS LTDA', nomeFantasia: 'LIVRARIA E PAPELARIA AGUAS CLARAS', tipo: 'juridica', cpfCnpj: '8995350000147', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 9 SUL, LOJA 7,8,9 LOTE 15', complemento: null, numero: null, bairro: 'SUL AGUAS CLARAS', cidade: 'Brasília', uf: 'DF', cep: '71938360', referencia: null, email: null },
  { nome: 'REDE DA CONSTRUÇÃO LTDA', nomeFantasia: 'UNIÃO  MATERIAIS DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '10856491000120', inscEstadual: '10.448.257-5', inscMunicipal: null, endereco: 'AV. ANTONIO CAMILO DE ANDRADE QD 41 LT 05/07', complemento: null, numero: null, bairro: 'CRISTALINA', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SERON LOCAÇÃO DE EQUIPAMENTOS PARA CONSTRUÇÃO EIRELI', nomeFantasia: 'SERON LOCAÇÃO', tipo: 'juridica', cpfCnpj: '17858425000139', inscEstadual: '10.562.416-0', inscMunicipal: '36508', endereco: 'AVENIDA AMANSO DE SOUZA FERREIRA, S/N QD 03 LT 09', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'OTIMA LOCADORA DE EQUIPAMENTOS EIRELI', nomeFantasia: 'OTIMA LOCADORA DE EQUIPAMENTOS', tipo: 'juridica', cpfCnpj: '20867365000478', inscEstadual: '07.698.832/002-97', inscMunicipal: null, endereco: 'SIA QUADRA  5-C', complemento: null, numero: null, bairro: 'ZONA INDUSTRIAL - GUARÁ', cidade: 'Brasília', uf: 'DF', cep: '71200055', referencia: null, email: null },
  { nome: 'CERAMICA E TRANSPORTE SANTA ROSA LTDA', nomeFantasia: 'CERAMICA SANT ANA', tipo: 'juridica', cpfCnpj: '37758639000140', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: 'Igaratinga', uf: 'MG', cep: '35695000', referencia: null, email: null },
  { nome: 'ADS CERAMICA LTDA', nomeFantasia: 'ADS CERAMICA', tipo: 'juridica', cpfCnpj: '14766994000166', inscEstadual: '001.887.289/0063', inscMunicipal: null, endereco: 'RUA HELIO FILGUEIRAS 030', complemento: null, numero: null, bairro: 'VARGEM GRANDE', cidade: 'Papagaios', uf: 'MG', cep: '35669000', referencia: null, email: null },
  { nome: 'SANDRA BERENICE LANGER', nomeFantasia: 'SANDRA LANGER', tipo: 'fisica', cpfCnpj: '98278002991', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA EDUARDO DE PAIVA', complemento: null, numero: 'S/N', bairro: 'CIDADE NOVA', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'ciahf.sandra@gmail.com' },
  { nome: 'RC ENGENHARIA', nomeFantasia: 'RC ENGENHARIA', tipo: 'juridica', cpfCnpj: '20549303000175', inscEstadual: '07.687.175/001-56', inscMunicipal: null, endereco: 'QS 01, RUA 212, LOTE 19/23, BLOCO D, SALAS 2104 E 2105 - EDIFÍCIO CONNECT TOWERS', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71950550', referencia: null, email: 'cristiane@rcengenharia.com.br' },
  { nome: 'MADEIREIRA AUTO ELÉTRICA OLIVEIRA SANTOS', nomeFantasia: 'MADEIREIRA OLIVEIRA', tipo: 'juridica', cpfCnpj: '499583000147', inscEstadual: '10.270.192-0', inscMunicipal: null, endereco: 'RUA RIO BRANCO QD 104 LT 11/12', complemento: null, numero: 'S/N', bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MADEIREIRA PARAISO MATERIAIS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'MADEIREIRA PARAISO', tipo: 'juridica', cpfCnpj: '43698517000109', inscEstadual: '10.865.317-0', inscMunicipal: null, endereco: 'Avenida Prefeito José Rodrigues dos Reis', complemento: null, numero: null, bairro: 'Jardim do Ingá', cidade: 'Luziânia', uf: 'GO', cep: '72850140', referencia: null, email: 'madeireiraparaiso@hotamail.com' },
  { nome: 'ALUMITEK ESQUADRIAS DE ALUMINIO EIRELI', nomeFantasia: 'ALUMITEK ESQUADRIAS', tipo: 'juridica', cpfCnpj: '24028385000163', inscEstadual: '.  4.076-2', inscMunicipal: null, endereco: 'RUA RIO BRANCO QD 104 LT 11/12', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'alumitekesquadrias@gmail.com' },
  { nome: 'DOUGLAS HENRIQUE ARRUDA EIRELI', nomeFantasia: 'IZMAC', tipo: 'juridica', cpfCnpj: '14042917000163', inscEstadual: '10.508.318-6', inscMunicipal: null, endereco: 'RUA KALED COSAC S/N QUADRA 03 LOTE 01 A 05', complemento: null, numero: 'S/N', bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'passosfabio@hotmail.com' },
  { nome: 'UF COMÉRCIO DE FERRO E AÇO LTDA', nomeFantasia: 'UNIÃO FERRAGENS', tipo: 'juridica', cpfCnpj: '43690164000109', inscEstadual: '10.867.035-0', inscMunicipal: null, endereco: 'RUA 03 LOTE 17 - SETOR NOROESTE', complemento: null, numero: 'S/N', bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'camilo.uniaoferragensunai@hotmail.com' },
  { nome: 'MELHORES MARCAS COM. E REP. DE FERRAMENTAS LTDA', nomeFantasia: 'MELHORES MARCAS', tipo: 'juridica', cpfCnpj: '4789609000142', inscEstadual: '07.428.874/001-08', inscMunicipal: null, endereco: 'SIA Quadra 5-C', complemento: null, numero: 'S/N', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200055', referencia: null, email: 'jhonatan@melhoresmarcas.com' },
  { nome: 'MUNDIAL CENTER ATACADISTA SA', nomeFantasia: 'MUNDIAL ATACADISTA', tipo: 'juridica', cpfCnpj: '1713958000354', inscEstadual: '0.737.323/003-05', inscMunicipal: null, endereco: 'RODOVIA BR 060 KM 09 COLONIA AGRICOLA VEREDAS CHACARAS', complemento: null, numero: '18A', bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72317800', referencia: null, email: 'otavio.paixao@mundialatacadista.com.br' },
  { nome: 'NEOENERGIA', nomeFantasia: 'NEOENERGIA', tipo: 'juridica', cpfCnpj: '7522669000192', inscEstadual: '07.468.935/001-97', inscMunicipal: null, endereco: 'SMAS', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71219900', referencia: null, email: null },
  { nome: 'CONDOMINIO DO EDIFÍCIO ALFAMIX CENTER', nomeFantasia: 'CONDOMINIO DO EDIFÍCIO ALFAMIX CENTER', tipo: 'juridica', cpfCnpj: '7793032000130', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 204', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'COMPANHIA DE SANEAMENTO AMBIENTAL DO DISTRITO FEDERAL', nomeFantasia: 'CAESB', tipo: 'juridica', cpfCnpj: '82024000137', inscEstadual: '07.324.667/001-67', inscMunicipal: null, endereco: 'Avenida Sibipiruna', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71928720', referencia: null, email: null },
  { nome: 'LUCIANO FERNANDES GOMES', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '83428925149', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 36', complemento: 'APTO 1804 - EDIFICIO VILLA PAVANELLI II', numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71931360', referencia: null, email: 'luciano@rcengenharia.com.br' },
  { nome: 'ADESSO INCORPORADORA LTDA', nomeFantasia: 'ADESSO INCORPORADORA', tipo: 'juridica', cpfCnpj: '49826603000136', inscEstadual: null, inscMunicipal: null, endereco: 'RUA KISLEU DIAS MACIEL, QUADRA 60 LOTE 11', complemento: 'EDIFICIO OURO VERDE', numero: '78', bairro: 'SETOR AEROPORTO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'DEBORAH HORST PORTUGAL', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '5796921169', inscEstadual: null, inscMunicipal: null, endereco: 'EQNP 24/28 Módulo D', complemento: null, numero: '0', bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72235534', referencia: null, email: 'deborah@rcengenharia.com.br' },
  { nome: 'RODRIGO ALVARES DA SILVA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '63514087172', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 9', complemento: 'APTO 602 - EDIFICIO MONTE VERNON', numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71938360', referencia: null, email: null },
  { nome: 'CRISTIANE MARTINS GOMES', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '94157804104', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 36', complemento: 'APTO 1804 EDIFICIO VILLA PAVANELLI II', numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71931360', referencia: null, email: 'cristiane@rcengenharia.com.br' },
  { nome: 'SMART CENTER COMÉRCIO DE MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'SMART CENTER', tipo: 'juridica', cpfCnpj: '19051774002466', inscEstadual: '08.030.049/002-81', inscMunicipal: null, endereco: 'SIA Trecho 3', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'CONDOR ATACADISTA DE MATERIAIS PARA CONSTRUÇÃO', nomeFantasia: 'CONDOR ATACADISTA', tipo: 'juridica', cpfCnpj: '3261204000336', inscEstadual: '00.001.053/965-24', inscMunicipal: null, endereco: 'SIA Trecho 2 LOTE 1630/1740', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: 'gomes@condorbrasil.com.br' },
  { nome: 'ITATIAIA ATACADISTA', nomeFantasia: 'ITATIAIA', tipo: 'juridica', cpfCnpj: '6862927000117', inscEstadual: '07.457.706/001-95', inscMunicipal: null, endereco: 'Trecho SIA Trecho 3 LOTE 54', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200037', referencia: null, email: null },
  { nome: 'TUPER S/A SISTEMAS CONSTRUTIVOS', nomeFantasia: 'TUPER', tipo: 'juridica', cpfCnpj: '81315426001450', inscEstadual: '254447660', inscMunicipal: null, endereco: 'Rua Prefeito Ornith Bollmann', complemento: null, numero: '1709', bairro: 'Brasília', cidade: 'São Bento do Sul', uf: 'SC', cep: '89282427', referencia: null, email: null },
  { nome: 'EP. SIA ALUGUEL DE EQUIPAMENTOS EC', nomeFantasia: 'CASA DO CONSTRUTOR', tipo: 'juridica', cpfCnpj: '34404014000192', inscEstadual: '07.930.553/001-67', inscMunicipal: null, endereco: 'SIA Trecho 4', complemento: null, numero: '13', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200040', referencia: null, email: 'valparaiso@casadoconstrutor.com.br' },
  { nome: 'CRISTALINA FERRO E AÇO LTDA', nomeFantasia: 'CRISTALINA FERRO E AÇO LTDA', tipo: 'juridica', cpfCnpj: '7297360000146', inscEstadual: '10.387.114-4', inscMunicipal: null, endereco: 'RUA PAULO AGUIAR, QUADRA 52 LOTE 03', complemento: null, numero: 'S/N', bairro: 'SETOR NOROESTE', cidade: 'CRISTALINA', uf: 'GO', cep: '73850000', referencia: null, email: 'vendas2@coferpacristalina.com.br' },
  { nome: 'PLANETA FERRAMENTAS E MÁQUINAS LDA', nomeFantasia: 'CASA PLANETA', tipo: 'juridica', cpfCnpj: '19686372000141', inscEstadual: '07.671.379/001-69', inscMunicipal: null, endereco: 'SIA TRECHO 17, RUA 10 - LOTE 495 E 535', complemento: null, numero: 'SN', bairro: 'Setor de Indústrias Bernardo Sayão (Núcleo Bandeirante)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: 'eudesplaneta@gmail.com' },
  { nome: 'LOCALIZA FLEET S/A', nomeFantasia: 'LOCALIZA', tipo: 'juridica', cpfCnpj: '2286479000108', inscEstadual: null, inscMunicipal: '1382560017', endereco: 'Avenida Bernardo de Vasconcelos', complemento: null, numero: '377', bairro: 'Cachoeirinha', cidade: 'Belo Horizonte', uf: 'MG', cep: '31150000', referencia: null, email: 'tributario@localiza.com' },
  { nome: 'PLIMA ASSESSORIA IMOBILIÁRIA LTDA', nomeFantasia: 'PLIMA IMÓVEIS', tipo: 'juridica', cpfCnpj: '12676021000100', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 204 - EDIFÍCIO ALFAMIX SALA 113', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: 'plimaimoveis@hotmail.com' },
  { nome: 'FRANCISCO DE ASSIS COSTA SOUSA', nomeFantasia: 'FRANCISCO DE ASSIS COSTA SOUSA', tipo: 'fisica', cpfCnpj: '1958707198', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 69', complemento: null, numero: '2', bairro: 'Jardim Céu Azul', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72871069', referencia: null, email: 'francisco@rcengenharia.com.br' },
  { nome: 'NOVA ERA COMÉRCIO LTDA', nomeFantasia: 'NOVA ERA COMÉRCIO', tipo: 'juridica', cpfCnpj: '50778933000182', inscEstadual: '08.220.958/001-68', inscMunicipal: null, endereco: 'Área Especial para Indústria 11 Lote 15', complemento: null, numero: '5', bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73050625', referencia: null, email: null },
  { nome: 'RICARDO RODRIGUES ALVES DOS SANTOS', nomeFantasia: 'RICARDO RODRIGUES ALVES DOS SANTOS', tipo: 'fisica', cpfCnpj: '49032461168', inscEstadual: null, inscMunicipal: null, endereco: 'QE 24 LOTE 16 CONJUNTO C', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71060240', referencia: null, email: null },
  { nome: 'PRODESIVO INDUSTRIA E COMÉRCIO LTDA', nomeFantasia: 'PRODESIVO INDUSTRIA E COMÉRCIO', tipo: 'juridica', cpfCnpj: '26500579000145', inscEstadual: '07.315.324/001-13', inscMunicipal: null, endereco: 'CSG 8', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72035508', referencia: null, email: null },
  { nome: 'AKASA MADEIRAS E MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'AKASA', tipo: 'juridica', cpfCnpj: '46604177000106', inscEstadual: '08.140.708/001-12', inscMunicipal: null, endereco: 'Setor Habitacional Sol Nascente', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72236800', referencia: null, email: null },
  { nome: 'JOELI SEBASTIÃO BORGES', nomeFantasia: 'JOELI SEBASTIÃO BORGES', tipo: 'fisica', cpfCnpj: '84716851168', inscEstadual: null, inscMunicipal: null, endereco: 'RUA RIO BRANCO QD 104 LT 11/12', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'HT DE AQUINO COMERCIAL DE ISOLANTES', nomeFantasia: 'ISOPLAN', tipo: 'juridica', cpfCnpj: '16651388000120', inscEstadual: '07.618.078/001-86', inscMunicipal: null, endereco: 'Quadra 1', complemento: null, numero: null, bairro: 'Setor Industrial (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265010', referencia: null, email: null },
  { nome: 'COMERCIAL ALVORADA', nomeFantasia: 'COMERCIAL ALVORADA', tipo: 'juridica', cpfCnpj: '7888247000135', inscEstadual: '07.475.939/001-47', inscMunicipal: null, endereco: 'TR 05 CONJUNTO 05 LOTE 13 - POLO JK', complemento: null, numero: null, bairro: 'SANTA MARIA', cidade: 'Brasília', uf: 'DF', cep: '72549740', referencia: null, email: null },
  { nome: 'IZAIAS MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'ISAIAS MATERIAIS DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '8784942000110', inscEstadual: '10.412.118-1', inscMunicipal: null, endereco: 'RUA MINAS GERAIS QD 39 LOTES 04 E 05', complemento: null, numero: 'S/N', bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'GERDAU AÇOS LONGOS S/A', nomeFantasia: 'COMERCIAL GERDAU', tipo: 'juridica', cpfCnpj: '7358761021832', inscEstadual: '10.128.611-2', inscMunicipal: null, endereco: 'RUA 01 QUADRA 11 LOTES 26 A 35', complemento: null, numero: null, bairro: 'All Park Polo Empresarial', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74985115', referencia: null, email: null },
  { nome: 'EQUATORIAL GOIAIS DISTRIBUIDORA DE ENERGIA S.A', nomeFantasia: 'EQUATORIAL ENERGIA', tipo: 'juridica', cpfCnpj: '1543032000104', inscEstadual: '10.054.942-0', inscMunicipal: null, endereco: 'RUA 2 QD A, N° 505', complemento: null, numero: null, bairro: 'Jardim Goiás', cidade: 'Goiânia', uf: 'GO', cep: '74805180', referencia: null, email: null },
  { nome: 'NEOENERGIA DISTRUBUIDORA BRASILIA S.A', nomeFantasia: 'NEOENERGIA BRASILIA', tipo: 'juridica', cpfCnpj: '7522669000192', inscEstadual: '07.468.935/001-97', inscMunicipal: null, endereco: 'SMAS', complemento: null, numero: null, bairro: 'Zona Industrial (Guará) TRECHO 1 ,LOTE A', cidade: 'Brasília', uf: 'DF', cep: '71219900', referencia: null, email: null },
  { nome: 'EVOLUÇÃO CONTABILIDADE SOCIEDADE SIMPLES', nomeFantasia: 'EVOLUÇÃO', tipo: 'juridica', cpfCnpj: '16656032000180', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 3, LOTE 1530', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200033', referencia: null, email: null },
  { nome: 'MP HOME IMOBILIARIA LTDA ME', nomeFantasia: 'MPHOME IMOBILIARIA', tipo: 'juridica', cpfCnpj: '20336702000158', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 204', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: 'mphomeimobiliaria@gmail.com' },
  { nome: 'SANEAGO DE GOIAS S.A', nomeFantasia: 'SANEAGO', tipo: 'juridica', cpfCnpj: '1616929000102', inscEstadual: '10.013.357-6', inscMunicipal: null, endereco: 'Avenida Fued José Sebba 1245', complemento: null, numero: null, bairro: 'Jardim Goiás', cidade: 'Goiânia', uf: 'GO', cep: '74805100', referencia: null, email: null },
  { nome: 'TELEFÔNICA BRASIL S/A', nomeFantasia: 'VIVO', tipo: 'juridica', cpfCnpj: '2558157000162', inscEstadual: '108383949112', inscMunicipal: null, endereco: 'Avenida Engenheiro Luiz Carlos Berrini, 1376', complemento: null, numero: null, bairro: 'Cidade Monções', cidade: 'São Paulo', uf: 'SP', cep: '04571936', referencia: null, email: null },
  { nome: 'CONSELHO REGIONAL DE ENGENHARIA E AGRONAMIA DE MINAS GERAIS', nomeFantasia: 'CREA- MG', tipo: 'juridica', cpfCnpj: '17254509000163', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida Álvares Cabral, 1600', complemento: null, numero: null, bairro: 'Santo Agostinho', cidade: 'Belo Horizonte', uf: 'MG', cep: '30170917', referencia: null, email: null },
  { nome: 'CONDOMINIO DO EDIFICIO  ALFA MIX CENTER', nomeFantasia: 'ANCORA', tipo: 'juridica', cpfCnpj: '7793032000130', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 204 lote 02 sul', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'IDEIA PLACAS & TOLDOS LDA', nomeFantasia: 'IDEIA PLACAS', tipo: 'juridica', cpfCnpj: '37034088000172', inscEstadual: null, inscMunicipal: '47718', endereco: 'AVENIDA KALED COSAC ESQUINA COM RUA 03', complemento: null, numero: 'S/N', bairro: 'SETOR NORTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'J E LOCACOES DE ANDAIMES LTDA', nomeFantasia: 'SO ENTULHO', tipo: 'juridica', cpfCnpj: '40823507000160', inscEstadual: null, inscMunicipal: null, endereco: 'SCIA Quadra 8 Conjunto 11 lote 14', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71250725', referencia: null, email: null },
  { nome: 'M.A DE OLIVEIRA LTDA', nomeFantasia: 'LIDER ENTULHO', tipo: 'juridica', cpfCnpj: '48568716000116', inscEstadual: null, inscMunicipal: null, endereco: 'ADE Conjunto 12 LOJA 01', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72314712', referencia: null, email: null },
  { nome: 'AILTON CAETANO DE SOUZA', nomeFantasia: 'AILTON CAETANO DE SOUZA', tipo: 'fisica', cpfCnpj: '90935020187', inscEstadual: null, inscMunicipal: null, endereco: 'RUA NOSSA SENHORA DE FÁTIMA, QD 33 LOTE22', complemento: null, numero: 'S/N', bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'AGICOMP FORMAS E COMPENSADOS LTDA', nomeFantasia: 'AGICOMP FORMAS E COMPENSADOS LTDA', tipo: 'juridica', cpfCnpj: '32944323000120', inscEstadual: '908.06774-61', inscMunicipal: null, endereco: 'RUA JOSÉ CAETANO DE OLIVEIRA', complemento: null, numero: '186', bairro: 'FARAJALA BACILA', cidade: 'Palmeira', uf: 'PR', cep: '84130000', referencia: null, email: 'jessica@modanes.com.br' },
  { nome: 'COMPEBRAS INDUSTRIA E COMPERCIO DE MADEIRAS', nomeFantasia: 'COMPEBRAS INDUSTRIA E COMPERCIO DE MADEIRAS', tipo: 'juridica', cpfCnpj: '27178288000145', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Arino de Meira Blanc', complemento: null, numero: '596', bairro: 'Industrial', cidade: 'Guarapuava', uf: 'PR', cep: '85053537', referencia: null, email: 'suely@modanes.com.br' },
  { nome: 'INDUMADE INDUSTRIA E COMERCIO DE MADEIRAS LTDA', nomeFantasia: 'INDUMADE INDUSTRIA E COMERCIO DE MADEIRAS LTDA', tipo: 'juridica', cpfCnpj: '6181227000167', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida Manoel Antônio', complemento: null, numero: '1546', bairro: 'Vila Bela', cidade: 'Guarapuava', uf: 'PR', cep: '85027270', referencia: null, email: 'suely@modanes.com.br' },
  { nome: 'M2ECOPLAC INDUSTRIA DE MADEIRAS LTDA', nomeFantasia: 'ECOPLAC', tipo: 'juridica', cpfCnpj: '32576121000172', inscEstadual: '908.02626-87', inscMunicipal: null, endereco: 'RUA ZENI VEINE DA SILVEIRA N° 520', complemento: null, numero: '520', bairro: 'Centro', cidade: 'Imbituva', uf: 'PR', cep: '84430000', referencia: null, email: null },
  { nome: 'SO ESCRITÓRIO COMÉRCIO DE MOVEIS E EQUIPAMENTOS EIRELI', nomeFantasia: 'DIVULGA MÓVEIS', tipo: 'juridica', cpfCnpj: '25684027000171', inscEstadual: '07.779.537/001-46', inscMunicipal: null, endereco: 'QNE 14 LOTE 12 LOJA 2', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72125140', referencia: null, email: 'divulgamoveis@gmail.com' },
  { nome: 'LCL AGUIAR EIRELI - ME', nomeFantasia: 'DSTAK', tipo: 'juridica', cpfCnpj: '23140493000160', inscEstadual: null, inscMunicipal: null, endereco: 'QNC 7 LOTE 01 LOJA 1', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72115570', referencia: null, email: null },
  { nome: 'AFFINIDADE MÓVEIS PARA ESCRITÓRIO', nomeFantasia: 'AFFINIDADE', tipo: 'juridica', cpfCnpj: '26982290000100', inscEstadual: '07.796.930/001-62', inscMunicipal: null, endereco: 'QR 406 Conjunto 29 LOTE 06 CASA 02', complemento: null, numero: null, bairro: 'Samambaia Norte (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72318231', referencia: null, email: null },
  { nome: 'JVM MATERIAIS DE CONSTRUÇÃO', nomeFantasia: 'CONSTRULAR', tipo: 'juridica', cpfCnpj: '28086699000173', inscEstadual: '10.697.213-8', inscMunicipal: null, endereco: 'RUA RIO DE JANEIRO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'COMÉRCIO DE MADEIRA', nomeFantasia: 'MADEIREIRA ELDORADO', tipo: 'juridica', cpfCnpj: '11130573000156', inscEstadual: '07.526.912/001-97', inscMunicipal: null, endereco: 'QS 114 Conjunto 5', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72302555', referencia: null, email: null },
  { nome: 'COMERCIO DE MADEIRAS', nomeFantasia: 'MADEREIRA ELDORADO', tipo: 'juridica', cpfCnpj: '11130573000156', inscEstadual: null, inscMunicipal: null, endereco: 'QS 114 CONJ 05 LOTE 05', complemento: null, numero: null, bairro: 'SAMAMBAIA -SUL', cidade: 'BRASILIA - DF', uf: null, cep: '72320148', referencia: null, email: null },
  { nome: 'ANTONIO CARLOS PEREIRA DA SILVA EPP', nomeFantasia: 'BRASILIA UTILIDADES', tipo: 'juridica', cpfCnpj: '6945989000192', inscEstadual: '07.693.932/001-00', inscMunicipal: null, endereco: 'Área Especial 20/21', complemento: null, numero: null, bairro: 'Setor Central (Gama)', cidade: 'Brasília', uf: 'DF', cep: '72405922', referencia: null, email: null },
  { nome: 'COPLAS INDÚSTRIA DE PLÁSTICOS LTDA', nomeFantasia: 'COPLAS', tipo: 'juridica', cpfCnpj: '67718726000135', inscEstadual: '442091921115', inscMunicipal: null, endereco: 'Rua Girassol', complemento: null, numero: null, bairro: 'Loteamento Industrial Coral', cidade: 'Mauá', uf: 'SP', cep: '09372030', referencia: null, email: 'coplas@coplas.com.br' },
  { nome: 'JERUEL PLASTICOS INDUSTRIA E COMERCIO LTDA', nomeFantasia: 'JERUEL', tipo: 'juridica', cpfCnpj: '8357463000117', inscEstadual: '407445181119', inscMunicipal: null, endereco: 'Avenida Comendador Antônio Borin', complemento: null, numero: null, bairro: 'Jardim Rosaura', cidade: 'Jundiaí', uf: 'SP', cep: '13218641', referencia: null, email: null },
  { nome: 'N.M. TAUMATURGO COMÉRCIO DE MADEIRAS LTDA', nomeFantasia: 'NATAN MADEIRAS', tipo: 'juridica', cpfCnpj: '41482045000127', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 3 Chácara 88', complemento: null, numero: 'S/N', bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72005790', referencia: null, email: null },
  { nome: 'OLIVEIRA COMERCIO DE TINTAS LTDA', nomeFantasia: 'MS TINTAS', tipo: 'juridica', cpfCnpj: '35493060000178', inscEstadual: null, inscMunicipal: null, endereco: 'QNN 18 Conjunto C', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72220183', referencia: null, email: null },
  { nome: 'CONDOR ATACADISTA DE MATERIAIS PARA CONSTRUÇÃO', nomeFantasia: 'CONDOR ALEXANIA', tipo: 'juridica', cpfCnpj: '3261204000760', inscEstadual: '10.725.066-7', inscMunicipal: null, endereco: 'AV. BRASILIA N- QD 33 LT 10,11,12,CENTRO', complemento: null, numero: null, bairro: 'SETOR CENTRAL - ALEXANIA', cidade: 'ALEXANIA', uf: 'GO', cep: '72290000', referencia: null, email: null },
  { nome: 'ITATIAIA ATACADISTA LTDA -GO', nomeFantasia: 'ITATIAIA ATACADISTA - GOIAS', tipo: 'juridica', cpfCnpj: '6862927000389', inscEstadual: '20.090.257-1', inscMunicipal: null, endereco: 'Quadra 8', complemento: null, numero: null, bairro: 'Valparaiso I - Etapa A', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72876024', referencia: null, email: null },
  { nome: 'SILVEBRAS COMERCIO DE AREIA E CASCALHO LTDA', nomeFantasia: 'ARPLAN AREIA E CASCALHO', tipo: 'juridica', cpfCnpj: '1241196000179', inscEstadual: null, inscMunicipal: null, endereco: 'AREIA ESPECIAL G CONJUNTO A LOTE 06 SMA/SUL', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71215300', referencia: null, email: 'ARPLANCONTATO@GMAIL.COM' },
  { nome: 'ESPAFERRO ESPAÇADORES PARA FERRAGENS LTDA', nomeFantasia: 'ESPAFERRO', tipo: 'juridica', cpfCnpj: '17384956000137', inscEstadual: '442377931118', inscMunicipal: null, endereco: 'Rua das Camélias', complemento: null, numero: '197', bairro: 'Loteamento Industrial Coral', cidade: 'Mauá', uf: 'SP', cep: '09372080', referencia: null, email: null },
  { nome: 'DAMASCO MATERIAIS ELETRICOS E HIDRAULICO E FERRAGENS LTDA', nomeFantasia: 'DAMASCO MATRIZ SIA', tipo: 'juridica', cpfCnpj: '37054319000100', inscEstadual: '07.331.310/001-88', inscMunicipal: null, endereco: 'SIA Trecho 17 Rua 10', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200228', referencia: null, email: 'WILSON@GRUPODAMASCO.COM.BR' },
  { nome: 'CONDOR ATACADISTA D MATERIAIS  PARA CONSTRUÇÃO', nomeFantasia: 'CONDOR ATACADISTA CIDADE DO AUTOMOEL', tipo: 'juridica', cpfCnpj: '3261204000174', inscEstadual: '07.405.106/001-27', inscMunicipal: null, endereco: 'SCIA Quadra 13 Conjunto 1', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71250210', referencia: null, email: null },
  { nome: 'CRISTALINA FERRO E AÇO', nomeFantasia: 'COFERPA FERRO E AÇO', tipo: 'juridica', cpfCnpj: '7297360000146', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PAULO AGUIAR QD 57 LOTE 03', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'H.DA S. CORTEZ COMERCIAL E DESCARTAVEIS LTDA', nomeFantasia: 'COMERCIAL JUNDIAÍ', tipo: 'juridica', cpfCnpj: '22435691000199', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 6 Conjunto 6', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '72001518', referencia: null, email: null },
  { nome: 'FRIGELAR COMERCIO E INDUSTRIA LTDA', nomeFantasia: 'FRIGELAR', tipo: 'juridica', cpfCnpj: '92660406002758', inscEstadual: '08306641-1', inscMunicipal: null, endereco: 'Avenida Lagoa Encantada', complemento: null, numero: null, bairro: 'Vale Encantado', cidade: 'Vila Velha', uf: 'ES', cep: '29113515', referencia: null, email: null },
  { nome: 'DEIVIDE GOMES', nomeFantasia: 'MARMORARIA D GOMES', tipo: 'juridica', cpfCnpj: '21210085000102', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR DO DNER QUADRA 3 LT 10', complemento: null, numero: null, bairro: 'SETOR DNER', cidade: null, uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MARMORARIA E ARDOSIA CRISTALINA LTDA', nomeFantasia: 'MARMORARIA ARDOSIA CRISTALINA', tipo: 'juridica', cpfCnpj: '5375949000190', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA FLAMENGO Nº 07 QD 32 LOTE 07', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PRIMEIRA LINHA COMERCIAL ROLAMENTOS LTDA', nomeFantasia: 'PRIMEIRA LINHA', tipo: 'juridica', cpfCnpj: '24907602000195', inscEstadual: '07.313.203/001-82', inscMunicipal: null, endereco: 'SIA Quadra 4-C', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200045', referencia: null, email: null },
  { nome: 'SIDERURGICA NORTE BRASIL S/A', nomeFantasia: 'SINOBRÁS', tipo: 'juridica', cpfCnpj: '7933914000154', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Ivete Vargas', complemento: null, numero: null, bairro: 'Cidade Nova', cidade: 'Marabá', uf: 'PA', cep: '68501535', referencia: null, email: null },
  { nome: 'FERNANDA FERNANDES DE SOUZA ENGENHARIA', nomeFantasia: 'FFS ENGENHARIA', tipo: 'juridica', cpfCnpj: '53218556000115', inscEstadual: null, inscMunicipal: '18118', endereco: 'RUA DOM SILVEIRO, 107', complemento: null, numero: '107', bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: 'fernanda@rcengenharia.com.br' },
  { nome: 'ELDORADO COMERCIO DE MADEIRAS LTDA', nomeFantasia: 'COMERCIO DE MADEIRAS ELDORADO', tipo: 'juridica', cpfCnpj: '11130573000156', inscEstadual: null, inscMunicipal: null, endereco: 'QS 114 Conjunto 5', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72302555', referencia: null, email: null },
  { nome: 'COMERCIAL GERDAU', nomeFantasia: 'COMERCIAL GERDAU', tipo: 'juridica', cpfCnpj: '7358761027873', inscEstadual: null, inscMunicipal: null, endereco: 'Polo de Desenvolvimento Juscelino Kubitschek Trecho 1 Conjunto 10', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72549550', referencia: null, email: null },
  { nome: 'OLIVEIRA & MARTINS ANDAIMES LTDA', nomeFantasia: 'MARTINS LOCAÇÕES', tipo: 'juridica', cpfCnpj: '11084971000264', inscEstadual: '07.526.149/003-84', inscMunicipal: null, endereco: 'SES Quadra 13', complemento: null, numero: '31', bairro: 'Setor Econômico de Sobradinho (Sobradinho)', cidade: 'Brasília', uf: 'DF', cep: '73020413', referencia: null, email: null },
  { nome: 'MG - MINERAÇÃO GREEN GOLD LTDA', nomeFantasia: 'EDUARDO FERNANDES - ME', tipo: 'juridica', cpfCnpj: '5163702000290', inscEstadual: '10.404.980-4', inscMunicipal: null, endereco: 'RODOVIA BR 040, KM 104', complemento: null, numero: 'S/N', bairro: 'ZONA RURAL  -  FAZENDA SUCUPIRA', cidade: null, uf: 'GO', cep: null, referencia: null, email: null },
  { nome: 'CM SINALIZAÇÃO VISUAL E LETREIROS LTDA ME', nomeFantasia: 'PINCEL PLACAS', tipo: 'juridica', cpfCnpj: '27549920000110', inscEstadual: null, inscMunicipal: null, endereco: 'SMAS Conjunto A', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71215310', referencia: null, email: null },
  { nome: 'MMX LOCAÇÕES DE CONTEINER', nomeFantasia: 'MMX LOCAÇÕES DE CONTEINER', tipo: 'juridica', cpfCnpj: '5018545000149', inscEstadual: null, inscMunicipal: null, endereco: 'EQSW 304/504 LOTE 01 BLOCO 01 SALA 208', complemento: null, numero: '1', bairro: 'Setor Sudoeste', cidade: 'Brasília', uf: 'DF', cep: '70673450', referencia: null, email: null },
  { nome: 'SKS INDÚSTRIA COMÉRCIO E SERVIÇO PARA CONSTRUÇÃO LTDA', nomeFantasia: 'SKS INDÚSTRIA', tipo: 'juridica', cpfCnpj: '31273842000140', inscEstadual: '07.874.025/001-56', inscMunicipal: null, endereco: 'SIA/SO LOTE 24- BLOCO A Nª 24', complemento: null, numero: '24', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71919010', referencia: null, email: null },
  { nome: 'SOMAR OBRAS DE FUNDAÇÕES E PERFURAÇÕES EIRELI', nomeFantasia: 'SOMAR OBRAS DE FUNDAÇÕES E PERFURAÇÕES EIRELI', tipo: 'juridica', cpfCnpj: '22630075000199', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 12 LOTE 01 SALA 103', complemento: null, numero: '1', bairro: 'Vila São José (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693013', referencia: null, email: 'somarfundacoes@gmail.com' },
  { nome: 'SMART CENTER COMÉRCIO DE MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'ESPAÇO SMART', tipo: 'juridica', cpfCnpj: '19051774003357', inscEstadual: '08.030.049/003-62', inscMunicipal: null, endereco: 'SIA Trecho 3', complemento: null, numero: '1340', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'STEEL TECH CONSTRUÇÕES À SECO LTDA', nomeFantasia: 'STEEL BSB TELHADOS SHINLGE', tipo: 'juridica', cpfCnpj: '44865787000120', inscEstadual: null, inscMunicipal: null, endereco: 'SHCGN CLR 705 BLOCO E LOJA 08 KB', complemento: null, numero: '8', bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70730555', referencia: null, email: 'contato@steelbsb.com.br' },
  { nome: 'D DOS R VIEIRA MATERIAIS DE CONSTRUÇÃO ME', nomeFantasia: 'DANIEL TELHADOS', tipo: 'juridica', cpfCnpj: '26707172000193', inscEstadual: '07.793.416/001-39', inscMunicipal: null, endereco: 'SHA  CONJ 04 CHACARA 15 LT 01 A', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71994085', referencia: null, email: 'danieltelhadodf@gmail.com' },
  { nome: 'ARPLAN AREIA DO PLANALTON', nomeFantasia: '53240200853416004262378139995845999286288384', tipo: 'juridica', cpfCnpj: '853416000152', inscEstadual: '07.664.255/001-84', inscMunicipal: null, endereco: 'SMAS', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71215300', referencia: null, email: null },
  { nome: 'CINDY B. JARDIM IZAIAS EIRELI', nomeFantasia: 'IZMAC', tipo: 'juridica', cpfCnpj: '31016232000161', inscEstadual: '10.734.709-1', inscMunicipal: null, endereco: 'RUA 07 DE SETEMBRO QD L LOTE 40 S/N', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MONTEPEDRA MARMORARIA E MÓVEIS PLANEJADOS LTDA', nomeFantasia: 'MONTEPEDRA', tipo: 'juridica', cpfCnpj: '3762058000160', inscEstadual: null, inscMunicipal: null, endereco: 'Q 21 LOTES 07 E 09 SETOR INDUSTRIAL', complemento: null, numero: 'S/N', bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265210', referencia: null, email: null },
  { nome: 'GERDAU AÇOS LONGOS S/A', nomeFantasia: 'GERDAL AÇOS LONGOS', tipo: 'juridica', cpfCnpj: '7358761000401', inscEstadual: '10.360.536-3', inscMunicipal: null, endereco: 'RUA 01 QUADRA 11 LOTE 26 A 35', complemento: null, numero: null, bairro: 'All Park Polo Empresarial', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74985115', referencia: null, email: null },
  { nome: 'ROGUS COM. DE MATERIAIS DE CONSTRUÇÃO EIRELI', nomeFantasia: 'MADEIREIRA ROGUS', tipo: 'juridica', cpfCnpj: '28849821000116', inscEstadual: '07.830.325/001-89', inscMunicipal: null, endereco: 'SETOR PLACA DAS MERCEDES', complemento: null, numero: '5', bairro: 'Núcleo Bandeirante', cidade: 'Brasília', uf: 'DF', cep: '71732050', referencia: null, email: null },
  { nome: 'R G TOLENTINO COMERCIO DE LIVROS EMPRESA', nomeFantasia: 'PAPELARIA REAL', tipo: 'juridica', cpfCnpj: '28246434000195', inscEstadual: '07.819.169/001-19', inscMunicipal: null, endereco: 'AVENIDA ARAUCARIAS LT 305 LOJA 45', complemento: null, numero: null, bairro: 'AGUAS CLARAS', cidade: null, uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'GERDAU AÇOS E LONGOS', nomeFantasia: 'GERDAU AÇOS E LONGOS', tipo: 'juridica', cpfCnpj: '7358761027873', inscEstadual: '07.493.578/003-78', inscMunicipal: null, endereco: 'Polo de Desenvolvimento Juscelino Kubitschek Trecho 1 Conjunto 10', complemento: null, numero: 'SN', bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72549550', referencia: null, email: null },
  { nome: 'ABBRITA AREIA E BRITA DE BRASÍLIA LTDA', nomeFantasia: 'ABBRITA AREIA E BRITA', tipo: 'juridica', cpfCnpj: '72590201000105', inscEstadual: '07.342.292/001-67', inscMunicipal: null, endereco: 'SPLM CONJUNTO 14 LOTE 06', complemento: null, numero: '6', bairro: 'Núcleo Bandeirante', cidade: 'Brasília', uf: 'DF', cep: '71710300', referencia: null, email: null },
  { nome: 'MENDES AREIA E CASCALHO LTDA', nomeFantasia: 'MENDES AREIA', tipo: 'juridica', cpfCnpj: '37024031000435', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PADRE ANTÔNIO VIEIRA, LOTE 45, LOTE 13 E 14', complemento: null, numero: '13', bairro: 'PARQUE ESTRELA DALVA I', cidade: null, uf: 'GO', cep: '72500418', referencia: null, email: null },
  { nome: 'DR UNIFORMES LTDA', nomeFantasia: 'DR UNIFORMES', tipo: 'juridica', cpfCnpj: '11139140000161', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 404 CONJUNTO 15 ,11', complemento: null, numero: '15', bairro: 'Recanto das Emas', cidade: 'Brasília', uf: 'DF', cep: '72630415', referencia: null, email: null },
  { nome: 'ADEDO UNIFORMES', nomeFantasia: 'ADEDO UNIFORMES', tipo: 'juridica', cpfCnpj: '1138322000164', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR IAPI LOTE J', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71070300', referencia: null, email: null },
  { nome: 'ARTVESTE CONFECÇÕES DE UNIFORMES LTDA', nomeFantasia: 'ARTVESTE', tipo: 'juridica', cpfCnpj: '38069811000111', inscEstadual: null, inscMunicipal: null, endereco: 'ASA SUL', complemento: null, numero: null, bairro: 'ASA SUL', cidade: 'BRASILIA', uf: null, cep: '70364510', referencia: null, email: null },
  { nome: 'VOTORANTIM CIMENTO S.A.', nomeFantasia: 'VOTORANTIM CIMENTO', tipo: 'juridica', cpfCnpj: '1637895007498', inscEstadual: '00.001.040/327-90', inscMunicipal: null, endereco: 'RODOVIA DF 150', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73070043', referencia: null, email: null },
  { nome: 'MAKMAQ LOCAÇÕES E SERVIÇOS LTDA', nomeFantasia: 'MAKMAQ LOCAÇÕES', tipo: 'juridica', cpfCnpj: '13372493000132', inscEstadual: '08.186.447/001-77', inscMunicipal: null, endereco: 'CND 05, LOTE 17  LOJA 02', complemento: null, numero: '5', bairro: 'TAGUATINGA', cidade: 'Brasília', uf: 'DF', cep: '72120055', referencia: null, email: null },
  { nome: 'DIEGO PAULO CANTUARIO DE SOUZA', nomeFantasia: 'DIEGO PAULO CANTUARIO DE SOUZA', tipo: 'juridica', cpfCnpj: '27981944000143', inscEstadual: '07.815.624/001-34', inscMunicipal: null, endereco: 'QR 409 CONJUNTO 5 Nº07', complemento: null, numero: null, bairro: 'Samambaia Norte (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72321105', referencia: null, email: null },
  { nome: 'CIAIMPER BRASÍLIA ATACADISTA LTDA', nomeFantasia: 'CIAIMPER BRASÍLIA', tipo: 'juridica', cpfCnpj: '10207825000135', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 17 RUA 05', complemento: null, numero: '5', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200213', referencia: null, email: null },
  { nome: 'CENTRO OESTE INDÚSTRIA E COMÉRCIO DE FERRAGENS LTDA', nomeFantasia: 'CENTRO OESTE INDÚSTRIA', tipo: 'juridica', cpfCnpj: '37096452000129', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PAULO AGUIAR   S/N  - QUADRA 52  LOTE 12', complemento: null, numero: 'S/N', bairro: 'CENTRO', cidade: null, uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'IGTEK CONSTRUÇÕES COMÉRCIO E LOCAÇÃO LTDA', nomeFantasia: 'IGTEK CONSTRUÇÕES COMÉRCIO E LOCAÇÃO LTDA', tipo: 'juridica', cpfCnpj: '7619423000133', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 101, CONJ. 12  - LOTE 15', complemento: null, numero: '15', bairro: null, cidade: null, uf: 'DF', cep: '71698028', referencia: null, email: 'igtek.construtora@hotmail.com' },
  { nome: 'SHOPPING TELHAS INDÚSTRIA E RECORTES LTDA', nomeFantasia: 'SHOPPING TELHAS', tipo: 'juridica', cpfCnpj: '40407503000109', inscEstadual: null, inscMunicipal: null, endereco: 'RUA DONA TUTA', complemento: null, numero: '86', bairro: 'JARDIM COLONIAL', cidade: 'Catalão', uf: 'GO', cep: '75710713', referencia: null, email: null },
  { nome: 'ALBRA ALUMÍNIO BRASÍLIA LTDA', nomeFantasia: 'ALBRA ALUMÍNIO', tipo: 'juridica', cpfCnpj: '37108719000150', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 02,  LOTES 505-515', complemento: null, numero: '505', bairro: null, cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'MUNDO DO CONSTRUTOR PARA CONSTRUÇÃO LTDA', nomeFantasia: 'MUNDO DO CONSTRUTOR', tipo: 'juridica', cpfCnpj: '26976050000100', inscEstadual: null, inscMunicipal: null, endereco: 'QI 2 SETOR INDUSTRIAL', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135020', referencia: null, email: null },
  { nome: 'ISOPORTEC COMERCIO E INDUSTRIA DE ISOLANTE TERMICO LTDA', nomeFantasia: 'ISOPORTEC', tipo: 'juridica', cpfCnpj: '5618666000121', inscEstadual: '10.405.846-3', inscMunicipal: null, endereco: 'SETOR SOLAR SANTA RITA', complemento: null, numero: null, bairro: 'Setor Solar Santa Rita', cidade: 'Goiânia', uf: 'GO', cep: '74393351', referencia: null, email: 'comercial@isoportec.com.br' },
  { nome: 'DIV TERM TECNOMOLDURA', nomeFantasia: 'DIV TERM TECNOMOLDURA', tipo: 'juridica', cpfCnpj: '66023425000124', inscEstadual: '113094418113', inscMunicipal: null, endereco: 'barra funda', complemento: null, numero: null, bairro: 'Barra Funda', cidade: 'São Paulo', uf: 'SP', cep: '01154050', referencia: null, email: 'vendas@tecnomoldura.com.br' },
  { nome: 'AMARAL INDÚSTRIA CERÂMICA LTDA', nomeFantasia: 'CERÂMICA MUNDIAL', tipo: 'juridica', cpfCnpj: '11659977000131', inscEstadual: '10.825.795-9', inscMunicipal: null, endereco: 'RODOVIA GO 330, S/N', complemento: null, numero: 'S/N', bairro: 'Área Rural de Anápolis', cidade: 'Anápolis', uf: 'GO', cep: '75000001', referencia: null, email: null },
  { nome: 'DECORPOL INDUSTRIA E COMÉRCIO LTDA - ME', nomeFantasia: 'DECORPOL INDÚSTRIA', tipo: 'juridica', cpfCnpj: '6172414000184', inscEstadual: '903.03272-30', inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: 'Curitiba', uf: 'PR', cep: '81945020', referencia: null, email: null },
  { nome: 'ABR CALDAS CONSTRUÇÕES ELÉTRICAS LTDA', nomeFantasia: 'ABR CALDAS CONSTRUÇÕES ELÉTRICAS LTDA', tipo: 'juridica', cpfCnpj: '18740336000156', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 07 Quadra 130 Lote 04, nº 36', complemento: null, numero: null, bairro: 'Formosinha', cidade: 'Formosa', uf: 'GO', cep: '73813420', referencia: null, email: 'luzaconsultoria@gmail.com' },
  { nome: 'JULIO CESAR DE SIQUEIRA', nomeFantasia: 'JULIO CESAR DE SIQUEIRA', tipo: 'juridica', cpfCnpj: '48559351000163', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 04 Sn, Quadra 17, Lote 2', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'cesarsiqueira010@gmail.com' },
  { nome: 'PBTECH COMÉRCIO E SERVIÇOS DE REVESTIMENTOS CERÂMICOS LTDA', nomeFantasia: 'PORTOBELLO SHOP', tipo: 'juridica', cpfCnpj: '5876012002222', inscEstadual: '07.876.548/002-27', inscMunicipal: null, endereco: 'TRECHO 02, SN, LOTE 995-1005', complemento: null, numero: '1005', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: 'brasilia.sia@portobelloshop.com.br' },
  { nome: 'LAJESPLAN PREMOLDADOS INDUSTRIA E COMERCIO LTDA', nomeFantasia: 'LAJESPLAN', tipo: 'juridica', cpfCnpj: '2246291000128', inscEstadual: '07.379.373/001-05', inscMunicipal: null, endereco: 'QI 25 lote 42 a 47', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135250', referencia: null, email: null },
  { nome: 'LAJES LIDER', nomeFantasia: 'LAJES LIDER', tipo: 'juridica', cpfCnpj: '3292721000100', inscEstadual: '07.399.336/001-00', inscMunicipal: null, endereco: 'QN 306 CONJUNTO 05 LOTE 06', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72306200', referencia: null, email: null },
  { nome: 'GUARA LAJES E CONSTRUÇÕES LTDA', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '26328149000198', inscEstadual: null, inscMunicipal: null, endereco: 'COLONIA AGRICULA AGUAS CLARAS 36', complemento: null, numero: null, bairro: 'Guará I', cidade: 'Brasília', uf: 'DF', cep: '71090435', referencia: null, email: 'rpccontab@gmail.com' },
  { nome: 'LOCTRAD LOCADORA DE EQUIPAMENTOS LTDA', nomeFantasia: 'LOCTRAD', tipo: 'juridica', cpfCnpj: '22154828000137', inscEstadual: '07.715.286/001-96', inscMunicipal: null, endereco: 'QI 09 LOJA 57', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135250', referencia: null, email: null },
  { nome: 'HERMAQUINAS LOCADORA DE ANDAIMES', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '37065588000171', inscEstadual: '07.309.794/001-78', inscMunicipal: null, endereco: 'QI 25 LOTE 40/41', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135250', referencia: null, email: null },
  { nome: 'PB LOCACOES DE EQUIPAMENTOS LTDA', nomeFantasia: 'PB LOCAÇÕES', tipo: 'juridica', cpfCnpj: '45728302000119', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PADRE JOSÉ BORSATO, 823 QUADRA 02 ,LOTE 1', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'CRISTALINA', uf: 'GO', cep: '72890000', referencia: null, email: null },
  { nome: 'CERÂMICA ALIANÇA LTDA', nomeFantasia: 'CERÂMICA ALIANÇA LTDA', tipo: 'juridica', cpfCnpj: '2305373000104', inscEstadual: null, inscMunicipal: null, endereco: 'Rodovia GO-330, - km-8  -   ZONA RURAL', complemento: null, numero: null, bairro: 'Bom Sucesso', cidade: 'Anápolis', uf: 'GO', cep: '75000001', referencia: null, email: 'cer.alianca@hotmail.com' },
  { nome: 'AC COELHO MATERIAIS  CONSTRUÇÃO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: null, inscEstadual: 'AC COELHO MAT. CONSTRUÇÃO', inscMunicipal: null, endereco: '1-Temporário', complemento: '1 - Jurídica', numero: '37083474000154', bairro: '07.309.426/001-57', cidade: null, uf: 'SIA Trecho 3', cep: null, referencia: null, email: 'Zona Industrial (Guará)' },
  { nome: 'MOISANIEL SARAIVA GOMES', nomeFantasia: 'AMIGO LOC', tipo: 'fisica', cpfCnpj: '77069262120', inscEstadual: null, inscMunicipal: null, endereco: 'RUA MINAS GERAIS N° 80', complemento: null, numero: null, bairro: 'MINAS GERAIS', cidade: null, uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'WL ATACADISTA LTDA', nomeFantasia: 'WL DE OLIVEIRA', tipo: 'juridica', cpfCnpj: '21997241000127', inscEstadual: '07.711.938/001-13', inscMunicipal: null, endereco: 'SIA Trecho 2 LOTES 785/795', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'MARMORARIA D GOMES', nomeFantasia: 'MARMORARIA D GOMES', tipo: 'juridica', cpfCnpj: '21210085000102', inscEstadual: null, inscMunicipal: null, endereco: 'RUA JOÃO GOMES QD 03 LOTE10', complemento: null, numero: null, bairro: 'SETOR DNER', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'marmorariadgomes@outlook.com' },
  { nome: 'RIBEIRO ENGENHARIA E COMÉRCIO', nomeFantasia: 'SHOWROOM DO GRANITO', tipo: 'juridica', cpfCnpj: '34625885000136', inscEstadual: null, inscMunicipal: null, endereco: 'QS 413 CONJUNTO A LOTE 06', complemento: null, numero: null, bairro: 'Samambaia Norte (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72321571', referencia: null, email: 'showroomdosgranitos@gmail.com' },
  { nome: 'GIGAPEL INFORMATICA ESCRITORIO E PAPELARIA LTDA', nomeFantasia: 'GIGAPEL PAPELARIA E INFORMATICA', tipo: 'juridica', cpfCnpj: '8705977000116', inscEstadual: null, inscMunicipal: null, endereco: 'Área ADE - Conj. 06 - nº 10', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71987000', referencia: null, email: 'contato@gigapelpapelaria.com.br' },
  { nome: 'D M COMERCIAL DE ISOLANTES TERMICOS LTDA', nomeFantasia: 'ISOPLAN', tipo: 'juridica', cpfCnpj: '43561585000121', inscEstadual: '08.084.780/001-42', inscMunicipal: null, endereco: 'ST DE INDUSTRIA QI 1, LOTE 78/80 CEILANDIA', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265010', referencia: null, email: null },
  { nome: 'FERNANDO GIBATHE SCHIER', nomeFantasia: 'SCHIER MOVEIS', tipo: 'juridica', cpfCnpj: '31970349000180', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Emília Ferreira Schiffer, 105', complemento: null, numero: null, bairro: 'Boa Vista', cidade: 'Ponta Grossa', uf: 'PR', cep: '84072095', referencia: null, email: null },
  { nome: 'SHOPPING ENXOVAIS E UTILIDADES TUDO PARA SEU LAR S.A', nomeFantasia: 'ENXOVAIS PAULISTA', tipo: 'juridica', cpfCnpj: '42737380001678', inscEstadual: '08.070.005/010-67', inscMunicipal: null, endereco: 'QUADRA C 8, 32', complemento: null, numero: null, bairro: 'Taguatinga Centro (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72010080', referencia: null, email: null },
  { nome: 'IMPERIO EXTINTORES E SEGURANÇA LTDA', nomeFantasia: 'IMPERIO EXTINTORES', tipo: 'juridica', cpfCnpj: '51698103000108', inscEstadual: null, inscMunicipal: null, endereco: 'AREIA DE DESENVOLVIMENTO ECONOMICO', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71989300', referencia: null, email: null },
  { nome: 'EXTINTUR TECNOLOGIA CONTRA INCENDIO COMERCIO E SERVIÇO LTDA', nomeFantasia: 'ENTINTUR', tipo: 'juridica', cpfCnpj: '557595000180', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR  SIA/ SUL QD 4C , CENTRO COMERCIAL LOTE  LOJA', complemento: null, numero: null, bairro: 'SETOR DE INDUSTRIA', cidade: null, uf: 'DF', cep: '72200045', referencia: null, email: null },
  { nome: 'JTB CONSTRUÇOES E COMERCIO DE MADEIRAS LTDA', nomeFantasia: 'ATACADÃO  DA MADEIRA', tipo: 'juridica', cpfCnpj: '32310177000180', inscEstadual: null, inscMunicipal: null, endereco: 'SHPV MARGINAL EPTG CH 55 LOTE 05', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72005310', referencia: null, email: null },
  { nome: 'PROJESOLO ENGENHARIA E TOPOGRAFIA LTDA', nomeFantasia: 'PROJESOLO', tipo: 'juridica', cpfCnpj: '21036384000172', inscEstadual: null, inscMunicipal: null, endereco: 'FEIRA PERMANENTE, ARFERV LOJA 46', complemento: null, numero: null, bairro: 'Valparaiso II', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72876102', referencia: null, email: null },
  { nome: 'RENAFER COMÉRCIO,IMPORTAÇÃO E EXPORTAÇÃO DE ARTEFATOS DE MADEIRA LTDA', nomeFantasia: 'PROJEARTE MARCENARIA E DECORAÇÕES', tipo: 'juridica', cpfCnpj: '559587000173', inscEstadual: '407265129119', inscMunicipal: null, endereco: 'RUA JOSÉ DO PATROCINIO', complemento: null, numero: null, bairro: 'Jardim São Bento', cidade: 'Jundiaí', uf: 'SP', cep: '13202460', referencia: null, email: null },
  { nome: 'UNAMIX INDUSTRIA DE CONCRETO LTDA', nomeFantasia: 'UNAMIX INDUSTRIA DE CONCRETO', tipo: 'juridica', cpfCnpj: '37368194000273', inscEstadual: null, inscMunicipal: '48317', endereco: 'RUA RIO GRANDE DO SUL , N° SN 103 LT 01', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'STARKEN SEGURANÇA E MONITORAMENTO LTDA', nomeFantasia: 'STARKEN SEGURANÇA', tipo: 'juridica', cpfCnpj: '16888526000190', inscEstadual: null, inscMunicipal: '36349', endereco: 'RUA 03,S/N QD 12 LOTE 03', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'J.V. EVOLUÇÃO SEGURAÇA DO TRABALHO E DESENVOLVIMENTO PROFISSIONAL LTDA', nomeFantasia: 'J.V.EVOLUÇÃO SEGURANÇA DO TRABALHO', tipo: 'juridica', cpfCnpj: '26463545000128', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 03, S/N QD 14 LOTE 08', complemento: null, numero: null, bairro: 'JARDIM PLANALTO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ALINE COMÉRCIO E SERVIÇOS LTDA ME', nomeFantasia: 'ALINE COPIADORA', tipo: 'juridica', cpfCnpj: '32913907000138', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 4C BLOCO C LOJA 15', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200048', referencia: null, email: null },
  { nome: 'LDA ENGENHARIA LTDA', nomeFantasia: 'CP CONTROLE TECNOLOGICO', tipo: 'juridica', cpfCnpj: '2910758000192', inscEstadual: '07.392.213/001-47', inscMunicipal: null, endereco: 'SCIA QUADRA 8 CONJUNTO 15 LOTE 08', complemento: null, numero: 'S/N', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71250745', referencia: null, email: null },
  { nome: 'RENATA MORANDI MACHADO LOTTI PAISAGISMO ME', nomeFantasia: 'RIVIVERE PAISAGISMO PERMANTE', tipo: 'juridica', cpfCnpj: '28883748000107', inscEstadual: '118775947115', inscMunicipal: '58297227', endereco: 'RUA CONDE DE SARZEDAS, 22 SALA 03', complemento: null, numero: null, bairro: 'Sé', cidade: 'São Paulo', uf: 'SP', cep: '01512000', referencia: null, email: 'renata@rivivere.com.br' },
  { nome: 'SAGA INDUSTRIAL E COMERCIAL LTDA', nomeFantasia: 'SAGA TINTAS', tipo: 'juridica', cpfCnpj: '23077527000110', inscEstadual: null, inscMunicipal: null, endereco: 'RUA GOIAS QUADRA D LOTE 400 S/N', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'sagatintas@gmail.com' },
  { nome: 'ALCIENE DOS SANTOS AMORIM', nomeFantasia: 'SYSTEM RELOGIO DE PONTO', tipo: 'juridica', cpfCnpj: '28617347000105', inscEstadual: null, inscMunicipal: null, endereco: 'CONDOMINIO ECOLOGICO PARQUE MIRANTE', complemento: null, numero: null, bairro: null, cidade: 'Santa Maria', uf: 'GO', cep: '72595630', referencia: null, email: 'aliene_96@hotmail.com' },
  { nome: 'SV TRANSPORTES  DE CARGAS LTDA ME CSV - TRANSPORTE', nomeFantasia: 'SEVERO TRANSPORTES', tipo: 'juridica', cpfCnpj: '15378772000139', inscEstadual: null, inscMunicipal: '760517900171', endereco: 'QD 204 CJ 23 LT 5', complemento: null, numero: null, bairro: 'Recanto das Emas', cidade: 'Brasília', uf: 'DF', cep: '72610423', referencia: null, email: null },
  { nome: 'CRISTAL  MUNCK SERVICOS EPECIALIZADOS LTDA', nomeFantasia: 'CRISTAL MUNCK', tipo: 'juridica', cpfCnpj: '32619107000109', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 04, S/N°,QD 08 LOTE 01 CRISTALINA', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SCCAP CONSULTORIA E ENGENHARIA LTDA', nomeFantasia: 'SCCAP CONSULTORIA ENGENHARIA', tipo: 'juridica', cpfCnpj: '29427593000159', inscEstadual: '07.840.160/001-32', inscMunicipal: null, endereco: 'ESPECIAL 01 ENTRE QD 55/56 MEZANINO DAS LOJAS', complemento: null, numero: null, bairro: 'Setor Central (Gama)', cidade: 'Brasília', uf: 'DF', cep: '72405610', referencia: null, email: null },
  { nome: 'MILTON MUNCK LTDA', nomeFantasia: 'MILTON MUNCK', tipo: 'juridica', cpfCnpj: '44168568000191', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA KALED COSAC,N°99 QD J LOTE 354', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'AMARILDO DA SILVA OLIVEIRA', nomeFantasia: 'LOCAÇÃO DE CARRO', tipo: 'fisica', cpfCnpj: '92018130153', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 02 BLOCO M APTO 204', complemento: null, numero: null, bairro: 'Setor Tradicional (Planaltina)', cidade: 'Brasília', uf: 'DF', cep: '73350213', referencia: null, email: null },
  { nome: 'KAYLLANY FREITAS DOS SANTOS', nomeFantasia: 'SERVIÇOS TOPOGRÁFICOS', tipo: 'juridica', cpfCnpj: '45830258000153', inscEstadual: null, inscMunicipal: null, endereco: 'QR 405 CONJUNTO 5, LOTE 14', complemento: null, numero: null, bairro: 'Samambaia Norte (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72319205', referencia: null, email: 'cleber.gktopografia@gmail.com' },
  { nome: 'SILVIO PEDRO GONÇALVES ALENCAR', nomeFantasia: 'EBBER PLOTAGENS', tipo: 'juridica', cpfCnpj: '5235252000113', inscEstadual: '07.437.050/001-07', inscMunicipal: null, endereco: 'SIA QUADRA 5-C GUARA', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200055', referencia: null, email: null },
  { nome: 'MATHEUS PEREIRA DA COSTA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '70816951160', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA F. QD 24, LOTE 24', complemento: null, numero: null, bairro: 'CIDADE NOVA', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'INOVE SOLUÇOES DE MERCADOLOGICAS  LTDA', nomeFantasia: 'INOVE  SOLUÇOES', tipo: 'juridica', cpfCnpj: '17880004000104', inscEstadual: '143367937113', inscMunicipal: null, endereco: 'RUA LUIZA CONTAT,50 CASA 1 VILA LIVIERO', complemento: null, numero: null, bairro: 'Vila Liviero', cidade: 'São Paulo', uf: 'SP', cep: '04187270', referencia: null, email: null },
  { nome: 'KARINNY BATISTA DA SILVA NAZAR', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '24837423000129', inscEstadual: null, inscMunicipal: null, endereco: 'ARLINDO AGUIAR, S/N', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'nazargrafica@yahoo.com' },
  { nome: 'PADRÃO ENGENHARIA INDUSTRIA E COMÉRCIO LTDA', nomeFantasia: 'PADRÃO ENGENHARIA IND. E COMÉRCIO', tipo: 'juridica', cpfCnpj: '1037657000196', inscEstadual: null, inscMunicipal: null, endereco: 'SEE QD 07 LOTE 14', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73020407', referencia: null, email: 'contabilidade@padraoindustria.com.br' },
  { nome: 'ANDAIMES MARTINS TAGUATINGA LTDA', nomeFantasia: 'ANDAIMES MARTINS', tipo: 'juridica', cpfCnpj: '3025011000114', inscEstadual: null, inscMunicipal: '763222900159', endereco: 'RUA 4A BLOCOS 1 TRAVESSA 02 MODULO N 11', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '72006203', referencia: null, email: null },
  { nome: 'RAINHA DO GESSO E COMÉRCIO', nomeFantasia: 'RAINHA DO GESSO E COMÉRCIO LTDA', tipo: 'juridica', cpfCnpj: '11685352000144', inscEstadual: '07.536.081/001-40', inscMunicipal: null, endereco: 'SHA CONJUNTO 06, LOTE D Nª 463', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71996350', referencia: null, email: 'COMERCIAL@RAINHADOGESSO.COM.BR' },
  { nome: 'EZL MULTIARTIGOS LTDA', nomeFantasia: 'EZL MULTIARTIGOS', tipo: 'juridica', cpfCnpj: '48077172000190', inscEstadual: '08.169.501/001-42', inscMunicipal: null, endereco: 'ADE CONJUNTO 16 LOTE 06 LOJA 01', complemento: null, numero: null, bairro: 'Área de Desenvolvimento Econômico (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71988720', referencia: null, email: 'zaque.lucci@gmail.com' },
  { nome: 'REAL COMÉRCIO E INSTALAÇÕES INDUSTRIAIS LTDA', nomeFantasia: 'REAL COMÉRCIO E INSTALAÇÕES', tipo: 'juridica', cpfCnpj: '10264667000155', inscEstadual: null, inscMunicipal: '750803000163', endereco: 'QNG 29 LOTE 02 LOJA 05 E 06 S/N', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72130290', referencia: null, email: null },
  { nome: 'COE COELHO E CIA LTDA', nomeFantasia: 'CASA IRACEMA TUBOS E CONEXÕES', tipo: 'juridica', cpfCnpj: '1535467000794', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO II945', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200015', referencia: null, email: 'vendasbsb@casairacema.com.br' },
  { nome: 'CONSTRUTORA AVILA DE AZEVEDO EIRELI', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '37064680000117', inscEstadual: null, inscMunicipal: '731843200175', endereco: 'QD 8 CONJ 15 LOTE 8', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71250745', referencia: null, email: 'proceso@pollacontadores.com.br' },
  { nome: 'MICHELSEN BEZERRA BORGES', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '6343235124', inscEstadual: null, inscMunicipal: null, endereco: 'RUA TAPUMES Nº 102', complemento: null, numero: null, bairro: 'SETOR AEROPORTO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'REGIVALDO DIAS DE SOUSA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '70708630120', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 10 CASA 100', complemento: null, numero: null, bairro: 'São Francisco (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693321', referencia: null, email: 'regivaldodiasdf@gmail.com' },
  { nome: 'FREDERICO GONÇALVES RODRIGUES', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '9617651602', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 13 CASA 12', complemento: null, numero: null, bairro: 'Vila São José (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693014', referencia: null, email: 'fredericogoncalves2016@gmail.com' },
  { nome: 'FINITURA MATERIAIS PARA CONTRUÇÃO E ACABAMENTOS', nomeFantasia: 'FINITURA MATERIAIS PARA ACABAMENTOS CONSTRUÇÃO E ACABAMENTOS', tipo: 'juridica', cpfCnpj: '30093717000196', inscEstadual: '07.852.885/001-25', inscMunicipal: null, endereco: 'SIA TRECHO 02 LOTES 845 ,875', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'GRAVIA IND. DE PERFIS DE AÇO LTDA', nomeFantasia: 'GRAVIA IND. DE PERFIS DE AÇO LTDA', tipo: 'juridica', cpfCnpj: '26487744000338', inscEstadual: '07.317.248/005-78', inscMunicipal: null, endereco: 'SIA TRECHO 02 LOTES 102/135', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'ELSA ANTÔNIA DA SILVA BORGES', nomeFantasia: 'ELSA ANTÔNIA DA SILVA BORGES', tipo: 'juridica', cpfCnpj: '5138626000263', inscEstadual: '741.184.264/0120', inscMunicipal: null, endereco: 'BR 040 KM 123 - FAZENDA BURITI', complemento: null, numero: null, bairro: 'ZONA RURAL', cidade: 'João Pinheiro', uf: 'MG', cep: '38777000', referencia: null, email: null },
  { nome: 'FERNANDO RODRIGO DA CUNHA', nomeFantasia: 'FERNANDO RODRIGO DE CUNHA', tipo: 'fisica', cpfCnpj: '96681012604', inscEstadual: null, inscMunicipal: null, endereco: 'RUA KALED COSAC S/N QUADRA 03 LOTE 01 A 05', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'LEMOS CONSTRUÇÕES TRANSPORTES AREIA E CASCALHO LTDA', nomeFantasia: 'LEMOS AREIA', tipo: 'juridica', cpfCnpj: '652008000132', inscEstadual: '07.324.719/001-87', inscMunicipal: null, endereco: 'S.I.A TRECHO 04 PÁTIO FERROVIÁRIO Nº 02', complemento: null, numero: null, bairro: 'Guará I', cidade: 'Brasília', uf: 'DF', cep: '71200040', referencia: null, email: 'paulotlemos@hotmail.com' },
  { nome: 'VANDERLEI B. DA SILVA LTDA', nomeFantasia: 'POSTO CENTRO OESTE', tipo: 'juridica', cpfCnpj: '704256000180', inscEstadual: null, inscMunicipal: null, endereco: 'RUA DA SAUDADE 275', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MAX SOLDAS E FERRAGENS LTDA', nomeFantasia: 'MAX SOLDAS E FERRAGENS', tipo: 'juridica', cpfCnpj: '4726418000131', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PAULO ROGÉRIO QD 108 LOTE 12 B', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SERMAGEL REFRIGERAÇÃO EIRELI', nomeFantasia: 'SERMAGEL', tipo: 'juridica', cpfCnpj: '735401000190', inscEstadual: null, inscMunicipal: null, endereco: 'C 03 LOTE 06 LOJA 01 S/N', complemento: null, numero: null, bairro: 'Taguatinga Centro (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72010030', referencia: null, email: null },
  { nome: 'COMERCIO DE DERIVADOS DE PETROLEO IRMÃOS SA', nomeFantasia: 'REDE PIONEIRO', tipo: 'juridica', cpfCnpj: '3293214000191', inscEstadual: null, inscMunicipal: null, endereco: 'RUA DA SAUDADE ESQ C RUA 02 ESQ C RUA 02', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'RISQUE E RABISQUE', nomeFantasia: 'RISQUE E RABISQUE', tipo: 'juridica', cpfCnpj: '8761117000108', inscEstadual: '10.410.869-0', inscMunicipal: null, endereco: 'RUA SETE DE SETEMBRO, 954 CENTRO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CONCRECON CONCRETO E CONSTRUÇÕES LTDA', nomeFantasia: 'CONCRECON', tipo: 'juridica', cpfCnpj: '3585304000318', inscEstadual: null, inscMunicipal: null, endereco: 'STRC TRECHO 02 CONJUNTO D, LOTE 05', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71225524', referencia: null, email: null },
  { nome: 'G.S.T TECNOLOGIA LTDA', nomeFantasia: 'NETIX', tipo: 'juridica', cpfCnpj: '12666013000183', inscEstadual: null, inscMunicipal: null, endereco: 'RUA GOIAS 1050 CENTRO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PANIFICADORA E CONFEITARIA ALANNA LTDA', nomeFantasia: 'HOLLYWOOD PÃES E CONVENIENCIA', tipo: 'juridica', cpfCnpj: '11321763000150', inscEstadual: '07.530.697/001-71', inscMunicipal: null, endereco: 'ARAUCARIAS LOTE 1325 LOJA 02 E 03 EDIFÍCIO REAL QUALIT', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'ISOLE INFORCAM INFORMÁTICA LTDA', nomeFantasia: 'ISOLE INFORCAM', tipo: 'juridica', cpfCnpj: '21573326000188', inscEstadual: null, inscMunicipal: '770501400171', endereco: 'PONTE ALTA NORTE,RUA ALAMEDA DOS IPES CHACARA 741 LOTE 01', complemento: null, numero: null, bairro: 'Gama', cidade: 'Brasília', uf: 'DF', cep: '72427010', referencia: null, email: null },
  { nome: 'TOME AGROVETERINÁRIA LTDA', nomeFantasia: 'AGROTERRA', tipo: 'juridica', cpfCnpj: '37375839000114', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA KALED COZAC, 888', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PAPELARIA EXATA LTDA', nomeFantasia: 'PAPELARIA EXATA', tipo: 'juridica', cpfCnpj: '5332756000151', inscEstadual: '10.355.686-9', inscMunicipal: null, endereco: 'RUA 07 SE SETEMBRO, 885', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'E.R DA SILVA MERCADO E CONVENIÊNCIA LTDA', nomeFantasia: 'VASSOURÃO DA LIMPEZA', tipo: 'juridica', cpfCnpj: '33767787000170', inscEstadual: '07.919.096/001-37', inscMunicipal: null, endereco: 'Q. CLSW,  504 - BLOCO B', complemento: null, numero: null, bairro: 'Setor Sudoeste', cidade: 'Brasília', uf: 'DF', cep: '70673642', referencia: null, email: null },
  { nome: 'ESTRUTURAL LOCAÇÃO DE BOMBA DE CONCRETO LTDA', nomeFantasia: 'ESTRUTURAL LOCAÇÃO', tipo: 'juridica', cpfCnpj: '43168552000116', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 3 CONJUNTO 7 LOTE 7 SETOR LESTE', complemento: null, numero: null, bairro: 'Setor Especial (Vila Estrutural)', cidade: 'Brasília', uf: 'DF', cep: '71261240', referencia: null, email: null },
  { nome: 'FERNANDO RODRIGO DA CUNHA', nomeFantasia: 'CUNHA INSTALAÇÃO E MANUTENÇÃO', tipo: 'juridica', cpfCnpj: '26432456000114', inscEstadual: null, inscMunicipal: null, endereco: 'R. WILSOM RODRIGUES DA AFONSECA', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CASA DE BISCOITOS MINEIRO - AGUAS CLARAS ALECRIM', nomeFantasia: 'BISCOITO MINEIRO', tipo: 'juridica', cpfCnpj: '36367389000192', inscEstadual: null, inscMunicipal: null, endereco: 'RUA ALECRIM LOTE 15 ,1 SUL', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71938720', referencia: null, email: null },
  { nome: 'VIP MAG PAPELARIA LTDA', nomeFantasia: 'PAPELARIA MAGNOLIA', tipo: 'juridica', cpfCnpj: '39933032000185', inscEstadual: '08.019.013/001-43', inscMunicipal: null, endereco: 'SAI/SO AREA,6580 QUISQUE 54 ASA SUL', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '71219900', referencia: null, email: null },
  { nome: 'ARAUJO ENGENHARIA LTDA', nomeFantasia: 'ARAÚJO ENGENHARIA LTDA', tipo: 'juridica', cpfCnpj: '11956239000156', inscEstadual: null, inscMunicipal: null, endereco: 'RUA OLEGÁRIO MACIEL Nº 63 SALA 307', complemento: null, numero: null, bairro: 'Centro', cidade: 'Patos de Minas', uf: 'MG', cep: '38700122', referencia: null, email: null },
  { nome: 'CASA DE BISCOITOS MINEIROS - ÁGUAS CLARAS', nomeFantasia: 'BISCOITO MINEIRO ÁGUAS CLAAS', tipo: 'juridica', cpfCnpj: '35367389000192', inscEstadual: null, inscMunicipal: null, endereco: 'RUA ALECRIM LOTE 15 LOJA 01', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71938720', referencia: null, email: null },
  { nome: 'SOLAR MATRIZ COMERCIO DE TINTAS LTDA', nomeFantasia: 'SOLAR TINTAS', tipo: 'juridica', cpfCnpj: '39642197000440', inscEstadual: '20.054.715-1', inscMunicipal: null, endereco: 'RUA OTAVIANO DE PAIVA QUADRA 37 LOTE 06 N 905', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SKS AÇO PRONTO INDUSTRIA E COMERCIO LTDA', nomeFantasia: 'SKS AÇO PRONTO', tipo: 'juridica', cpfCnpj: '52270496000117', inscEstadual: '08.248.650/001-72', inscMunicipal: null, endereco: 'ST SCIA Q 12 CJ 1 LOTE 8,000', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71250410', referencia: null, email: null },
  { nome: 'IMPACTO COMÉRCIO DE MATERIAIS DE CONSTRUÇÃO LTDA – ME.', nomeFantasia: 'MADEIREIRA TRADIÇÃO', tipo: 'juridica', cpfCnpj: '21187650000168', inscEstadual: '07.698.340/001-66', inscMunicipal: null, endereco: 'QI 07 LOTE 31/36  -   SETOR DE INDÚSTRIAS', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135070', referencia: null, email: null },
  { nome: 'EP SIA ALUGUEL DE EQUIPAMENTOS E C', nomeFantasia: 'CASA DO CONSTRUTOR', tipo: 'juridica', cpfCnpj: '32769726000180', inscEstadual: '07.900.259/001-29', inscMunicipal: null, endereco: 'SIA QUADRA 4 C BLOCO D LOJA 13', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '07120004', referencia: null, email: null },
  { nome: 'TERRA UTIL COMERCIO DE FERRAMENTAS E UTILIDADES LTDA', nomeFantasia: 'FERRAMENTARIA LTDA', tipo: 'juridica', cpfCnpj: '7144507000168', inscEstadual: '07.462.526/001-96', inscMunicipal: null, endereco: 'SIA TRECHO 2 525', complemento: null, numero: null, bairro: 'Guará I', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'PHOENIX PAES E CONFEITARIA LTDA', nomeFantasia: 'PHOENIX PAES E CONFEITARIA', tipo: 'juridica', cpfCnpj: '8100122000161', inscEstadual: null, inscMunicipal: null, endereco: 'ADE QD 1 CONJUNTO C, LOTE 33 CEILANDIA', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72237130', referencia: null, email: null },
  { nome: 'HOSTGATOR BRASIL', nomeFantasia: 'HOSTGATOR', tipo: 'juridica', cpfCnpj: '15754475000140', inscEstadual: null, inscMunicipal: null, endereco: 'RUA LAURO LINHARES, 589, ÁTICO', complemento: null, numero: null, bairro: 'Trindade', cidade: 'Florianópolis', uf: 'SC', cep: '88036001', referencia: null, email: null },
  { nome: 'LUCIANO ESTEVAO OTAVIANO', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '21575953000158', inscEstadual: '07.705.331/001-06', inscMunicipal: null, endereco: 'ADE CONJUNTO 16 LT 06 APTO KIT 204', complemento: null, numero: null, bairro: 'Área de Desenvolvimento Econômico (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71988720', referencia: null, email: null },
  { nome: 'NEUZA LEAL DA SILVEIRA', nomeFantasia: 'NEUZA LEAL', tipo: 'fisica', cpfCnpj: '50635719649', inscEstadual: null, inscMunicipal: null, endereco: 'AV. PQRQUE AGUAS CLARAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71901080', referencia: null, email: null },
  { nome: 'CREATIVE COPIAS LTDA - FILIAL ES', nomeFantasia: 'CREATIVE COPIAS', tipo: 'juridica', cpfCnpj: '3769753000316', inscEstadual: null, inscMunicipal: null, endereco: 'RODOVIA GOVERNADOR MARIO COVAS, S/N - KM 279, SALA 176', complemento: null, numero: null, bairro: 'Terminal Intermodal da Serra', cidade: 'Serra', uf: 'ES', cep: '29161382', referencia: null, email: null },
  { nome: 'SENIOR SISTEMAS S/ A', nomeFantasia: 'SENIOR', tipo: 'juridica', cpfCnpj: '80680093003105', inscEstadual: null, inscMunicipal: '14429277', endereco: 'AVENIDA SEGUNDA AVENIDA S/N QD 1 B LT 42', complemento: null, numero: null, bairro: 'Cidade Vera Cruz', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74934605', referencia: null, email: null },
  { nome: 'DANIELLE FRANÇA MOREIRA RAMOS', nomeFantasia: 'ALUGUEL GARAGEM', tipo: 'fisica', cpfCnpj: '2708848151', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 204 S/N EDIFÍCIO ALFA MIX BLOCO B SALA 318', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'CAIXA ECONOMICA FEDERAL', nomeFantasia: 'CEF MATRIZ', tipo: 'juridica', cpfCnpj: '360305000104', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR BANCÁRIO SUL SN QUADRA 4 BLOCO A', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70092900', referencia: null, email: null },
  { nome: 'MUNICIPIO DE CRISTALINA', nomeFantasia: 'PREFEITURA MUNICIPAL DE CRISTALINA GABINETE DO PREFEITO', tipo: 'juridica', cpfCnpj: '1138122000101', inscEstadual: null, inscMunicipal: null, endereco: 'Palácio dos Cristais, Praça José Adamian', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '77385000', referencia: null, email: null },
  { nome: 'MAXIMIZA DF ADMINISTRACAO E CORRETAGEM DE SEGUROS LTDA', nomeFantasia: 'MAXIMIZA DF', tipo: 'juridica', cpfCnpj: '10961528000180', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 25', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71927180', referencia: null, email: null },
  { nome: 'CONSELHO REGIONAL DE ENGENHARIA E AGRONOMIA DO DISTRITO FEDERAL', nomeFantasia: 'CREA - DF', tipo: 'juridica', cpfCnpj: '304725000173', inscEstadual: null, inscMunicipal: null, endereco: 'SGAS 901', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70390010', referencia: null, email: null },
  { nome: 'SECRETARIA DO ESTADO DE ECONOMIA DO DISTRITO FEDERAL - SEEC / DF', nomeFantasia: 'SECRETARIA DO ESTADO DA ECONIMIA DO DISTRITO FEDERAL', tipo: 'juridica', cpfCnpj: '394684000153', inscEstadual: null, inscMunicipal: null, endereco: 'SBN Quadra 2', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70040909', referencia: null, email: null },
  { nome: 'RN HIDRAULICA LTDA,', nomeFantasia: 'RN HIDRAULICA', tipo: 'juridica', cpfCnpj: '44901432000149', inscEstadual: null, inscMunicipal: null, endereco: 'Rodovia DF-280 N°08 SHAQ ROCIO QD 14 LT 08', complemento: null, numero: null, bairro: 'Recanto das Emas', cidade: 'Brasília', uf: 'DF', cep: '72667400', referencia: null, email: null },
  { nome: 'J L SOLAR LTDA', nomeFantasia: 'J L SOLAR', tipo: 'juridica', cpfCnpj: '6039692000168', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Tenente Felício Alonso Soler Nº 417, Loteamento Residencial da Lealdade', complemento: null, numero: null, bairro: 'Loteamento Parque Nova Esperança', cidade: 'São José do Rio Preto', uf: 'SP', cep: '15054610', referencia: null, email: null },
  { nome: 'RICARDO GOMES DE SOUZA', nomeFantasia: 'RICARDO GOMES DE SOUZA', tipo: 'juridica', cpfCnpj: '55080526000110', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 11 N° 15-B', complemento: null, numero: null, bairro: 'Recreio da Barragem', cidade: 'Águas Lindas de Goiás', uf: 'GO', cep: '72920861', referencia: null, email: null },
  { nome: 'T.S. CONSTRUTORA E TRANSPORTES LTDA', nomeFantasia: 'MESTRE SELIMAR', tipo: 'juridica', cpfCnpj: '46908676000189', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 097, Nº S/N QD 85 LT 03', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'W V METALURGICA LTDA', nomeFantasia: 'W V METALURGICA', tipo: 'juridica', cpfCnpj: '14962159000100', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 03, SN, QUADRA 02 NOTE 04', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CRISANTINO CAVALCANTI DRUMOND', nomeFantasia: 'CRISANTINO CAVALCANTI', tipo: 'fisica', cpfCnpj: '36769720663', inscEstadual: null, inscMunicipal: null, endereco: 'VALPARAISO C', complemento: null, numero: null, bairro: 'Valparaiso I - Etapa A', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72876217', referencia: null, email: null },
  { nome: 'PINHEIRO FERRAGENS LTDA', nomeFantasia: 'FERRAGENS PINHEIRO', tipo: 'juridica', cpfCnpj: '2329000272', inscEstadual: '07.312.140/002-19', inscMunicipal: null, endereco: 'TRECHO SIA TRECHO 2 LOTE 1545,1555', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200029', referencia: null, email: 'frederico@pinheiroferragens.com.br' },
  { nome: 'H & I UTILIDADES LTDA', nomeFantasia: 'A MUNDIAL AG CLARAS', tipo: 'juridica', cpfCnpj: '3769576000700', inscEstadual: '07.409.406/005-72', inscMunicipal: null, endereco: 'RUA ALECRIM LT 08 LJ 01', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71938720', referencia: null, email: null },
  { nome: 'SUELI DE DEUS SALES', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '57996245134', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 33 Sul Lote 9 Apartamento 106', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71931360', referencia: null, email: null },
  { nome: 'SEBASTIÃO CORDEIRO MAXIMO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '9928294100', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 204 LT 02', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'ESQUADRO PROJETOS LTDA', nomeFantasia: 'ESQUADRO PROJETOS', tipo: 'juridica', cpfCnpj: '26699755000110', inscEstadual: null, inscMunicipal: null, endereco: 'SRTV / NORTE QUADRA 702 CONJUNTO P S/N SALA 2114', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70719900', referencia: null, email: null },
  { nome: 'ATACADÃO DIA A DIA S.A.', nomeFantasia: 'ATACADÃO DIA A DIA', tipo: 'juridica', cpfCnpj: '17457404001779', inscEstadual: null, inscMunicipal: null, endereco: 'AV CASTANHEIRAS LOTES 200 A 280 LOJA S/N', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '71900100', referencia: null, email: null },
  { nome: 'DONA DE CASA S/A', nomeFantasia: 'DONA DE CASA', tipo: 'juridica', cpfCnpj: '11832478000790', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 7 LOTE 04 LOJAS 01/03', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '71938000', referencia: null, email: null },
  { nome: 'F R BOLOS DO FLÁVIO LTDA', nomeFantasia: 'BOLOS DO FLÁVIO', tipo: 'juridica', cpfCnpj: '8586580000233', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida das Araucarias, 6 - Sul', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'MÁRCIA DE OLIVEIRA FERREIRA', nomeFantasia: 'ALUGUEL APTO FRANCISCO', tipo: 'fisica', cpfCnpj: '51779293100', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Dolomita QD 12 LT 02', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'JOÃO PEDRO FERREIRA DA SILVA', nomeFantasia: 'ALUGUEL APTO FERNANDA', tipo: 'fisica', cpfCnpj: '55919812672', inscEstadual: null, inscMunicipal: null, endereco: 'RUA MARIA LEOPINHA DO PRADO 39 APTO 101', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '17320208', referencia: null, email: null },
  { nome: 'JOSÉ CARLOS FRANCISCO DE SOUZA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '53841310125', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 01', complemento: null, numero: null, bairro: 'Centro (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71691099', referencia: null, email: null },
  { nome: 'PEDRO EMÍLIO M MELO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '5256505122', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 34 SUL LOTE 8', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '72930500', referencia: null, email: null },
  { nome: 'MAURÍCIO CARDOSO JUNIOR', nomeFantasia: 'MAURÍCIO CARDOSO JUNIOR', tipo: 'juridica', cpfCnpj: '8385083000196', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA BRASIL, Nº 505', complemento: null, numero: null, bairro: 'Cidade Jardim', cidade: 'Anápolis', uf: 'GO', cep: '75080240', referencia: null, email: null },
  { nome: 'MERCADO SP LTDA', nomeFantasia: 'MERCADO SP', tipo: 'juridica', cpfCnpj: '35377959000125', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA JEQUITIBÁ LOTE 485', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71929540', referencia: null, email: null },
  { nome: 'CONCRETO REDIMIX DE BRASÍLIA LTDA', nomeFantasia: 'REDIMIX', tipo: 'juridica', cpfCnpj: '402305000120', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 04 208/290', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71050022', referencia: null, email: null },
  { nome: 'SHEILA HAICK CONFEITA', nomeFantasia: 'SHEILA DO SOCORRO DE M', tipo: 'juridica', cpfCnpj: '22069877000171', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 9, LOTES 6 E 8, LOJA 13 CONDOMPINIO ILLUMINATO', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71908540', referencia: null, email: null },
  { nome: 'SECRETARIA DE ESTADO DE FAZENDA', nomeFantasia: 'SEFAZ DF', tipo: 'juridica', cpfCnpj: '50876159000142', inscEstadual: null, inscMunicipal: null, endereco: 'SBN QD 02 EDIFÍCIO VALE DO RIO DOCE 7º ANDAR', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70040909', referencia: null, email: null },
  { nome: 'MARIA DE FÁTIMA STHEFANE DE SOUZA DANTAS DA SILVA', nomeFantasia: 'REDES SOCIAIS', tipo: 'fisica', cpfCnpj: '2710325101', inscEstadual: null, inscMunicipal: null, endereco: 'QD 37 LOTE 16', complemento: null, numero: null, bairro: 'Jardim América IV', cidade: 'Águas Lindas de Goiás', uf: 'GO', cep: '72922590', referencia: null, email: null },
  { nome: 'ROHR S A ESTRUTURAS TUBULARES', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '61480380001922', inscEstadual: null, inscMunicipal: null, endereco: 'TR STRC TRECHO 2 CONJUNTO A LOTE 07', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71225521', referencia: null, email: 'contadoria@rohr.com.br' },
  { nome: 'TECH BUILD CONTRUCOES E INVESTIMENTOS EIRELI', nomeFantasia: 'TECH BUILD CONTRUCOES E INVESTIMENTOS EIRELI', tipo: 'juridica', cpfCnpj: '27736389000194', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA GUIDO CALOI Nº 1000 BLOCO 5', complemento: null, numero: null, bairro: 'Jardim São Luís', cidade: 'São Paulo', uf: 'SP', cep: '05802140', referencia: null, email: null },
  { nome: 'BSB SANITIZAÇÃO DE AMBIENTES E CONTROLE INTEGRADO DE PRAGAS LTDA', nomeFantasia: 'BSB CONTROLE DE PRAGAS', tipo: 'juridica', cpfCnpj: '37374159000186', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA CNA 02, LOTE 08 SALA 102', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72110025', referencia: null, email: null },
  { nome: 'IBRATIN INDUSTRIA E COMERCIO LTDA', nomeFantasia: 'IBRATIN INDÚSTRIA', tipo: 'juridica', cpfCnpj: '48597074000183', inscEstadual: '735171900151', inscMunicipal: null, endereco: 'AVENIDA SINATO, 105. CLEBA 32, CHÁCARA MARISTELA', complemento: null, numero: null, bairro: 'Vila Cariri', cidade: 'Franco da Rocha', uf: 'SP', cep: '07830350', referencia: null, email: null },
  { nome: 'J A DE SOUZA E CIA LTDA', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '3602562000101', inscEstadual: null, inscMunicipal: null, endereco: 'SHC/SW CLSW QD 105 BL C LOJAS 92/94', complemento: null, numero: null, bairro: 'Setor Sudoeste', cidade: 'Brasília', uf: 'DF', cep: '70670433', referencia: null, email: null },
  { nome: 'CONSELHO REGIONAL DE ENGENHARIA E AGRONOMIA DE GOIÁS', nomeFantasia: 'CREA - GO', tipo: 'juridica', cpfCnpj: '1619022000105', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 239 Nº 561', complemento: null, numero: null, bairro: 'Setor Leste Universitário', cidade: 'Goiânia', uf: 'GO', cep: '74605070', referencia: null, email: null },
  { nome: 'CLINICA DE MEDICINA OLIMPO LTDA', nomeFantasia: 'CLINICA OLIMPO', tipo: 'juridica', cpfCnpj: '8797899000127', inscEstadual: null, inscMunicipal: '748686700189', endereco: 'SETOR SEPS EQ 715/915 CONJ A BLOCO E SALA 401 A 405', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70390155', referencia: null, email: null },
  { nome: 'AZUL LINHAS AEREAS BRASILEIRAS S.A.', nomeFantasia: 'AZUL LINHAS AEREAS', tipo: 'juridica', cpfCnpj: '9296295000160', inscEstadual: null, inscMunicipal: null, endereco: 'AV MARCOS PENTEADO DE ULHOA RODRIGUES ANDAR 9 EDIF JATOBA COND CASTELO BRANCOANDAR 9 EDIF JATOBA CON', complemento: null, numero: null, bairro: 'Tamboré', cidade: 'Barueri', uf: 'SP', cep: '64600400', referencia: null, email: null },
  { nome: 'RICARDO SANTOS VOGADO DANTAS', nomeFantasia: 'RICARDO SANTOS DANTAS', tipo: 'fisica', cpfCnpj: '6526546307', inscEstadual: null, inscMunicipal: null, endereco: 'CIDADE DE VALPARAISO DE GOIAS QD 92 LT24 CASA 3', complemento: null, numero: null, bairro: 'Jardim Céu Azul', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72871160', referencia: null, email: null },
  { nome: 'SUDOESTE COMÉRCIO DE VIDROS LTDA', nomeFantasia: 'SUDOESTE VIDROS', tipo: 'juridica', cpfCnpj: '9635568000153', inscEstadual: null, inscMunicipal: null, endereco: 'CCSW 05 BLOCO D LOJAS 09 E 41', complemento: null, numero: null, bairro: 'Setor Sudoeste', cidade: 'Brasília', uf: 'DF', cep: '70680550', referencia: null, email: null },
  { nome: 'LINE BAKERY PANIFICAÇÃO LTDA', nomeFantasia: 'LINE BAKERY', tipo: 'juridica', cpfCnpj: '35910866000386', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ARAUCARIAS LT 1395 LOJA 07 E 08', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'BOMBEAR SERVICO E COMERCIO DE MATERIAL ELETRICO E HIDRÁULICO LTDA', nomeFantasia: 'BOMBEAR SERVIÇO E COMÉRCIO', tipo: 'juridica', cpfCnpj: '20003045000127', inscEstadual: '00.767.679/800-18', inscMunicipal: null, endereco: '- SHA CONJUNTO 04 CHACARA 80 LOTE 01 LOJA 04-ARNIQUEIRA', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71994010', referencia: null, email: null },
  { nome: 'MASTER ATACADISTA MAT. CONSTRUCAO S/A', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '21368129000127', inscEstadual: '07.701.465/001-94', inscMunicipal: null, endereco: 'QI 19 LOTES 17/31 - SETOR DE INDÚSTRIAS', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265190', referencia: null, email: null },
  { nome: 'TERRAVIVA MADEIRAS', nomeFantasia: 'TERRAVIVA INDUSTRIA E COM. DE MAT. P. CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '15598614000194', inscEstadual: '07.608.869/001-64', inscMunicipal: null, endereco: 'SIA TRECHO 02 LOTES 205/275', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200027', referencia: null, email: null },
  { nome: 'ARLEY SANTANA GASPIO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '74628119104', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA PRIMAVERA QD 19 LT 04 BAIRRO BELVEDERE', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'DIAMANTECNO FERRAMENTAS DIAMANTADAS LTDA- EPP', nomeFantasia: 'DIAMANTECNO FERRAMENTAS DIAMANTADAS LTDA- EPP', tipo: 'juridica', cpfCnpj: '62108253000130', inscEstadual: '286091340116', inscMunicipal: null, endereco: 'Rua Blindex, 54', complemento: null, numero: null, bairro: 'Piraporinha', cidade: 'Diadema', uf: 'SP', cep: '09950080', referencia: null, email: 'nfe@diamantecno.com.br' },
  { nome: 'MASTER DISTRIBUIDORA DE INFORMATICA, ESCRITORIO E PAPELARIA - LKTDA', nomeFantasia: 'MASTER PAPELARIA', tipo: 'juridica', cpfCnpj: '51201136000109', inscEstadual: null, inscMunicipal: null, endereco: 'ADE CONJUNTO 6 LOTE 10', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71987000', referencia: null, email: null },
  { nome: 'IGOR GONZAGA OLIVEIRA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '3864957184', inscEstadual: null, inscMunicipal: null, endereco: 'QD 09 CONJUNTO H LOTE 02 APTO 01', complemento: null, numero: null, bairro: 'Arapoanga (Planaltina)', cidade: 'Brasília', uf: 'DF', cep: '73300000', referencia: null, email: null },
  { nome: 'PREMOLDADO BRASIL LTDA', nomeFantasia: 'PREMOLDADO BRASIL LTDA', tipo: 'juridica', cpfCnpj: '18165127000126', inscEstadual: null, inscMunicipal: null, endereco: 'SDMC Quadra 03 Lotes 24 ao 54', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265710', referencia: null, email: null },
  { nome: 'VIA  GUARA MATERIAIS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'JAPÃO DA CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '43953112000170', inscEstadual: null, inscMunicipal: null, endereco: 'AREIA ESPECIAL  2- CONJ A LT 01  LOJA 1/2', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'JOSÉ IVAN FREIRES ALMEIDA', nomeFantasia: 'D & G SONDAGEM SPT E POÇO ARTESIANO', tipo: 'juridica', cpfCnpj: '12025133000100', inscEstadual: null, inscMunicipal: null, endereco: 'QNM 09 CONJUNTO C LOTE 29', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72215093', referencia: null, email: null },
  { nome: 'JUAREZ NOGUEIRA DE CARVALHO', nomeFantasia: 'JUAREZ NOGUEIRA DE CARVALHO', tipo: 'fisica', cpfCnpj: '11682086100', inscEstadual: null, inscMunicipal: null, endereco: 'QE 42 CONJ E CASA 23', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71070055', referencia: null, email: null },
  { nome: 'VILMAR CORREIA DA SILVA', nomeFantasia: 'VILMAR CORREIA DA SILVA', tipo: 'juridica', cpfCnpj: '21209202000118', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR SUL II', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'HOMETECK - ATACADISTA', nomeFantasia: 'HOMETECK', tipo: 'juridica', cpfCnpj: '14959979000304', inscEstadual: '07.597.059/003-41', inscMunicipal: null, endereco: 'SIA TRECHO 03 LOTE 425/435/445 E 455', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'DESS COMERCIO DE ARTIGOS DE ILUMINAÇÃO', nomeFantasia: 'DESSINE', tipo: 'juridica', cpfCnpj: '33882825000136', inscEstadual: '07.921.106/001-65', inscMunicipal: null, endereco: 'SCIA QD 8 CONJ 8 LOTE 07', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '71250710', referencia: null, email: null },
  { nome: 'CONCRETO BRASILIA REPRESENTAÇÃO DE MATERIAIS PARA CONSTRUÇÃO', nomeFantasia: 'CONCRETO BRASILIA', tipo: 'juridica', cpfCnpj: '9525963000183', inscEstadual: null, inscMunicipal: '809927300138', endereco: 'COPAIBA LOTE 1 TORRE A  SALA 1117 NORTE', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71919540', referencia: null, email: null },
  { nome: 'RODRIGO FRUTAS', nomeFantasia: 'RODRIGO FRUTAS', tipo: 'juridica', cpfCnpj: '49485714000126', inscEstadual: null, inscMunicipal: null, endereco: 'QNP 14 CPNJ 10', complemento: null, numero: null, bairro: 'Setor Industrial (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72231408', referencia: null, email: null },
  { nome: 'HUMBURGUER FAST FOOD', nomeFantasia: 'HUMBURGUER', tipo: 'juridica', cpfCnpj: '31761581000108', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR SGCV LOTE22', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'TOTAL FILTROS EIRELI ME', nomeFantasia: 'MUNDO DOS FILTROS', tipo: 'juridica', cpfCnpj: '8109814000170', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 3 LOTES 1720 /1730  ZONA INDUSTRIAL GUARA', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'LEROY MERLIN CIA BRASILEIRA DE BRICOLAGEM', nomeFantasia: 'LEROY MERLIN', tipo: 'juridica', cpfCnpj: '1438784002574', inscEstadual: '07.461.175/003-59', inscMunicipal: null, endereco: 'Q QS 3 RUS 420 LOTE 04 BLOCO S/N AREAL ( AGUAS CLARAS )', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71953100', referencia: null, email: null },
  { nome: 'SUPREMA PAPELARIA E LIVRARIA LTDA', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '53271558000259', inscEstadual: '08.267.639/002-60', inscMunicipal: null, endereco: 'RUA 9 SUL LT 15, S/N', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71938360', referencia: null, email: null },
  { nome: 'IE TECNOLOGIA LTDA', nomeFantasia: 'IE TECNOLOGIA', tipo: 'juridica', cpfCnpj: '10727629000191', inscEstadual: '001.878.152/0077', inscMunicipal: null, endereco: 'AVENIDA DOUTOR HENRIQUETO CARDINALI', complemento: null, numero: null, bairro: 'Centro', cidade: 'Varginha', uf: 'MG', cep: '37501157', referencia: null, email: null },
  { nome: 'LÉO MOVEIS  PLANEJADOS', nomeFantasia: 'LEO MOVEIS', tipo: 'juridica', cpfCnpj: '29650642000118', inscEstadual: null, inscMunicipal: null, endereco: 'QNP 18 CONJUNTO F CASA 09', complemento: null, numero: null, bairro: 'Setor Habitacional Sol Nascente (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72231806', referencia: null, email: null },
  { nome: 'FC BOLOS DO FLAVIO LTDA', nomeFantasia: 'BOLOS DO FLAVIO', tipo: 'juridica', cpfCnpj: '22802549000213', inscEstadual: null, inscMunicipal: null, endereco: 'AV DAS ARAUCARIAS LOTE 1395', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'GILBERTO RIBEIRO DE NOVAIS', nomeFantasia: 'GILBERTO RIBEIRO  DE NOVAIS', tipo: 'juridica', cpfCnpj: '19575102000163', inscEstadual: null, inscMunicipal: null, endereco: 'NOSSA SENHORA DE FATIMA', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ACT IMPORTAÇÃO E EXPORTAÇÃO LTDA', nomeFantasia: 'LEPONO DO BRASIL', tipo: 'juridica', cpfCnpj: '31110755000172', inscEstadual: '258769270', inscMunicipal: null, endereco: 'Av. Governador Adolfo Konder,705 Bloco 01 Armz 01 e 02', complemento: null, numero: null, bairro: 'Cidade Nova', cidade: 'Itajaí', uf: 'SC', cep: '88308001', referencia: null, email: null },
  { nome: 'TOP CAR CENTRO AUTOMOTIVO LTDA', nomeFantasia: 'TOP CAR', tipo: 'juridica', cpfCnpj: '44688785000010', inscEstadual: '08.104.564/001-31', inscMunicipal: null, endereco: 'SETOR D SUL LOTE 3', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72020111', referencia: null, email: 'ilandiego28@gmail.com' },
  { nome: 'A MUNDIAL AGUAS CLARAS', nomeFantasia: 'A MUNDIAL UTILIDADES', tipo: 'juridica', cpfCnpj: '3769576000700', inscEstadual: null, inscMunicipal: null, endereco: 'RUA ALECRIM LOTE 08 LJ 1        SUL', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71938720', referencia: null, email: null },
  { nome: 'JOSÉ ROSA PIRES', nomeFantasia: 'JOSÉ ROSA', tipo: 'fisica', cpfCnpj: '41747917168', inscEstadual: null, inscMunicipal: null, endereco: 'QR 302  CONJ C CASA 33', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72502500', referencia: null, email: null },
  { nome: 'PLANEJAR INTERIORES LTDA - ME', nomeFantasia: 'PLANEJAR INTERIORES', tipo: 'juridica', cpfCnpj: '26121693000164', inscEstadual: null, inscMunicipal: null, endereco: 'RUA NOSSA SENHORA DE FÁTIMA QUADRA 08 LOTE 10', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MERCADO PAGO. COM REPRESENTAÇÕES LTDA', nomeFantasia: 'MERCADO LIVRE', tipo: 'juridica', cpfCnpj: '10573521000191', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA DAS NAÇÕES UNIDAS Nº 3003', complemento: null, numero: null, bairro: 'Bonfim', cidade: 'Osasco', uf: 'SP', cep: '06233903', referencia: null, email: null },
  { nome: 'JOSÉ PEDRO FERREIRA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '96707860100', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 8 RESIDENCIAL OURO VERDE QD 42 LT 26', complemento: null, numero: null, bairro: 'Centro', cidade: 'Padre Bernardo', uf: 'GO', cep: '73700000', referencia: null, email: null },
  { nome: 'HOTEL TOPÁZIO LTDA', nomeFantasia: 'HOTEL TOPÁZIO', tipo: 'juridica', cpfCnpj: '10359340000167', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA FLAMENGO S/N QD 44 LT 09/10', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'FAGUNDES CERTIFICADORA E SERVIÇOS DE INFORMÁTICA LTDA', nomeFantasia: 'NATHYELLE', tipo: 'juridica', cpfCnpj: '4740806000177', inscEstadual: null, inscMunicipal: null, endereco: 'QD QNM 17 CJ A, S/N', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72215171', referencia: null, email: null },
  { nome: 'JOÃO CARLOS LIMA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '11170167810', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 52 QD 23 LOTE 09', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'EDSON BELCHIOR DE SOUZA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '10413191699', inscEstadual: null, inscMunicipal: null, endereco: 'QD 12 CASA  12', complemento: null, numero: null, bairro: 'Vila São José (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693014', referencia: null, email: null },
  { nome: 'DROGARIA SÃO PAULO', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '61412110058315', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 19 SUL LOTE 16 LJ 5', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71940720', referencia: null, email: null },
  { nome: 'ETC E TAL', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '38178095000100', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 204', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'MOCELLIN LORIN CHURRASCARIA LTDA', nomeFantasia: 'CHURRASCARIA BUFFALO BIO', tipo: 'juridica', cpfCnpj: '12979109000100', inscEstadual: null, inscMunicipal: null, endereco: 'CHÁCARA 35 - SETOR HABITACIONAL VICENTE PIRES- TRECHO 3', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72001390', referencia: null, email: null },
  { nome: 'ALDAIR MARTINS DA SILVA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '397908199', inscEstadual: null, inscMunicipal: null, endereco: 'QD 307 CONJUNTO 6 CAS 6', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72305606', referencia: null, email: null },
  { nome: 'SAMANTHA M. A. BRANCO ELA E TETE COMÉRCIO DE VESTUÁRIOS', nomeFantasia: 'ELA E TETE', tipo: 'juridica', cpfCnpj: '28795075000125', inscEstadual: null, inscMunicipal: null, endereco: 'QD 204 LT 2 CONDOMPINIO ALFA MIX CENTER LJ 15 A', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'MINEIRINHO PRODUTOS', nomeFantasia: 'MINEIRINHO PRODUTOS', tipo: 'juridica', cpfCnpj: '44777158000148', inscEstadual: null, inscMunicipal: null, endereco: 'SHA CONJUNTO 5 CHÁCARA 21 LT 2B', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71995165', referencia: null, email: null },
  { nome: 'DVG INDUSTRIA DE CONCRETO CELULAR LTDA', nomeFantasia: 'DVG INDUSTRIA DE CONCRETO CELULAR LTDA', tipo: 'juridica', cpfCnpj: '34651228000163', inscEstadual: '003.526.440/0008', inscMunicipal: '1171743001X', endereco: 'VIA GERALDO DIAS,  2800', complemento: null, numero: null, bairro: 'Serra do Curral', cidade: 'Belo Horizonte', uf: 'MG', cep: '30628260', referencia: null, email: 'envio_nf@blocosical.com.br' },
  { nome: 'CAPITAL COLETA DE RESIDUOS, COMERCIO E MATERIAIS DE CONSTRUCAO LTDA', nomeFantasia: 'CAPITAL AREIA', tipo: 'juridica', cpfCnpj: '33319456000178', inscEstadual: null, inscMunicipal: null, endereco: 'Q SIA QUADRA 4-C BLOCO E LOTE 45 LOJA', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200045', referencia: null, email: null },
  { nome: 'RAUL SEVERINO BORGES', nomeFantasia: 'RAUL SEVERINO BORGES', tipo: 'fisica', cpfCnpj: '5246061108', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 95 QUADRA 91 CASA 26', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'IOLANDA M S VELOSO ATELIER DE COSTURA LIG UNIFORMES', nomeFantasia: 'IOLANDA M S VELOSO', tipo: 'juridica', cpfCnpj: '47632023000182', inscEstadual: null, inscMunicipal: null, endereco: 'RUA BURITI LT LOJA 04', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71940000', referencia: null, email: null },
  { nome: 'CIMEX DO BRASIL ENGENHARIA LTDA', nomeFantasia: 'CIMEX CONCRETO', tipo: 'juridica', cpfCnpj: '54787496000114', inscEstadual: null, inscMunicipal: '829436500166', endereco: 'QSC 19 CHÁCARA 25 CONJUNTO A S/N LOTE 30', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72017203', referencia: null, email: null },
  { nome: 'FERRAGENS SAO JUDAS LTDA', nomeFantasia: 'VENDA MERC', tipo: 'juridica', cpfCnpj: '66944539000107', inscEstadual: null, inscMunicipal: null, endereco: 'ESTRADA ALBERTO HINOTO, 6100', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '08586260', referencia: null, email: null },
  { nome: 'PABLO TIERRI MAXIMO RODRIGUES FONSECA', nomeFantasia: 'PABLO TIERRI MAXIMO RODRIGUES', tipo: 'fisica', cpfCnpj: '70501607170', inscEstadual: null, inscMunicipal: null, endereco: 'AV. TIRADENTES  NR 9 JARDIM PLANALTO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'WMB SUPERMERCADOS DO BRASIL LTDA', nomeFantasia: 'WMB SUPERMERCADOS DO BRASIL', tipo: 'juridica', cpfCnpj: '63960022331', inscEstadual: null, inscMunicipal: null, endereco: 'RUA COPAÍBA LOTE 01 MEZANINO 1B LOJA 02B', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71919540', referencia: null, email: null },
  { nome: 'WARLEY SANTANA GASPIO', nomeFantasia: 'WARLEY', tipo: 'fisica', cpfCnpj: '4440371108', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA PRIMAVERA DQ 19 LOTE 04', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'TRILHAS DA AMAZÔNIA', nomeFantasia: 'TRILHAS DA AMAZÔNIA', tipo: 'juridica', cpfCnpj: '54015568000105', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 17 SUL, 07 LOJA 09', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71940360', referencia: null, email: null },
  { nome: 'BF MATERIAIS DE CONSTRUÇÃO EIRELI ME', nomeFantasia: 'CONSTRULAR SIA', tipo: 'juridica', cpfCnpj: '22947083000163', inscEstadual: null, inscMunicipal: null, endereco: 'SIA Trecho 2', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'ROBSON NUNES DA SILVA', nomeFantasia: 'ROBSON NUNES DA SILVA', tipo: 'fisica', cpfCnpj: '70677310110', inscEstadual: null, inscMunicipal: null, endereco: 'SMPW - QUADRA 05 CONJUNTO 14 LOTE 08 - UNIDADE H', complemento: null, numero: null, bairro: 'Park Way', cidade: 'Brasília', uf: 'DF', cep: '71735514', referencia: null, email: null },
  { nome: 'ÁGUIA ATACADISTA DA CONSTRUÇÃO LTDA', nomeFantasia: 'ÁGUIA ATACADISTA', tipo: 'juridica', cpfCnpj: '7837561000199', inscEstadual: '07.475.097/001-88', inscMunicipal: null, endereco: 'STRC TRECHO 03 CONJUNTO A LOTE 4 PART4E A', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71225531', referencia: null, email: null },
  { nome: 'OBRALAR CASA E CONSTRUÇÃO ESPAÇO VIP', nomeFantasia: 'OBRALAR', tipo: 'juridica', cpfCnpj: '6307577000399', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA DAS ARAUCARIAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'TOQUE ESPECIAL GRILL', nomeFantasia: 'TOQUE ESPECIAL', tipo: 'juridica', cpfCnpj: '43310314000101', inscEstadual: null, inscMunicipal: null, endereco: 'QD 204 LT 2 CONDOMPINIO ALFA MIX CENTER LJ 15 A', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'ADELSON MARCOS DA SILVA', nomeFantasia: 'ADELSON MARCOS DA SILVA', tipo: 'fisica', cpfCnpj: '65181310206', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA URCA , QUADRA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'TEGAPE IMPORTAÇÃO E COMÉRCIO DE TECDOS TÉCNICOS LTDA', nomeFantasia: 'TEGAPE IMPORTAÇÃO E COMÉRCIO', tipo: 'juridica', cpfCnpj: '76533074000155', inscEstadual: '101.07480-34', inscMunicipal: null, endereco: 'RUA FELICIO LASKOSKI,  Nº 499', complemento: null, numero: null, bairro: 'Riviera', cidade: 'Curitiba', uf: 'PR', cep: '81925000', referencia: null, email: null },
  { nome: 'BRASIL TELAS INDUSTRIA E COMERCIO EIRELI', nomeFantasia: 'BRASIL TELAS INDÚSTRIA', tipo: 'juridica', cpfCnpj: '24628642000106', inscEstadual: null, inscMunicipal: null, endereco: 'AV MUTINGA , Nº 784', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '05110000', referencia: null, email: null },
  { nome: 'TELAS PERAM COM IMP E REP LTDA', nomeFantasia: 'TELAS PERAME', tipo: 'juridica', cpfCnpj: '71992424000128', inscEstadual: '118730359113', inscMunicipal: null, endereco: 'AV PROF CELESTINO BOURROUL,558', complemento: null, numero: null, bairro: 'Limão', cidade: 'São Paulo', uf: 'SP', cep: '02710000', referencia: null, email: 'marcio@peram.com.br' },
  { nome: 'SHOPP REPAROS', nomeFantasia: 'SHOPP REPAROS', tipo: 'juridica', cpfCnpj: '41618993000147', inscEstadual: null, inscMunicipal: null, endereco: 'QD 204 LOTE 02', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'R10 MONTAGEM E MANUTENÇÃO DE ELEVADOR CREMALHEIRA EIRELI', nomeFantasia: 'R10 MONTAGEM E MANUTENÇÃO', tipo: 'juridica', cpfCnpj: '36060153000171', inscEstadual: null, inscMunicipal: null, endereco: 'Q QNP 18 CONJ A LOTE 24', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72231801', referencia: null, email: null },
  { nome: 'CRIARE SOLUÇÕES EM ILUMINAÇÃO', nomeFantasia: 'QUEZIA TAVARES LOPES VELOSO', tipo: 'juridica', cpfCnpj: '42706623000124', inscEstadual: null, inscMunicipal: null, endereco: 'QD  QI 18 BLOCO S, 102 GUARA I', complemento: null, numero: null, bairro: 'Guará I', cidade: 'Brasília', uf: 'DF', cep: '71015194', referencia: null, email: null },
  { nome: 'VULCÃO DA BORRACHA LTDA', nomeFantasia: 'VULCÃO DA BORRACHA', tipo: 'juridica', cpfCnpj: '9118000180', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 5 -C LOTE 06 SALA 313  SIA / SUL', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200055', referencia: null, email: null },
  { nome: 'TORNEADORA CEILANDIA LTDA', nomeFantasia: 'TORNEADORA CEILANDIA', tipo: 'juridica', cpfCnpj: '549279000167', inscEstadual: '07.312.662/001-11', inscMunicipal: null, endereco: 'LOC QI 1, N LOTES 16 A 22', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71135190', referencia: null, email: null },
  { nome: 'AL FERRAMENTAS PARA OBRAS LTDA', nomeFantasia: 'EQUIPA OBRA', tipo: 'juridica', cpfCnpj: '43260951000102', inscEstadual: '790543750113', inscMunicipal: null, endereco: 'RUA DA ALFANDEGA ,200 PREDIO 30  SALA 262', complemento: null, numero: null, bairro: 'Brás', cidade: 'São Paulo', uf: 'SP', cep: '03006030', referencia: null, email: null },
  { nome: 'IW8 INDUSTRIA COMERCIO E REPRESENTAÇÃO COMERCIAL LTDA', nomeFantasia: 'IW8EQUIPAMENTOS', tipo: 'juridica', cpfCnpj: '17038947000194', inscEstadual: null, inscMunicipal: null, endereco: 'RUA JOSE WALENDOWSKY 111', complemento: null, numero: null, bairro: 'Limeira Alta', cidade: 'Brusque', uf: 'SC', cep: '88356155', referencia: null, email: null },
  { nome: 'SCANMETAL IND COM IMPORT E EXPORT DE FERRAMENTAS LTDA', nomeFantasia: 'SCANMETAL IND COM IMPORT E EXPORT DE FERRAMENTAS LTDA', tipo: 'juridica', cpfCnpj: '1655212000170', inscEstadual: null, inscMunicipal: null, endereco: 'RUA CARLOS JOSE MICHELON, 1.153', complemento: null, numero: null, bairro: 'Jardim Andaraí', cidade: 'São Paulo', uf: 'SP', cep: '02166010', referencia: null, email: null },
  { nome: 'MM INDÚSTRIA E COMÉRCIO E LOCAÇÃO DE MÁQUINAS E EQUIPAMENTOS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'METALPLAN', tipo: 'juridica', cpfCnpj: '9278507000186', inscEstadual: null, inscMunicipal: null, endereco: 'Av. V-08 Qd. 33 Lts 08/09 e 15/16 - St. Mansões Paraiso', complemento: null, numero: null, bairro: 'Mansões Paraíso', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74952560', referencia: null, email: null },
  { nome: 'WALBRAS COMERCIAL DE FERRAGENS LTDA', nomeFantasia: 'WALBRAS SISTEMA DE FIXAÇÃO', tipo: 'juridica', cpfCnpj: '37166931000174', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA CENTRAL LOTE,1010 LJ 02 TERREO SS', complemento: null, numero: null, bairro: 'Núcleo Bandeirante', cidade: 'Brasília', uf: 'DF', cep: '71710019', referencia: null, email: null },
  { nome: 'CARMO & RODRIGUES FERG E ELETROM LTDA', nomeFantasia: 'CARMO E RODRIGUES', tipo: 'juridica', cpfCnpj: '12112174000125', inscEstadual: '10.475.494-0', inscMunicipal: null, endereco: 'AVENIDA LAÉRCIO MENDONÇA TELHO', complemento: null, numero: '33', bairro: 'Setor Central', cidade: 'Vianópolis', uf: 'GO', cep: '75265000', referencia: null, email: null },
  { nome: 'JOSMARI CUBAS CN', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '69966532900', inscEstadual: null, inscMunicipal: null, endereco: 'RUA SDN CONJUNTO NACIONAL', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70677960', referencia: null, email: null },
  { nome: 'IDEAL TELHAS & CONSTRUÇÃO E REFORMAS', nomeFantasia: 'IDEAL TELHAS ISOTERMICAS', tipo: 'juridica', cpfCnpj: '28318991000174', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 12 CHACARA 306, QUADRA 4 LOTE 9 SALA B', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72007695', referencia: null, email: null },
  { nome: 'FORTT TELHAS', nomeFantasia: 'FORTT TELHAS', tipo: 'juridica', cpfCnpj: '53188711000106', inscEstadual: null, inscMunicipal: null, endereco: 'RUA A, Nª 335', complemento: null, numero: null, bairro: 'Loteamento Jardim Europa', cidade: 'Catalão', uf: 'GO', cep: '75711634', referencia: null, email: null },
  { nome: 'GLAUKER ALVES MONTEIRO', nomeFantasia: 'GLAUKER ALVES', tipo: 'fisica', cpfCnpj: '1406815152', inscEstadual: null, inscMunicipal: null, endereco: 'QR 211 CONJ A CASA 06', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72511101', referencia: null, email: null },
  { nome: 'VGA ELETRÔNICOS E TECNOLOGIA LTDA', nomeFantasia: 'VGA TECNOLOGIA', tipo: 'juridica', cpfCnpj: '34122654000100', inscEstadual: null, inscMunicipal: null, endereco: 'RUA MÉRCIA FIGUEIREDO MORAIS, 97', complemento: null, numero: null, bairro: 'Vila Morais', cidade: 'Varginha', uf: 'MG', cep: '37004330', referencia: null, email: null },
  { nome: 'ALPE - LOCAÇÃO DE ESTRUTURAS TUBULARES LTDA', nomeFantasia: 'ALPE', tipo: 'juridica', cpfCnpj: '5484577000130', inscEstadual: null, inscMunicipal: null, endereco: 'AV UNIVERSITÁRIA, Nº 1034 - CIA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Simões Filho', uf: 'BA', cep: '43700000', referencia: null, email: null },
  { nome: 'AREA COMERCIO E INDUSTRIA DE MARMORES E GRANITOS LTDA', nomeFantasia: 'AREA COMERCIO DE MARMORES', tipo: 'juridica', cpfCnpj: '23241475000175', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 03 LOTE 165/195', complemento: null, numero: null, bairro: 'Guará I', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'MIKAELLY MOHN GUIMARÃES', nomeFantasia: 'MIKAELLY MOHN GUIMARÃES', tipo: 'juridica', cpfCnpj: '54194693000120', inscEstadual: null, inscMunicipal: null, endereco: 'CORCOVADO, Nº 20', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'TERMOTECNICA INDUSTRIA E COMERCIO', nomeFantasia: 'TERMOTECNICA INDUSTRIA E COMERCIO', tipo: 'juridica', cpfCnpj: '18224881000351', inscEstadual: '131191086110', inscMunicipal: null, endereco: 'RUA HENRIQUE FELIPE DA COSTA', complemento: null, numero: null, bairro: 'Vila Guilherme', cidade: 'São Paulo', uf: 'SP', cep: '02054050', referencia: null, email: null },
  { nome: 'SANTA LUIZA CONDUTORES ELETRICOS', nomeFantasia: 'SANTA LUIZA CONDUTORES', tipo: 'juridica', cpfCnpj: '3391772000190', inscEstadual: '117159899112', inscMunicipal: null, endereco: 'RUA GASTÃO DA CUNHA ,95', complemento: null, numero: '95', bairro: 'Vila Santa Catarina', cidade: 'São Paulo', uf: 'SP', cep: '04361090', referencia: null, email: null },
  { nome: 'ADORNO ENERGIA LTDA', nomeFantasia: 'ADORNO ENERGIA LTDA', tipo: 'juridica', cpfCnpj: '19635694000161', inscEstadual: null, inscMunicipal: null, endereco: 'AV INDEPENDÊNCIA QD E LT 08', complemento: null, numero: null, bairro: 'Setor Leste Vila Nova', cidade: 'Goiânia', uf: 'GO', cep: '74645010', referencia: null, email: null },
  { nome: 'TRAEL TRANSFORMADORES ELÉTRICOS LTDA', nomeFantasia: 'TRAEL TRANSFORMADORES ELÉTRICOS', tipo: 'juridica', cpfCnpj: '37457942000103', inscEstadual: null, inscMunicipal: null, endereco: 'RUA N, QUADRA 17, Nº244', complemento: null, numero: null, bairro: 'Distrito Industrial', cidade: 'Cuiabá', uf: 'MT', cep: '78098400', referencia: null, email: null },
  { nome: 'ADORNO CONDUTORES ELÉTRICOS LTDA', nomeFantasia: 'ADORNO CONDUTORES ELÉTRICOS LTDA', tipo: 'juridica', cpfCnpj: '49969833000154', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 210, Nº 77, QD 61, LT 01/02', complemento: null, numero: null, bairro: 'Setor Leste Vila Nova', cidade: 'Goiânia', uf: 'GO', cep: '74640140', referencia: null, email: null },
  { nome: 'CLEMIG MATERIAIS ELETRICOS LTDA', nomeFantasia: 'CLEMIG MATERIAIS ELETRICOS', tipo: 'juridica', cpfCnpj: '7512914000180', inscEstadual: '223.369.202/0083', inscMunicipal: null, endereco: 'RUA MINAS GERAIS 2545 GALPÃO', complemento: null, numero: '2545', bairro: 'IPIRANGA', cidade: 'Divinópolis', uf: 'MG', cep: '35502026', referencia: null, email: null },
  { nome: 'REAL PERFIL INDÚSTRIA E COMÉRCIO LTDA', nomeFantasia: 'REAL PERFIL INDÚSTRIA E COMÉRCIO LTDA', tipo: 'juridica', cpfCnpj: '69179448000110', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA NOSSA SENHORA DO Ó,  955', complemento: null, numero: '955', bairro: 'Limão', cidade: 'São Paulo', uf: 'SP', cep: '02715000', referencia: null, email: 'VENDAS@REALPERFIL.COM.BR' },
  { nome: 'ADIEL DOS SANTOS RODRIGUES', nomeFantasia: 'ADIEL DOS SANTOS RODRIGUES', tipo: 'fisica', cpfCnpj: '1692769103', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 15, LOTE 23', complemento: null, numero: null, bairro: 'Loteamento Lunabel 3C', cidade: 'Novo Gama', uf: 'GO', cep: '72862615', referencia: null, email: 'adiel@rcengenharia.com.br' },
  { nome: 'PROVINCIA MARCAS E PATENTES', nomeFantasia: 'PROVINCIA', tipo: 'juridica', cpfCnpj: '41220529000106', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA IGUAÇU, 1412', complemento: null, numero: null, bairro: 'Água Verde', cidade: 'Curitiba', uf: 'PR', cep: '80250190', referencia: null, email: null },
  { nome: 'CONDOMÍNIO DO EDIFÍCIO DOM BOSCO', nomeFantasia: 'SQS 310 - BLOCO C', tipo: 'juridica', cpfCnpj: '86763851000101', inscEstadual: null, inscMunicipal: null, endereco: 'SQS 310, BLOCO C, EDIFÍCIO DOM BOSCO', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70363033', referencia: null, email: null },
  { nome: 'RESTAURANTE CARVALHO SOUSA LTDA', nomeFantasia: 'RESTAURANTE CARVALHO', tipo: 'juridica', cpfCnpj: '31267837000125', inscEstadual: '003.256.656/0072', inscMunicipal: null, endereco: 'RUA JOÃO ALVES FRANCO, 382, CENTRO', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'DULAR CASA PARK', nomeFantasia: 'DULAR', tipo: 'juridica', cpfCnpj: '42737380002488', inscEstadual: '08.070.005/018-14', inscMunicipal: null, endereco: 'ST SGCV 22, ZONA I', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71215720', referencia: null, email: null },
  { nome: 'PERFILADOS TERRA LTDA', nomeFantasia: 'PERFILADOS TERRA LTDA', tipo: 'juridica', cpfCnpj: '2741001000112', inscEstadual: '07.389.117/001-04', inscMunicipal: null, endereco: 'Sia trecho 02 lotes 485/495', complemento: null, numero: '485/495', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'CERAMICA WM LTDA', nomeFantasia: 'CERAMICA WM LTDA', tipo: 'juridica', cpfCnpj: '456850000107', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: 'GO', cep: '72801505', referencia: null, email: null },
  { nome: 'CERAMICA S R LTDA', nomeFantasia: 'CERAMICA SANTA RITA', tipo: 'juridica', cpfCnpj: '299462000151', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA LAÉRCIO MENDONÇA TELHO', complemento: null, numero: null, bairro: 'Setor Central', cidade: 'Vianópolis', uf: 'GO', cep: '75265000', referencia: null, email: null },
  { nome: 'ALEXKSON SANTANA GASPIO LTDA', nomeFantasia: 'ALEXKSON SANTANA', tipo: 'juridica', cpfCnpj: '31000495000182', inscEstadual: null, inscMunicipal: null, endereco: 'RUA CEDRO, Nº S/N, QD. 09, LT 15, BAIRRO BELVEDERE II', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ADYEN DO BRASIL INSTITUIÇÃO DE PAGAMENTO LTDA', nomeFantasia: 'ADYEN DO BRASIL INSTITUIÇÃO DE PAGAMENTO LTDA', tipo: 'juridica', cpfCnpj: '14796606000190', inscEstadual: null, inscMunicipal: null, endereco: 'AV DAS NAÇÕES UNIDAS, ANDAR 8. 9 E 10 - T PAINEIRA', complemento: null, numero: null, bairro: 'Vila Gertrudes', cidade: 'São Paulo', uf: 'SP', cep: '47940000', referencia: null, email: null },
  { nome: 'MORIA PALACE HOTEL LTDA', nomeFantasia: 'MORIA PALACE HOTEL', tipo: 'juridica', cpfCnpj: '20912720000130', inscEstadual: null, inscMunicipal: null, endereco: 'RUA SÃO VICENTE, 78 - COMINIDADE DE GUARDA DOS FERREIROS', complemento: null, numero: null, bairro: 'Centro', cidade: 'Rio Paranaíba', uf: 'MG', cep: '38810000', referencia: null, email: null },
  { nome: 'CÍCERO PINHEIRO SOUZA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '32713460384', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'CENTER PLAZA HOTEL LTDA - ME', nomeFantasia: 'CENTER PLAZA', tipo: 'juridica', cpfCnpj: '19445613000160', inscEstadual: null, inscMunicipal: '37186', endereco: 'RUA 07 DE SETEMBRO, Nª 1806', complemento: null, numero: '1806', bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SAMET - SAUDE E MEDICINA DO TRABALHO', nomeFantasia: 'SAMET', tipo: 'juridica', cpfCnpj: '10546516000190', inscEstadual: null, inscMunicipal: '35585', endereco: 'RUA GETULIO VARGAS, QUADRA 1517, SALA 02', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'IAGO ALVES GALHARDO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '8190106180', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 51 Nº30 VILA ANDRADE', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'DONIZETE CARLOS DE OLIVEIRA', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '61245826000105', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 116 CONJUNTO 02 CASA 11', complemento: null, numero: null, bairro: 'Recanto das Emas', cidade: 'Brasília', uf: 'DF', cep: '72603402', referencia: null, email: null },
  { nome: 'TIJOLO MAIS MATERIAL DE CONSTRUÇÃO EIRELI', nomeFantasia: 'TIJOLO MAIS MATERIAL DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '41775543000168', inscEstadual: null, inscMunicipal: null, endereco: 'QNM 23 CONJ. P LOTE 42 LOJA 01', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72215246', referencia: null, email: null },
  { nome: 'MUD REVESTIMENTOS CERÂMICOS ESPECIAIS LTDA', nomeFantasia: 'MUD REVESTIMENTOS CERÂMICOS', tipo: 'juridica', cpfCnpj: '52129354000134', inscEstadual: null, inscMunicipal: null, endereco: 'BR 153 KM 399', complemento: null, numero: null, bairro: 'Jaranápolis', cidade: 'Pirenópolis', uf: 'GO', cep: '72980000', referencia: null, email: null },
  { nome: 'SILVA SANTOS RESTAURANTE E PRODUTOS NATURAIS LTDA', nomeFantasia: 'BOINA COSTELARIA', tipo: 'juridica', cpfCnpj: '48469445000141', inscEstadual: '08.175.428/001-90', inscMunicipal: null, endereco: 'QUADRA QS 5 AVENIDA AREAL LOTE 07 SN', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71963000', referencia: null, email: null },
  { nome: 'SIA PARAFUSOS E FERRAMENTAS LTDA', nomeFantasia: 'SIA PARAFUSOS', tipo: 'juridica', cpfCnpj: '5902751000117', inscEstadual: null, inscMunicipal: null, endereco: 'Q SIA QUADRA 4-C BLOCO E LOTE 46/49 LOJA 71/73', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200045', referencia: null, email: null },
  { nome: 'LCP LOCAÇÕES E TERRAPLANAGEM LTDA', nomeFantasia: 'LCP LOCAÇÕES E TERRAPLANAGEM', tipo: 'juridica', cpfCnpj: '14969093000171', inscEstadual: '07.597.225/001-00', inscMunicipal: null, endereco: 'SPLM CONJUNTO 15 LOTE 02', complemento: null, numero: '2', bairro: 'Núcleo Bandeirante', cidade: 'Brasília', uf: 'DF', cep: '71710300', referencia: null, email: 'lcpterraplanagem@gmail.com' },
  { nome: 'JAQUELINE CRISTINA CAMPOS DE CARVALHO LTDA', nomeFantasia: 'UNA SHOPPING DA LIMPEZA', tipo: 'juridica', cpfCnpj: '36187254000108', inscEstadual: null, inscMunicipal: null, endereco: 'RUA KALED COSAC ,  57 QUADRA 58A LOTE 14', complemento: null, numero: '57', bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CIPLAN CIMENTO PLANALTO S.A', nomeFantasia: 'CIPLAN CIMENTO', tipo: 'juridica', cpfCnpj: '57240000122', inscEstadual: '07.328.725/001-12', inscMunicipal: null, endereco: 'RODOVIA DF 205 KM 2,7 BAIRRO: FERCAL', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '70151010', referencia: null, email: null },
  { nome: 'ALFA TRANSPORTES LTDA', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '82110818000393', inscEstadual: '336829364119', inscMunicipal: null, endereco: 'RUA ANTÔNIO UTRILLA, 349', complemento: null, numero: null, bairro: 'Cidade Industrial Satélite de São Paulo', cidade: 'Guarulhos', uf: 'SP', cep: '07230650', referencia: null, email: null },
  { nome: 'MINEIRA MATERIAIS PARA CONSTRUÇÃO EIRELI - EPP', nomeFantasia: 'MINEIRA MATERIAIS PARA CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '2477025000106', inscEstadual: null, inscMunicipal: null, endereco: 'RUA ANTÔNIO DE SOUZA LOBO, Nº 15, ESPLANADA DA ESTAÇÃO', complemento: null, numero: null, bairro: 'Setor Central', cidade: 'Vianópolis', uf: 'GO', cep: '75265000', referencia: null, email: null },
  { nome: 'EXCELLENCE ELETRODOMESTICOS LTDA', nomeFantasia: 'EXCELLENCE ELETRODOMESTICOS', tipo: 'juridica', cpfCnpj: '12599728000322', inscEstadual: '261715674', inscMunicipal: null, endereco: 'RUA DONA FRANCISCA, 8300, SALA 51 COND. PERINI B', complemento: null, numero: null, bairro: 'Zona Industrial Norte', cidade: 'Joinville', uf: 'SC', cep: '89219600', referencia: null, email: null },
  { nome: 'CONEXÃO HIDRÁULICA EMPREENDIMENTOS LTDA', nomeFantasia: 'CONEXÃO HIDRÁULICA EMPREENDIMENTOS', tipo: 'juridica', cpfCnpj: '46843331000194', inscEstadual: null, inscMunicipal: '06.11379.22-87', endereco: 'RUA CLODOMIRO CAMPOS DEL-ORTO Nº 293', complemento: null, numero: null, bairro: 'Municipal I', cidade: 'Nova Venécia', uf: 'ES', cep: '29830000', referencia: null, email: null },
  { nome: 'FAVORITA COMÉRCIO DE TINTAS LTDA', nomeFantasia: 'POLAR TINTAS LTDA', tipo: 'juridica', cpfCnpj: '36752710000115', inscEstadual: '07.972.326/001-44', inscMunicipal: null, endereco: 'QUADRA QNN,  18 CONJUNTO B - LOTE 04 S/N', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72220182', referencia: null, email: 'FAVORITA@POLARTINTAS.COM.BR' },
  { nome: 'CASA DOS PARAFUSOS FERRAGENS E FERRAMENTAS LTDA', nomeFantasia: 'CASA DOS PARAFUSOS FERRAGENS E FERRAMENTAS', tipo: 'juridica', cpfCnpj: '37127025000160', inscEstadual: '07.979.207/001-68', inscMunicipal: null, endereco: 'SIA QUADRA 3C AREA ESPECIAL 07 LJS 4', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '71200035', referencia: null, email: 'casadosparafusosdf@yahoo.com' },
  { nome: 'OTTO INDÚSTRIA E COMÉRCIO DE TRANSFORMADORES LTDA', nomeFantasia: 'OTTO INDÚSTRIA', tipo: 'juridica', cpfCnpj: '80935893000104', inscEstadual: '252118537', inscMunicipal: null, endereco: 'RUA PAPA PAULO VI, 73, GALPÃO', complemento: null, numero: null, bairro: 'Ponte do Imaruim', cidade: 'Palhoça', uf: 'SC', cep: '88130780', referencia: null, email: null },
  { nome: 'MESTRE LOURIVALDO CONSTRUÇÃO E REFORMA LTDA', nomeFantasia: 'MESTRE LOURIVALDO DOS SANTOS SILVA', tipo: 'juridica', cpfCnpj: '45226813000132', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 355, LOTE 22, CASA Nº 1, DEL LAGO 2', complemento: null, numero: null, bairro: 'Itapoã I', cidade: 'Brasília', uf: 'DF', cep: '71593500', referencia: null, email: 'mestrelourivaldo92@gmail.com' },
  { nome: 'COMBINC EQUIPAMENTO CONTRA INCÊNDIO E IMPORTAÇÃO', nomeFantasia: 'COMBINC', tipo: 'juridica', cpfCnpj: '55582485000160', inscEstadual: null, inscMunicipal: null, endereco: 'SHA CONJUNTO 4 CHÁCARA 80, I - LOJA 3', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71994450', referencia: null, email: null },
  { nome: 'NADYA NUNES DA SILVA', nomeFantasia: 'ROTA DRONES BSB', tipo: 'juridica', cpfCnpj: '57998179000135', inscEstadual: null, inscMunicipal: null, endereco: '205 7 APT 304 A AGUAS CLARAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71925000', referencia: null, email: null },
  { nome: 'RD FUNDAÇÕES LTDA', nomeFantasia: 'QUEIROZ FUNDAÇÕES', tipo: 'juridica', cpfCnpj: '46205722000183', inscEstadual: null, inscMunicipal: null, endereco: 'SHN QUADRA 01, BLOCO `D`, APTO Nº 909', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70701040', referencia: null, email: 'queirozfundacoes@gmail.com' },
  { nome: 'ANTÔNIO PAULO NETO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '80429793120', inscEstadual: null, inscMunicipal: null, endereco: 'QD 305 CONJUNTO 8A CASA 02', complemento: null, numero: null, bairro: 'Recanto das Emas', cidade: 'Brasília', uf: 'DF', cep: '72621214', referencia: null, email: null },
  { nome: 'HR SONDAGENS LTDA', nomeFantasia: 'HR SONDAGENS', tipo: 'juridica', cpfCnpj: '35040825000114', inscEstadual: '07.942.073/001-46', inscMunicipal: null, endereco: 'COLONIA AGRICOLA AGUAS CLARAS, CHACARA 31', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71070854', referencia: null, email: null },
  { nome: 'SHPP BRASIL INSTITUIÇÃO DE PAGAMENTOS', nomeFantasia: 'SHOPEE', tipo: 'juridica', cpfCnpj: '38372267000182', inscEstadual: null, inscMunicipal: null, endereco: 'R. LEOPOLDO COUTO MAGALHAES', complemento: null, numero: null, bairro: 'Itaim Bibi', cidade: 'São Paulo', uf: 'SP', cep: '04542011', referencia: null, email: null },
  { nome: 'MARCUS VINIVIUS DE OLIVEIRA', nomeFantasia: 'MARCUS VINICIUS DE OLIVEIRA', tipo: 'fisica', cpfCnpj: '91574609734', inscEstadual: null, inscMunicipal: null, endereco: 'STRC CONJUNTO E LOTE 5B- CHACARAS LÚCIO COSTA', complemento: null, numero: null, bairro: 'Quadras Econômicas Lúcio Costa (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71100001', referencia: null, email: null },
  { nome: 'EDEZIO DE OLIVEIRA', nomeFantasia: 'EDEZIO DE OLIVEIRA', tipo: 'fisica', cpfCnpj: '37318284134', inscEstadual: null, inscMunicipal: null, endereco: 'SQ 13, QUADRA 12, CASA 36', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cidade Ocidental', uf: 'GO', cep: '72883128', referencia: null, email: null },
  { nome: 'SPETTACCLO DE CACAO COMÉRCIO DE BOMBONS LTDA', nomeFantasia: 'CACAU SHOW', tipo: 'juridica', cpfCnpj: '33957863000100', inscEstadual: '07.922.426/001-97', inscMunicipal: null, endereco: 'ÁGUAS CLARAS SHOPPING, LOJA 205', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936970', referencia: null, email: null },
  { nome: 'CB ÁGUAS CLARAS COMÉRCIO DE ALIMENTOS LTDA', nomeFantasia: 'COCO BAMBU DF PLAZA', tipo: 'juridica', cpfCnpj: '21322420000164', inscEstadual: null, inscMunicipal: null, endereco: 'RUA COPAÍBA.1 - LOJA 188/193, DF PLAZA', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71919540', referencia: null, email: null },
  { nome: 'LADY PINK COMÉRCIO VAREJISTA LTDA', nomeFantasia: 'KIMMI SO', tipo: 'juridica', cpfCnpj: '10728804000165', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ARAUCÁRIAS, LOTE 1835, 1905, 195', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936970', referencia: null, email: null },
  { nome: 'AR6 COMÉRCIO DE BOMBONIERE E ASSEMELHADO', nomeFantasia: 'BRASIL CACAU', tipo: 'juridica', cpfCnpj: '54577016000190', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ARAUCÁRIAS, LOTE 1835', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936970', referencia: null, email: null },
  { nome: 'UNIÃO PRODUTOS E SERVIÇOS DE  LIMPEZA LTDA - ME', nomeFantasia: 'UNIÃO PRODUTOS DE LIMPEZA', tipo: 'juridica', cpfCnpj: '16966256000198', inscEstadual: null, inscMunicipal: null, endereco: 'QD SES 11 LOTE 06', complemento: null, numero: null, bairro: 'Setor Econômico de Sobradinho (Sobradinho)', cidade: 'Brasília', uf: 'DF', cep: '73020411', referencia: null, email: null },
  { nome: 'LUMIAR TRANSPORTE DISTRUBUIDORA', nomeFantasia: 'LUMIAR TRANSPORTE DISTRIBUIDORA', tipo: 'juridica', cpfCnpj: '55043768000134', inscEstadual: null, inscMunicipal: null, endereco: 'QR 508 CONJ 02 LOTE 25A SAMAMBAIA- SUL', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72312302', referencia: null, email: null },
  { nome: 'TOZETTI MADEIRAS', nomeFantasia: 'TOZETTI MADEIRAS', tipo: 'juridica', cpfCnpj: '23348266000125', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 02 LOTS 395', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'KALUNGA COMÉRCIO E INDUSTRIA GRÁFICA LTDA', nomeFantasia: 'KALUNGA', tipo: 'juridica', cpfCnpj: '43283811001202', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ARUANÃ, 15O', complemento: null, numero: null, bairro: 'Tamboré', cidade: 'Barueri', uf: 'SP', cep: '06460010', referencia: null, email: null },
  { nome: 'LEIDIANE LIONCIO DE SOUZA', nomeFantasia: 'LEIDIANE LIONCIO DE SOUZA', tipo: 'fisica', cpfCnpj: '11818978660', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 13 CASA 12', complemento: null, numero: null, bairro: 'Vila São José (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693014', referencia: null, email: null },
  { nome: 'HODH ATACADISTA DE MATERIAIA PARA CONSTRUÇÃ', nomeFantasia: 'HODH CASA DO GESSO E DRYWALL', tipo: 'juridica', cpfCnpj: '22806485000148', inscEstadual: '07.728.266/001-09', inscMunicipal: null, endereco: 'JARDIM BOTÂNICO - POLO VERDE 4', complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: 'Setor Habitacional Jardim Botânico', email: 'Brasília' },
  { nome: 'J F GESSO', nomeFantasia: 'GESSO DOIS IRMÃOS', tipo: 'juridica', cpfCnpj: '11044388000149', inscEstadual: '07.525.750/001-60', inscMunicipal: null, endereco: 'QS 10 LOTE 89/90', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71978000', referencia: null, email: null },
  { nome: 'JEFERSON SANTOS DA SILVA', nomeFantasia: 'JEFERSON SANTOS DA SILVA', tipo: 'fisica', cpfCnpj: '2286875197', inscEstadual: null, inscMunicipal: null, endereco: 'RUA Nº 40, CASA 6, BAIRRO VILA NOVA', complemento: null, numero: null, bairro: 'Vila Nova (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693143', referencia: null, email: null },
  { nome: 'BRASMAQ SERVIÇOS E MANUTENÇÕES EIRELI', nomeFantasia: 'BRASMAQ SERVIÇOS', tipo: 'juridica', cpfCnpj: '19377025000137', inscEstadual: null, inscMunicipal: null, endereco: 'ST SMA CONJUNTO B S/N LOJA 19', complemento: null, numero: null, bairro: 'Gama', cidade: 'Brasília', uf: 'DF', cep: '72429010', referencia: null, email: null },
  { nome: 'ANDAIMES REMO LTDA', nomeFantasia: 'ANDAIMES REMO LTDA', tipo: 'juridica', cpfCnpj: '1596600000127', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA SAAN QUADRA 2, 1235', complemento: null, numero: null, bairro: 'Setor Comercial Central (Planaltina)', cidade: 'Brasília', uf: 'DF', cep: '70632260', referencia: null, email: 'locacao@andaimesremo.com.br' },
  { nome: 'ROBSON PORTUGAL', nomeFantasia: 'ROBSON PORTUGAL', tipo: 'fisica', cpfCnpj: '66415918672', inscEstadual: null, inscMunicipal: null, endereco: 'EQNP 24/28 MÓDULO D', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72235534', referencia: null, email: 'atendimento@rcengenharia.com.br' },
  { nome: 'VALLORI REVESTIMENTOS CERÂMICOS', nomeFantasia: 'VALLORI', tipo: 'juridica', cpfCnpj: '2635545000108', inscEstadual: '07.387.190/001-24', inscMunicipal: null, endereco: 'SIA TRECHO 4 LOTE 2000 LOJA 24 ED SALVADOR AVERSA', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '71200040', referencia: null, email: null },
  { nome: 'ESTRUTURA CENTER MATERIAIS PARA CONSTRUÇÃO', nomeFantasia: 'ESTRUTURA CENTER MATERIAIS PARA COMSTRUÇÃO', tipo: 'juridica', cpfCnpj: '1739265000179', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 03 LOTES 1390/1400', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71215300', referencia: null, email: null },
  { nome: 'ABM PRODUÇÕES LTDA', nomeFantasia: 'ABM PRODUÇÕES', tipo: 'juridica', cpfCnpj: '15338166000190', inscEstadual: null, inscMunicipal: '760435700110', endereco: 'SETOR SHIN CA 01 LOTE A BLOCO A SALA 371 PAVIMENTO 3, LAGO NORTE', complemento: null, numero: null, bairro: 'Setor de Habitações Individuais Norte', cidade: 'Brasília', uf: 'DF', cep: '71503501', referencia: null, email: null },
  { nome: 'MATHEUS HENRIQUE BENATTI BARBOSA', nomeFantasia: 'MATHEUS HENRIQUE BENATTI BARBOSA', tipo: 'fisica', cpfCnpj: '3045906141', inscEstadual: null, inscMunicipal: null, endereco: 'RUA E, ÁREA B, RESIDENCIAL FLORENÇA, APT 502', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73580000', referencia: null, email: 'adessoincorporadora@gmail.com' },
  { nome: 'ELETRICA WOLSCHICK LTDA', nomeFantasia: 'ELETRICA WOLSCHICK', tipo: 'juridica', cpfCnpj: '33232554000173', inscEstadual: '10.205.012-0', inscMunicipal: null, endereco: 'RUA 3 QUADRA 3 LOTE 7 S/N', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PEREIRA E FERREIRA COMÉRCIO E SERVIÇO DE PORTAS', nomeFantasia: 'EUROPORTAS', tipo: 'juridica', cpfCnpj: '50892452000101', inscEstadual: '08.223.114/001-50', inscMunicipal: null, endereco: 'QS 5 RUA 300 LOTE 16 - LOJA 3 E 4', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71961540', referencia: null, email: null },
  { nome: 'MIGUEL SINHO SOARES LTDA', nomeFantasia: 'MP PRE MOLDADOS', tipo: 'juridica', cpfCnpj: '55405537000123', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra 2 Conjunto a, 18 - BAIRRO FAZENDINHA', complemento: null, numero: null, bairro: 'Itapoã I', cidade: 'Brasília', uf: 'DF', cep: '71596223', referencia: null, email: null },
  { nome: 'ADS COMÉRCIO DE ESCORAMENTOS LTDA', nomeFantasia: 'ADS COMÉRCIO DE ESCORAMENTO', tipo: 'juridica', cpfCnpj: '51029469000194', inscEstadual: null, inscMunicipal: null, endereco: 'LOTE 03 RUA 30 NORTE, LOTE 04 BLOCO A SALA 305', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71918180', referencia: null, email: null },
  { nome: 'PLASTICON COMERCIO LTDA', nomeFantasia: 'PLASTICON COMERCIO LTDA', tipo: 'juridica', cpfCnpj: '23848502000172', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Auriverde', complemento: null, numero: '1697', bairro: 'Vila Independência', cidade: 'São Paulo', uf: 'SP', cep: '04222002', referencia: null, email: 'administrativo@plasticon.com.br' },
  { nome: 'CRISTALINA MATERIAIS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'CRISTALINA MATERIAIS PARA  CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '53528746000139', inscEstadual: '20.110.893-3', inscMunicipal: null, endereco: 'RUA SÃO CRISTOVÃO QUADRA 1 LOTE 10', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'FRANCISCO JORGE DE LIMA VALENTIM', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '2973188377', inscEstadual: null, inscMunicipal: null, endereco: 'AV.KALED COSAC, Nº 1778, QD 5', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ANTÔNIO FRANCILDO ALMEIDA DE LIMA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '60705934306', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 5, Nº 6, QD 84 LOTE 06', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'THAYNÁ HAUPKA ARQUITETURA E INTERIORES', nomeFantasia: 'THAYNÁ HAUPKA COSTA', tipo: 'fisica', cpfCnpj: '4202189124', inscEstadual: null, inscMunicipal: null, endereco: 'RUA JOÃO TOBIAS, Nº 15', complemento: null, numero: null, bairro: 'Presidente Roosevelt', cidade: 'Uberlândia', uf: 'MG', cep: '38401066', referencia: null, email: null },
  { nome: 'MANOEL RIBEIRO DA CONCEIÇÃO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '2055185160', inscEstadual: null, inscMunicipal: null, endereco: 'RUA SÃO JOÃO IV, QD 93, LT 30, VILA SÃO JOÃO', complemento: null, numero: null, bairro: 'CIDADE NOVA', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'VALDIR COELHO DE OLIVEIRA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '8760488824', inscEstadual: null, inscMunicipal: null, endereco: 'RUA RIO GRANDE DO SUL, Nº 333, QD 112, LT 02', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ELEVADORES ATLAS SCHINDLER S/A', nomeFantasia: 'ELEVADORES ATLAS SCHINDLER', tipo: 'juridica', cpfCnpj: '28986000108', inscEstadual: null, inscMunicipal: '23057238', endereco: 'AVENIDA DO ESTADO 6116', complemento: null, numero: null, bairro: 'Cambuci', cidade: 'São Paulo', uf: 'SP', cep: '01516900', referencia: null, email: null },
  { nome: 'BC FERRAMENTARIA', nomeFantasia: 'BC FERRAMENTARIA', tipo: 'juridica', cpfCnpj: '31539004000176', inscEstadual: '07.878.264/001-67', inscMunicipal: null, endereco: 'TR SIA TRECHO 3', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'DIONATA RODRIGUES BONTEMPO', nomeFantasia: 'DIONATA RODRIGUES BONTEMPO', tipo: 'fisica', cpfCnpj: '5649434107', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 40 ,QD 17  LOTE 09 CRISTALINA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'LURDINHA IMOVEIS LTDA ME', nomeFantasia: 'LURDINHA IMOVEIS LTDA ME', tipo: 'juridica', cpfCnpj: '43640883000107', inscEstadual: null, inscMunicipal: null, endereco: 'RUA GAMELEIRAS ,261 CAMPESTRE', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'ELIZEU MONTEIRO DE MIRANDA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '78021316268', inscEstadual: null, inscMunicipal: null, endereco: 'RUA FORTUNATO BOTELHO, QD 55, LOTE 14', complemento: null, numero: null, bairro: 'SETOR AEROPORTO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'JARDEL MÁRCIO GUEDES SILVA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '68647735234', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 09, QD 29, LOTE 3388', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'LUIZ CARLOS SILVA COSTA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '73734969387', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 8, QD 17, LT 416, CRISTALINA VELHA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ALMIR DOMINGO MIOTTI', nomeFantasia: 'FAZENDA CRISTAL', tipo: 'fisica', cpfCnpj: '44165358053', inscEstadual: '11.208.842-2', inscMunicipal: null, endereco: 'ROD BR 040, S/N , A DIREITA', complemento: null, numero: null, bairro: 'ZONA RURAL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'BRUNO RAMON NOVAIS DE SOUZA', nomeFantasia: 'BRUNO RAMON NOVAIS DE SOUZA', tipo: 'juridica', cpfCnpj: '58064728000167', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 6 CONJUNTO 14,19 SETOR OESTE', complemento: null, numero: null, bairro: 'Vila Estrutural', cidade: 'Brasília', uf: 'DF', cep: '71256390', referencia: null, email: null },
  { nome: 'JOSÉ ARNALDO MARINHO DA SILVA', nomeFantasia: 'JOSÉ ARNALDO MARINHO DA SILVA', tipo: 'juridica', cpfCnpj: '31539390000104', inscEstadual: null, inscMunicipal: null, endereco: 'INACIO JORGE DOS SANTOS SN, HENRIQUE CORTES', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'GLORIA MARMORES E GRANTITOS EIRELI', nomeFantasia: 'GLORIA MARMORARIA', tipo: 'juridica', cpfCnpj: '35512650000109', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 123, LOTE 08', complemento: null, numero: null, bairro: 'Parque Estrela Dalva XV', cidade: 'Santo Antônio do Descoberto', uf: 'GO', cep: '72902760', referencia: null, email: 'adm@gloriamarmores.com' },
  { nome: 'VGS COMÉRCIO VAREJISTA DE MATERIAL DE CONSTRUÇÃO LTDA', nomeFantasia: 'CAMPEÃO DA CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '34903950000148', inscEstadual: '07.939.731/001-89', inscMunicipal: null, endereco: 'SIA TRECHO 2 N 720', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200027', referencia: null, email: null },
  { nome: 'ACHEI PARAFUSOS E ACESSORIOS', nomeFantasia: 'ACHEI PARAFUSOS E ACESSORIOS', tipo: 'juridica', cpfCnpj: '51614067000157', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA KALED COZAC, 407 - A QUADRA C LOTE 407 A', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'acheiparafusos@gmail.com' },
  { nome: 'PÃO DO SENHOR GASTRONOMIA LTDA', nomeFantasia: 'LE PAIN RUSTIQUE', tipo: 'juridica', cpfCnpj: '52658710000107', inscEstadual: '08.255.749/001-91', inscMunicipal: null, endereco: 'AVENIDA ARAUCÁRIAS, LOTE 1325', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'MULT-TELAS INDUSTRIA COMÉRCIO LTDA-ME', nomeFantasia: 'MULT-TELAS', tipo: 'juridica', cpfCnpj: '4944186000198', inscEstadual: '07.431.631/001-18', inscMunicipal: null, endereco: 'QNH ÁREA ESPECIAL 3, ARMAZÉM 12', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72130603', referencia: null, email: null },
  { nome: 'WM DRYWALL SERVIÇOS E ACABAMENTOS EM GESSO LTDA', nomeFantasia: 'WM DRYWALL & FORROS', tipo: 'juridica', cpfCnpj: '21378226000109', inscEstadual: null, inscMunicipal: '770162600130', endereco: 'QS 412 CONJUNTO E LOTE 01 APT 206 S/N', complemento: null, numero: null, bairro: 'Samambaia Norte (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72320555', referencia: null, email: null },
  { nome: 'SUL MADEIRAS LTDA', nomeFantasia: 'SUL MADEIRAS', tipo: 'juridica', cpfCnpj: '46643222000123', inscEstadual: null, inscMunicipal: null, endereco: 'RIO DE JANEIRO QD 33 LOTE 11', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'FRANCISCO CARLOS MARTINS VIEIRA', nomeFantasia: 'FRANCISCO CARLOS MARTINS VIEIRA', tipo: 'fisica', cpfCnpj: '37626337115', inscEstadual: null, inscMunicipal: null, endereco: 'CHACARA 122 B LOTE 19 TAGUATINGA', complemento: null, numero: null, bairro: 'Setor de Desenvolvimento Econômico (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72001735', referencia: null, email: null },
  { nome: 'J C SILVA SERRALHERIA LTDA', nomeFantasia: 'J C SERRALHERIA', tipo: 'juridica', cpfCnpj: '46127487000179', inscEstadual: null, inscMunicipal: null, endereco: 'QNO 17 CONJ 22 LOTE 09', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72260722', referencia: null, email: null },
  { nome: 'ADELSON VIEIRA DE MELO', nomeFantasia: 'ADELSON VIEIRA DE MELO', tipo: 'fisica', cpfCnpj: '63547473187', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 52, Nº S/N, QD 21 LT 11 ZONA SUL NOVA', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'FRANCISCO DE ASSIS CARREIRO FILHO', nomeFantasia: 'FRANCISCO DE ASSIS CARREIRO FILHO', tipo: 'fisica', cpfCnpj: '48418528168', inscEstadual: null, inscMunicipal: null, endereco: 'SHA CONJUNTO 6 CHACARA 18F, 15', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71996165', referencia: null, email: null },
  { nome: 'DESSINE COMERCIOE SERVIÇOS DE ILUMINAÇÃO', nomeFantasia: 'DESSINE COMERCIO DE ILUMINAÇÃO', tipo: 'juridica', cpfCnpj: '15472593000166', inscEstadual: null, inscMunicipal: null, endereco: 'SCIA QUADRA 08 CONJUNTO 08 LOTE 08', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71250710', referencia: null, email: null },
  { nome: 'J.R.I. INDÚSTRIA  GOIANA DE TINTAS LTDA', nomeFantasia: 'MAXVINIL TINTAS', tipo: 'juridica', cpfCnpj: '5909938000142', inscEstadual: null, inscMunicipal: null, endereco: 'Quadra012 Lote 0003, S/N', complemento: null, numero: null, bairro: 'All Park Polo Empresarial', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74985220', referencia: null, email: 'ailtonmendes@jri.ind.br' },
  { nome: 'ARENAN EXTRAÇÃO E COMERCIO DE AREIA LTDA', nomeFantasia: 'ARENAN EXTRAÇÃO', tipo: 'juridica', cpfCnpj: '1126983000170', inscEstadual: null, inscMunicipal: null, endereco: 'RODOVIA GO 10KM 60 ZONA RURALORIZONA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'AREIAL MATARAZZO MOURA LTDA', nomeFantasia: 'AREIAL MOURA', tipo: 'juridica', cpfCnpj: '47691937000114', inscEstadual: null, inscMunicipal: null, endereco: 'ROD. GO 309, KM23 CRISTALINA  FAZ. LARGA DO PORTO', complemento: null, numero: null, bairro: 'ZONA RURAL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'NORTE LUMI INDUSTRIA E COMERCIO DE METAIS LTDA', nomeFantasia: 'NORTE LUMI', tipo: 'juridica', cpfCnpj: '11333460000158', inscEstadual: null, inscMunicipal: null, endereco: 'RUA DOZE DE SETEMBRO 1387', complemento: null, numero: null, bairro: 'Jardim São Paulo(Zona Norte)', cidade: 'São Paulo', uf: 'SP', cep: '02052001', referencia: null, email: null },
  { nome: 'ALUMY SERVIÇOS INSTALAÇÃO LTDA', nomeFantasia: 'ALUMY SERVIÇOS', tipo: 'juridica', cpfCnpj: '40344967000105', inscEstadual: null, inscMunicipal: null, endereco: 'AREA ADE CONJUNTO 20,36', complemento: null, numero: null, bairro: 'Área de Desenvolvimento Econômico (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71989300', referencia: null, email: null },
  { nome: 'MAX COMERCIO E INDUSTRIA DE ALUMINIOS LTDA', nomeFantasia: 'MAX COMERCIO E INDUSTRIA', tipo: 'juridica', cpfCnpj: '55136773000191', inscEstadual: null, inscMunicipal: null, endereco: 'SHA CONJUNTO 1 CHACARA 44C,5', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71993150', referencia: null, email: null },
  { nome: 'MAIS OPÇÃO MÓVEIS', nomeFantasia: 'JUNIOR SOARES BATISTA', tipo: 'fisica', cpfCnpj: '271227516', inscEstadual: null, inscMunicipal: null, endereco: 'AV KALED COSAC QD 6', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'REDE DA CONSTRUÇÃO LTDA', nomeFantasia: 'SÃO SEBASTIÃO MATERIAIS DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '10856491000201', inscEstadual: '10.448.870-0', inscMunicipal: null, endereco: 'RUA TAMOIOS QD U LTS 191/194', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'VITOR POÇOS ARTESIANOS LTDA - EPP', nomeFantasia: 'VITOR POÇOS ARTESIANOS', tipo: 'juridica', cpfCnpj: '14218458000126', inscEstadual: null, inscMunicipal: '36442', endereco: 'RODOVIA BR 040, FAZENDA ACABA RABO, S/N KM 92', complemento: null, numero: null, bairro: 'ZONA RURAL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ATACADÃO DAS TINTAS G. W. LTDA', nomeFantasia: 'ATACADÃO DAS TINTAS', tipo: 'juridica', cpfCnpj: '50127275000169', inscEstadual: '08.208.529/001-18', inscMunicipal: null, endereco: 'ADE CONJUNTO 10 LOTE 06 LOJA 01 ECON - ÁGUAS CLARS', complemento: null, numero: null, bairro: 'Área de Desenvolvimento Econômico (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71986180', referencia: null, email: null },
  { nome: 'CADEIRAS DESIGN LTDA', nomeFantasia: 'CADEIRAS DESIGN', tipo: 'juridica', cpfCnpj: '22614874000171', inscEstadual: null, inscMunicipal: null, endereco: 'SGCV LOTE 22 Q 18 PED.14', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71215100', referencia: null, email: null },
  { nome: 'PBG S/A', nomeFantasia: 'CERÂMICA PORTOBELLO', tipo: 'juridica', cpfCnpj: '83475913000272', inscEstadual: null, inscMunicipal: null, endereco: 'ESTRADA BR 101 KM 163', complemento: null, numero: null, bairro: 'Centro', cidade: 'Tijucas', uf: 'SC', cep: '88200000', referencia: null, email: null },
  { nome: 'ANS INSTALAÇÕES EIRELI ME', nomeFantasia: 'LCA INOVAÇÕES', tipo: 'juridica', cpfCnpj: '35042322000188', inscEstadual: null, inscMunicipal: '1111114342', endereco: 'ACESSO Q 4 MR 4 LT 16', complemento: null, numero: null, bairro: 'Setor Sul', cidade: 'Planaltina', uf: 'GO', cep: '73753063', referencia: null, email: null },
  { nome: 'ARCELORMITTAL BRASIL S.A. CENTRO LOGÍSTICO BRASÍLIA 2', nomeFantasia: 'ARCELORMITTAL', tipo: 'juridica', cpfCnpj: '17469701026133', inscEstadual: '07.445.969/005-50', inscMunicipal: null, endereco: 'ST SAI / SUDOESTE LOTE 25 S/N', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71219010', referencia: null, email: null },
  { nome: 'PORCELANATARIA CORTE E LAPIDAÇÃO DE PORCELANATO LTDA', nomeFantasia: 'PORCELANATARIA', tipo: 'juridica', cpfCnpj: '13729384000120', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 01 LOTE 810 PARTE A', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70632100', referencia: null, email: null },
  { nome: 'CC VALPARAISO ALUG EQUIPAMENTOS', nomeFantasia: 'CASA CONSTRUTOR', tipo: 'juridica', cpfCnpj: '7000832000157', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 11 QUADRA 36,6 MORADA NOBRE', complemento: null, numero: null, bairro: 'Valparaiso I - Etapa A', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72870339', referencia: null, email: null },
  { nome: 'GILBERTO BORGES DO PRADO JUNIOR', nomeFantasia: 'GILBERTO BORGES DO PRADO JUNIOR', tipo: 'fisica', cpfCnpj: '3260734180', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 22, CONJUNTO `2`, LOTE 07, CASA `C` - SMPW', complemento: null, numero: null, bairro: 'Park Way', cidade: 'Brasília', uf: 'DF', cep: '71745202', referencia: null, email: null },
  { nome: 'ED SERVIÇOS E LOCAÇÕES EIRELI ME', nomeFantasia: 'ED LOCAÇÕES', tipo: 'juridica', cpfCnpj: '19515492000186', inscEstadual: null, inscMunicipal: '36758', endereco: 'RUA 02 QD 01 LT 14 A S/N HENRIQUE CORTES', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'BESSA INSTALAÇÃO', nomeFantasia: 'BESSA INSTALAÇÃO', tipo: 'fisica', cpfCnpj: '1970246103', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 116', complemento: null, numero: null, bairro: 'Mansões Recreio Estrela D`Alva III', cidade: 'Cidade Ocidental', uf: 'GO', cep: '72887390', referencia: null, email: null },
  { nome: 'OSMAR JOSE PARREIRA', nomeFantasia: 'MESTRE OSMAR JOSÉ PARREIRA', tipo: 'fisica', cpfCnpj: '39383644672', inscEstadual: null, inscMunicipal: null, endereco: 'AV. RONDON PACHECO 6.400', complemento: null, numero: null, bairro: 'Tibery', cidade: 'Uberlândia', uf: 'MG', cep: '38405142', referencia: null, email: null },
  { nome: 'PROXYS COMERCIO ELETRONICOS LTDA', nomeFantasia: 'PROXYS COMERCIO', tipo: 'juridica', cpfCnpj: '11027350000753', inscEstadual: null, inscMunicipal: null, endereco: 'RUA LUIZ GATTI 603 , 3 CD BALLAGIO', complemento: null, numero: null, bairro: 'Água Branca', cidade: 'São Paulo', uf: 'SP', cep: '05038150', referencia: null, email: null },
  { nome: 'ACESSORIOS E FANTASIAS LTDA', nomeFantasia: 'CASA E FESTAS', tipo: 'juridica', cpfCnpj: '26525433000405', inscEstadual: null, inscMunicipal: null, endereco: 'ST SHA CJ 06 CH 18 LOTE 04', complemento: null, numero: null, bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71995040', referencia: null, email: null },
  { nome: 'SPETTACCLO DI CACAO COMERCIO DE BOMBONS', nomeFantasia: 'CACAU SHOW', tipo: 'juridica', cpfCnpj: '33957863000100', inscEstadual: null, inscMunicipal: null, endereco: 'ARAUCARIAS ,205, LT 835/205', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71925000', referencia: null, email: null },
  { nome: 'BIOAGUAS ARAUCARIAS COMERCIO VAREJISTA', nomeFantasia: 'BIO MUNDO', tipo: 'juridica', cpfCnpj: '37583345000125', inscEstadual: null, inscMunicipal: null, endereco: 'ARAUCARIAS PISO 1 LOJA A103', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'RD COMERCIO DE MOVEIS LTDA', nomeFantasia: 'RD MOVEIS', tipo: 'juridica', cpfCnpj: '42959775000139', inscEstadual: null, inscMunicipal: null, endereco: 'PRACA SAO SEBASTIÃO', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'CK MAIS INSUMOS LTDA', nomeFantasia: 'CK MAIS INSUMOS', tipo: 'juridica', cpfCnpj: '46856634000141', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA JOAO BATISTA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Santo Antônio do Jardim', uf: 'SP', cep: '04436000', referencia: null, email: null },
  { nome: 'COMERCIAL PLANALTO PRODUTOS PARA LIMPEZA', nomeFantasia: 'PLANALTO MATERIAIS DE LIMPEZA', tipo: 'juridica', cpfCnpj: '49085429000118', inscEstadual: null, inscMunicipal: null, endereco: 'QS 05 PRAÇA AGUAS CLARAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71961800', referencia: null, email: null },
  { nome: 'H D A PORFIRIO BORGES', nomeFantasia: 'BRULIMP PRODUTOS DE LIMPEZA', tipo: 'juridica', cpfCnpj: '41383820000197', inscEstadual: null, inscMunicipal: '1132659', endereco: 'RUA 5, Nº 22', complemento: null, numero: null, bairro: 'Vila Carolina', cidade: 'Formosa', uf: 'GO', cep: '73803240', referencia: null, email: null },
  { nome: 'ALCIENE DOS SANTOS AMORIM', nomeFantasia: 'SYSTEM', tipo: 'fisica', cpfCnpj: null, inscEstadual: null, inscMunicipal: null, endereco: 'QD CRS 505 BLOCO A 101', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70350510', referencia: null, email: null },
  { nome: 'FREDERICO SOARES DE ARAGÃO', nomeFantasia: 'FREDERICO SOARES DE ARAGÃO', tipo: 'fisica', cpfCnpj: '53899393104', inscEstadual: null, inscMunicipal: null, endereco: 'SHN QD 1 BLOCO F SALA 1012', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70701000', referencia: null, email: null },
  { nome: 'RAFAEL ANDRE MULLER', nomeFantasia: 'RM ENGENHARIA - RAFAEL ANDRE MULLER', tipo: 'fisica', cpfCnpj: '57508313100', inscEstadual: null, inscMunicipal: '10634', endereco: 'AV. KALED COSAC, N 1435 SALA 01', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PENTEADO TOPOGRAFIA LTDA', nomeFantasia: 'PENTEADO TOPOGRAFIA LTDA', tipo: 'juridica', cpfCnpj: '2404983000157', inscEstadual: null, inscMunicipal: '6556', endereco: 'RUA 21 DE ABRIL, Nº 401, SALA 01', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'HASSAN KALLOUT', nomeFantasia: 'HASSAN KALLOUT', tipo: 'juridica', cpfCnpj: '14988892000195', inscEstadual: null, inscMunicipal: '36322', endereco: 'RUA GOIAS, Nº 119, QD H, LT 375', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ITALO GOMES DIAS DE SOUSA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '8253523122', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 10 CASA 100', complemento: null, numero: null, bairro: 'São Francisco (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71693321', referencia: null, email: null },
  { nome: 'PONTO DO CONSTRUTOR LTDA', nomeFantasia: 'PONTO DO CONSTRUTOR LTDA', tipo: 'juridica', cpfCnpj: '45115130000108', inscEstadual: '08.112.813/001-23', inscMunicipal: null, endereco: 'SHIS CL 01 15 BL C LJ 70, LAGO SUL', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '71635560', referencia: null, email: null },
  { nome: 'JCM NITEROI REFRIGERAÇÃO LTDA', nomeFantasia: 'CLIMA RIO', tipo: 'juridica', cpfCnpj: '8824171002000', inscEstadual: '00.775.029/400-24', inscMunicipal: null, endereco: 'ST SIA TRECHO 04 LT 620/640', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200040', referencia: null, email: null },
  { nome: 'SM ENGENHARIA E COMÉRCIO LTDA', nomeFantasia: 'SEYPE ENGENHARIA E AUTOMAÇÃO', tipo: 'juridica', cpfCnpj: '53656870000180', inscEstadual: null, inscMunicipal: null, endereco: 'SHIS QI 23, CONJUNTO 10, CASA 19', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '71660100', referencia: null, email: null },
  { nome: 'PREFEITURA MUNICIPAL DE FORMOSA - GO', nomeFantasia: 'PREFEITURA DE FORMOSA', tipo: 'juridica', cpfCnpj: '1738780000134', inscEstadual: null, inscMunicipal: null, endereco: 'PRAÇA RUI BARBOSA, 208', complemento: null, numero: null, bairro: 'Centro', cidade: 'Formosa', uf: 'GO', cep: '73801220', referencia: null, email: null },
  { nome: 'PEDRO HENRIQUE DA SILVA DOS SANTOS', nomeFantasia: 'PEDRO HENRIQUE', tipo: 'fisica', cpfCnpj: '70747189129', inscEstadual: null, inscMunicipal: null, endereco: 'QD 01, MR 05 LOTE 37 APTO 01', complemento: null, numero: null, bairro: 'Setor Leste', cidade: 'Planaltina', uf: 'GO', cep: '73752017', referencia: null, email: null },
  { nome: 'JL SOLAR INSTALAÇÕES E MONTAGENS ELÉTRICAS', nomeFantasia: 'JL SOLAR INSTALAÇÕES E MONTAGENS ELÉTRICAS', tipo: 'juridica', cpfCnpj: '6039692000168', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida Antonio Antunes Júnior', complemento: null, numero: null, bairro: 'Parque Residencial Dom Lafaiete Libânio', cidade: 'São José do Rio Preto', uf: 'SP', cep: '15046200', referencia: null, email: null },
  { nome: 'NDF SERVIÇOS DE GARAGENS LTDA', nomeFantasia: 'SERVIÇO DE GARAGENS', tipo: 'juridica', cpfCnpj: '32633203000292', inscEstadual: null, inscMunicipal: null, endereco: 'QS 1 RUA 212 LT 17 LOTE 19, 21, 23 BLOCO D SALA 513', complemento: null, numero: null, bairro: 'Taguatinga Centro (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71950550', referencia: null, email: null },
  { nome: 'BRACOL LOCAÇÃO DE MAQUINAS E EQUIPAMENTOS - EIRELLI', nomeFantasia: 'BRACOL LOCAÇÃO DE MAQUINAS E EQUIPAMENTOS - EIRELLI', tipo: 'juridica', cpfCnpj: '21333890000123', inscEstadual: '07.700.914/001-69', inscMunicipal: null, endereco: 'QUADRA 01 LOTE 810 PARTE A', complemento: null, numero: '510', bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70632100', referencia: null, email: 'COMERCIAL@BRACOLLOCACOES.COM.BR' },
  { nome: 'NESTLE BRASIL LTDA', nomeFantasia: 'NESTLE', tipo: 'juridica', cpfCnpj: '60409075000152', inscEstadual: null, inscMunicipal: null, endereco: 'R DR RUBENS GOMES BUENO N 691 EDIF TORRE SIGMA ANDAR 19 AO 28', complemento: null, numero: null, bairro: 'Várzea de Baixo', cidade: 'São Paulo', uf: 'SP', cep: '47309030', referencia: null, email: null },
  { nome: 'GOVERNO DO DISTRITO FEDERAL', nomeFantasia: 'COORDENAÇÃO DO ISS', tipo: 'juridica', cpfCnpj: '394601000126', inscEstadual: null, inscMunicipal: null, endereco: 'PRAÇA DO BURITI - PALÁCIO DO BURITI ZONA CÍVICO - ADMINISTRATIVA', complemento: null, numero: null, bairro: 'Setores Complementares', cidade: 'Brasília', uf: 'DF', cep: '70075900', referencia: null, email: null },
  { nome: 'PREFEITURA MUNICIPAL DE PLANALTINA DE GOIÁS', nomeFantasia: 'MUNICÍPIO DE PLANALTINA - ESTADO DE GOIÁS', tipo: 'juridica', cpfCnpj: '1740422000166', inscEstadual: null, inscMunicipal: null, endereco: 'PRAÇA JURANDIR CAMILO BOAVENTURA, Nº S/N', complemento: null, numero: null, bairro: 'Setor Oeste', cidade: 'Planaltina', uf: 'GO', cep: '73750005', referencia: null, email: null },
  { nome: 'ESCOLA BRITÂNICA DE BRASÍLIA LTDA', nomeFantasia: 'ESCOLA BRITÂNICA DE BRASÍLIA', tipo: 'juridica', cpfCnpj: '24387009000165', inscEstadual: '07.760.279/001-63', inscMunicipal: null, endereco: 'Q SHIS QI 07/09, LOTE F, S/N', complemento: null, numero: null, bairro: 'Lago Sul', cidade: 'Brasília', uf: 'DF', cep: '71615370', referencia: null, email: null },
  { nome: 'RENOVA INDUSTRIA  E COMERCIO DE CONDUTORES E ELETRICOS EIRELLI', nomeFantasia: 'RENOVA CONDUTORES ELETRICOS', tipo: 'juridica', cpfCnpj: '33935882000136', inscEstadual: null, inscMunicipal: null, endereco: 'RODOVIA FERNANDO DIAS  KM 560', complemento: null, numero: null, bairro: 'Vila São Rafael', cidade: 'Guarulhos', uf: 'SP', cep: '07053171', referencia: null, email: null },
  { nome: 'ALTIPLANO PREMOLDADOS E SERVIÇOS', nomeFantasia: 'J.G  SERVIÇOS DE PREMOLDADOS  LTDA - ME', tipo: 'juridica', cpfCnpj: '11020300000159', inscEstadual: null, inscMunicipal: null, endereco: 'SOTOR  ALTIPLANO LESTE CH, 12 R.09 -SHIS - LAGO SUL', complemento: null, numero: null, bairro: 'Lago Sul', cidade: 'Brasília', uf: 'DF', cep: '71675205', referencia: null, email: null },
  { nome: 'SANTA LUZ COMERCIO DE CALÇADOS EIRELI - ME', nomeFantasia: 'CONSTANCE', tipo: 'juridica', cpfCnpj: '35161920000176', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA DAS ARAUCARIAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'OLÍVIO DE OLIVEIRA PENTEADO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '37428969972', inscEstadual: '11.275.280-2', inscMunicipal: null, endereco: 'RUA 21 DE ABRIL Nº 536 - FAZENDA LAGES', complemento: null, numero: null, bairro: 'ZONA RURAL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SAINT-GOBAIN DO BRASIL PRODUTOS INDUSTRIAIS E PARA CONSTRUÇÃO LTDA', nomeFantasia: 'QUARTZOLIT', tipo: 'juridica', cpfCnpj: '61064838014193', inscEstadual: '10.551.799-2', inscMunicipal: null, endereco: 'CHACARAS N 436,450- A E 471 S/N SETOR NORTE PLANALTINA', complemento: null, numero: null, bairro: 'Setor Norte', cidade: 'Planaltina', uf: 'GO', cep: '73751590', referencia: null, email: null },
  { nome: 'BENEDITO DAMASCENO DE CARVALHO', nomeFantasia: 'BENEDITO DAMASCENO DE CARVALHO', tipo: 'fisica', cpfCnpj: '864660111', inscEstadual: null, inscMunicipal: null, endereco: 'RUA TAMBURIL, QD 05 LT 49, BELVEDERE', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'XM SERVIÇOS DE HIGIENIZAÇÃO LTDA', nomeFantasia: 'XEQUE MATE CONTROLE DE PRAGAS', tipo: 'juridica', cpfCnpj: '13729952000192', inscEstadual: null, inscMunicipal: null, endereco: 'QN 318, CONJ, 03 - LOTE 07  -  SAMANBAIA SUL', complemento: null, numero: '7', bairro: 'LOJA 01', cidade: 'Brasília', uf: 'DF', cep: '72308703', referencia: null, email: null },
  { nome: 'R8 EVENTOS E PARTICIPAÇÕES - EIRELLI', nomeFantasia: 'R8 EVENTOS E PARTICIPAÇÕES', tipo: 'juridica', cpfCnpj: '29208463000125', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'A E K REPRESENTAÇOES COMERCIAIS LTDA', nomeFantasia: 'A E K REPRESENTAÇOES', tipo: 'juridica', cpfCnpj: '1578597000119', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA C 2 ,101 TAGUATINGA CENTRO', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72010020', referencia: null, email: null },
  { nome: 'CORDEIRO CABOS ELETRICOS S.A', nomeFantasia: 'CORDEIRO CABOS ELETRICOS', tipo: 'juridica', cpfCnpj: '14197209000363', inscEstadual: null, inscMunicipal: null, endereco: 'RUA ILJIMA FERRAZ DE VASCONCELOS - SÃO PAULO', complemento: null, numero: null, bairro: 'Vila Santo Antônio', cidade: 'São Paulo', uf: 'SP', cep: '08534000', referencia: null, email: null },
  { nome: 'MEGACABOS INDUSTRIA E COMERCIO DE FIOS E CABOS LTDA', nomeFantasia: 'MEGATRON FIOS E CABOS', tipo: 'juridica', cpfCnpj: '7642862000167', inscEstadual: '596.386.943/0052', inscMunicipal: null, endereco: 'RUA LUIZ GONZAGA DE REZENDE, 175- BEIRA RIO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cachoeira de Minas', uf: 'MG', cep: '37545000', referencia: null, email: null },
  { nome: 'IBRAC INDUSTRIA BRASILEIRA CONDUTORES LTDA', nomeFantasia: 'IBRAC FIOS E CABOS', tipo: 'juridica', cpfCnpj: '44463638000487', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ACESSO RODOVIARIO, TERMINAL INTERMODAL DA SERRA', complemento: null, numero: null, bairro: null, cidade: 'Serra', uf: 'ES', cep: '29161376', referencia: null, email: null },
  { nome: 'NAMBEI INDUSTRIA CONDUTORES ELETRICOS LTDA', nomeFantasia: 'NAMBEI FIOS E CABOS', tipo: 'juridica', cpfCnpj: '62985767000255', inscEstadual: '305005449113', inscMunicipal: null, endereco: 'Rua Caetano Rúbio', complemento: null, numero: null, bairro: 'Jardim Tinoco', cidade: 'Ferraz de Vasconcelos', uf: 'SP', cep: '08533060', referencia: null, email: null },
  { nome: 'ELÉTRICA DANÚBIO INDÚSTRIA E COMÉRCIO DE MATERIAIS ELÉTRICOS', nomeFantasia: 'ELÉTRICA DANÚBIO  INDÚSTRIA', tipo: 'juridica', cpfCnpj: '61310256001404', inscEstadual: '08388488-2', inscMunicipal: null, endereco: 'AVENIDA JOÃO FRANCISCO CONGALVES  100', complemento: null, numero: '15', bairro: 'Cobilândia', cidade: 'Vila Velha', uf: 'ES', cep: '29111300', referencia: null, email: null },
  { nome: 'CEMIG DISTRIBUIDORA S.A', nomeFantasia: 'CEMIG ENERGIA ELETRICA', tipo: 'juridica', cpfCnpj: '6981180000116', inscEstadual: null, inscMunicipal: null, endereco: 'AV. BARBACENA 1200', complemento: null, numero: null, bairro: 'Pousada Santo Antônio', cidade: 'Belo Horizonte', uf: 'MG', cep: '30190131', referencia: null, email: null },
  { nome: 'CREATIVE COPIAS LTDA', nomeFantasia: 'CREATIVE COPIAS', tipo: 'juridica', cpfCnpj: '3769753000154', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA DOS INGÁS MT', complemento: null, numero: null, bairro: 'Setor Comercial', cidade: 'Sinop', uf: 'MT', cep: '78552211', referencia: null, email: null },
  { nome: 'PARATEC PARA RAIOS E ACESSÓRIOS LTDA', nomeFantasia: 'PARATEC PARA RAIOS E ACESSÓRIOS LTDA', tipo: 'juridica', cpfCnpj: '2495199000100', inscEstadual: '114920561112', inscMunicipal: null, endereco: 'Rua Coaquira', complemento: null, numero: '217', bairro: 'Vila Anastácio', cidade: 'São Paulo', uf: 'SP', cep: '05092010', referencia: null, email: null },
  { nome: 'COM ART TINTAS LTDA', nomeFantasia: 'COM ART TINTAS', tipo: 'juridica', cpfCnpj: '683647000165', inscEstadual: '10.307.011-7', inscMunicipal: null, endereco: 'AV. ENG CALIL ELIAS NETO, 1075 - ST ALGOSTINHO', complemento: null, numero: null, bairro: 'Setor Central', cidade: 'Vianópolis', uf: 'GO', cep: '75265000', referencia: null, email: null },
  { nome: 'ALJA HOTELARIA & SERVIÇOS LTDA', nomeFantasia: 'CLASS HOTEL', tipo: 'juridica', cpfCnpj: '17609594000305', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA LINCON WESTIN DA SILVEIRA', complemento: null, numero: null, bairro: 'Cruz Preta', cidade: 'Alfenas', uf: 'MG', cep: '37132194', referencia: null, email: null },
  { nome: 'FRIGELAR COMÉRCIO E INDUSTRIA LTDA', nomeFantasia: 'FRIGELAR', tipo: 'juridica', cpfCnpj: '92660406003134', inscEstadual: '07.750.066/002-43', inscMunicipal: null, endereco: 'TR SIA TRECHO 1 LOTE 1290, 1300 E 1320 S/N', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200012', referencia: null, email: 'MARCELOLOPES1@FRIGELAR.COM' },
  { nome: 'RAYCON DO BRASIL IND. E COMERCIO DE FERRAGENS LTDA', nomeFantasia: 'RAYCON DO BRASIL IND. E COMERCIO DE FERRAGENS LTDA', tipo: 'juridica', cpfCnpj: '452465000183', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida Paula Ferreira', complemento: null, numero: '3350', bairro: 'Pirituba', cidade: 'São Paulo', uf: 'SP', cep: '02916000', referencia: null, email: 'miltonfabrica@raycon.com.br' },
  { nome: 'GSA DA CONSTRUÇÃO COMÉRCIO E SERVIÇO LTDA', nomeFantasia: 'GSA ESCAVAÇÃO E DEMOLIÇÃO', tipo: 'juridica', cpfCnpj: '5271446000174', inscEstadual: '08.125.341/001-76', inscMunicipal: null, endereco: 'QUADRA 01, CONJT 10, LT 15 PRÓ -DF', complemento: null, numero: null, bairro: 'Bonsucesso (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71698028', referencia: null, email: null },
  { nome: 'ACS ADMINISTRAÇÃO DE SHOPPING CENTER S.A', nomeFantasia: 'ACS ADMINISTRAÇÃO CENTER', tipo: 'juridica', cpfCnpj: '10984317000163', inscEstadual: null, inscMunicipal: null, endereco: 'AV. DAS ARAUCARIAS  AGUAS CLARAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '18352005', referencia: null, email: null },
  { nome: 'VOVÓ FORMIGA', nomeFantasia: 'VOVÓ FORMIGA', tipo: 'juridica', cpfCnpj: '42477694000100', inscEstadual: null, inscMunicipal: null, endereco: 'RUA AVENIDA DAS ARAUCÁRIAS Nº 4155', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: '3º OFÍCIO DE NOTAS DE TAGUATINGA', nomeFantasia: 'CARTÓRIO DE TAGUATINGA', tipo: 'juridica', cpfCnpj: '547851000159', inscEstadual: null, inscMunicipal: null, endereco: 'Q.S. A 24 LOTES 01 E 02', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72015240', referencia: null, email: null },
  { nome: 'CASA DO  CONSTRUTOR', nomeFantasia: 'CASA CONSTRUTOR  CRISTALINA', tipo: 'juridica', cpfCnpj: '58343360000176', inscEstadual: null, inscMunicipal: null, endereco: 'AV. KALLED COSAC', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ACDF BAR E RESTAURANTE LTDA', nomeFantasia: 'POTIGUAR', tipo: 'juridica', cpfCnpj: '51919567000105', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA DAS ARAUCÁRIAS 885 LOJAS 08 E 09', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'TELHADOS E CIA SERVIÇOS LTDA', nomeFantasia: 'TELHADOS E CIA', tipo: 'juridica', cpfCnpj: '52265266000160', inscEstadual: null, inscMunicipal: '6356672', endereco: 'AV JACINTO ALVES DE ABREU Nº 530 QD 23 LT 21 SALA 01', complemento: null, numero: null, bairro: 'Residencial Vereda dos Buritis', cidade: 'Goiânia', uf: 'GO', cep: '74370661', referencia: null, email: null },
  { nome: 'FRIOBRAS INSTALAÇÕES E MANUTENÇÃO AR-CONDICIONADO LTDA', nomeFantasia: 'FRIOBRAS INSTALAÇÕES E MANUTENÇÃO AR-CONDICIONADO', tipo: 'juridica', cpfCnpj: '33461412000188', inscEstadual: null, inscMunicipal: '791304500192', endereco: 'SIA TRECHO3 LOTE 990 SALA 108 PARTE G', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'JUSCELINO NEVES DE SOUZA', nomeFantasia: 'COMETA', tipo: 'juridica', cpfCnpj: '678737000168', inscEstadual: '10.274.567-6', inscMunicipal: null, endereco: 'RUA C-73, 107', complemento: null, numero: null, bairro: 'Setor Sudoeste', cidade: 'Goiânia', uf: 'GO', cep: '74303050', referencia: null, email: null },
  { nome: 'FERNANDES SERVIÇOS, REFORMAS E CONSTRUÇÕES LTDA', nomeFantasia: 'FERNANDES REFORMAS E CONSTRUÇÕES', tipo: 'juridica', cpfCnpj: '35385876000188', inscEstadual: null, inscMunicipal: '79475600150', endereco: 'JEQUITIBA LOTE 685, SALA 421 - EDIFÍCIO BAHAMAS CENTER', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71929540', referencia: null, email: null },
  { nome: 'DECOREVIDROS VIDRACARIA EIRELLI', nomeFantasia: 'DECOREVIDROS', tipo: 'juridica', cpfCnpj: '26457251000193', inscEstadual: '07.788.814/001-90', inscMunicipal: null, endereco: 'ADE CONJUNTO 20 LOTE 06', complemento: null, numero: null, bairro: 'Área de Desenvolvimento Econômico (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71989300', referencia: null, email: null },
  { nome: 'ANUDAL DO BRASIL IND. E COM. DE ACES. DE AL. LTDA', nomeFantasia: 'ANUDAL', tipo: 'juridica', cpfCnpj: '16829879000119', inscEstadual: '353135153110', inscMunicipal: null, endereco: 'RUA EMA GAZZI MAGNUSSON, 154', complemento: null, numero: null, bairro: 'Comercial Vitória Martini', cidade: 'Indaiatuba', uf: 'SP', cep: '13347630', referencia: null, email: null },
  { nome: 'VITÓRIA CONSTRUTORA, COMÉRCIO E SERVIÇOS LTDA', nomeFantasia: 'GESSO VITORIA', tipo: 'juridica', cpfCnpj: '11066984000200', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 4A Chacara 01A Lote, 09B', complemento: null, numero: '9', bairro: 'SETOR HABITACIONAL VICENTE PIRES', cidade: null, uf: 'DF', cep: '72006200', referencia: null, email: null },
  { nome: 'BEIJA FLOR COMÉRCIO DE TINTAS LTDA', nomeFantasia: 'BEIJA FLOR TINTAS', tipo: 'juridica', cpfCnpj: '66209362004192', inscEstadual: '702.760.553/3633', inscMunicipal: null, endereco: 'AVENIDA JOÃO BATISTA DA SILVA, Nº 145', complemento: null, numero: null, bairro: 'Juscelino Kubitschek', cidade: 'Carmo do Paranaíba', uf: 'MG', cep: '38844014', referencia: null, email: null },
  { nome: 'POSTOS ALPA LTDA', nomeFantasia: 'ALPA', tipo: 'juridica', cpfCnpj: '2234943000104', inscEstadual: '621.723.816/0048', inscMunicipal: null, endereco: 'ROD. BR 354 KM 327', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'CONSTRUCIA LTDA', nomeFantasia: 'CONSTRUÇÃO E CIA', tipo: 'juridica', cpfCnpj: '31294103000135', inscEstadual: '004.101.041/0083', inscMunicipal: null, endereco: 'AV VER. ANTONIO INÁCIO DA SILVA, 681', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'COMERCIAL MAPRO LTDA', nomeFantasia: 'MAPRO', tipo: 'juridica', cpfCnpj: '4117444000162', inscEstadual: '621.100.820/0093', inscMunicipal: null, endereco: 'AVENIDA BRASIL, 263, SANTA TEREZINHA', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'C&E SAMPAIO COMÉRCIO DE PRODUTOS NATURAIS', nomeFantasia: 'SAMS CLUB ÁGUAS CLARAS', tipo: 'juridica', cpfCnpj: '41963831000146', inscEstadual: '08.058.208/001-90', inscMunicipal: null, endereco: 'RUA COPAÍBA ÁGUAS CLARAS NORTE', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71919540', referencia: null, email: null },
  { nome: 'LOFTY STYLE COMERCIAL LTDA', nomeFantasia: 'LOFTY STYLE', tipo: 'juridica', cpfCnpj: '11516257003647', inscEstadual: '08.217.098/003-59', inscMunicipal: null, endereco: 'SMAS, TRECHO 1 LT S/N', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71219900', referencia: null, email: null },
  { nome: 'FONTANELLA TRANSPORTES RODOVIÁRIO DE CARGAS LTDA', nomeFantasia: 'FONTANELLA', tipo: 'juridica', cpfCnpj: '41104296000259', inscEstadual: '260994928', inscMunicipal: null, endereco: 'ROD LUIZ ROSSO, 8700', complemento: null, numero: null, bairro: 'Dagostin', cidade: 'Criciúma', uf: 'SC', cep: '88812001', referencia: null, email: null },
  { nome: 'SIKA S/A', nomeFantasia: 'SIKA S/A', tipo: 'juridica', cpfCnpj: '33081704002210', inscEstadual: '10.576.575-9', inscMunicipal: null, endereco: 'ANVR ANEL VIÁRIO', complemento: null, numero: 'S/N', bairro: 'SETOR PAMPULHA II', cidade: null, uf: 'GO', cep: '74985240', referencia: null, email: null },
  { nome: 'IRMÃOS PEPE LTDA', nomeFantasia: 'PEPE TINTAS', tipo: 'juridica', cpfCnpj: '37061769000634', inscEstadual: null, inscMunicipal: null, endereco: 'SIA SUL TRECHO 2, LT 445/475 GALPÃO A E B,02', complemento: null, numero: '3', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: 'CADE SOBRADINHO - MEDICINA ESPECIALIZADA LTDA', nomeFantasia: 'CADE SOBRADINHO', tipo: 'juridica', cpfCnpj: '59480650000124', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 07, COMÉRCIO LOCAL 26, LOJA 02', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73036165', referencia: null, email: null },
  { nome: 'RJ COMÉRCIO DE MATERIAIS PARA CONSTRUÇÃO E SERVIÇOS LTDA', nomeFantasia: 'GRANITINA DO BRASIL', tipo: 'juridica', cpfCnpj: '5739681000128', inscEstadual: null, inscMunicipal: null, endereco: 'QN 122, CONJ. 04 - LOTE 01', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72304104', referencia: null, email: null },
  { nome: 'JERIVA COMÉRCIO DE ALIMENTOS LTDA', nomeFantasia: 'JERIVÁ', tipo: 'juridica', cpfCnpj: '2353738000591', inscEstadual: '10.405.947-8', inscMunicipal: null, endereco: 'ZONA RURAL', complemento: null, numero: null, bairro: 'Fazenda Mariká', cidade: 'Abadiânia', uf: 'GO', cep: '72940000', referencia: null, email: null },
  { nome: 'VANESSA BESSA DE CASTRO FARIA EIRELLI', nomeFantasia: 'BRASPORTAS', tipo: 'juridica', cpfCnpj: '16938657000134', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Javaes, Quadra 59, Lote 10/12', complemento: null, numero: null, bairro: 'Jardim Eldorado', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74914380', referencia: null, email: 'comercial02@brasportas.com.br' },
  { nome: 'ZEUS DO BRASIL LTDA', nomeFantasia: 'PORTEX', tipo: 'juridica', cpfCnpj: '82699588000188', inscEstadual: '252261518', inscMunicipal: null, endereco: 'RODOVIA BR 470, KM 636', complemento: null, numero: null, bairro: 'Boa Vista', cidade: 'Blumenau', uf: 'SC', cep: '89070200', referencia: null, email: null },
  { nome: 'ESTILO TELHADOS E REPRESENTAÇÕES', nomeFantasia: 'ESTILO TELHADOS', tipo: 'juridica', cpfCnpj: '59974309000125', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 10, QD 41 E 42, Nº 23', complemento: null, numero: null, bairro: 'Parque Esplanada II', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72878081', referencia: null, email: null },
  { nome: 'ENGENHARIA DAS LAJES E PREMOLDADOS LTDA', nomeFantasia: 'ENGENHARIA DAS LAJES', tipo: 'juridica', cpfCnpj: '40407368000193', inscEstadual: null, inscMunicipal: null, endereco: 'RUA C, QD 35, LT 06', complemento: null, numero: null, bairro: 'Das Indústrias', cidade: 'Senador Canedo', uf: 'GO', cep: '75261023', referencia: null, email: null },
  { nome: 'BRASIL PROTENSÃO ENGENHARIA LTDA', nomeFantasia: 'BRASIL PROTENSÃO', tipo: 'juridica', cpfCnpj: '37502411000276', inscEstadual: null, inscMunicipal: null, endereco: 'RUA RAIMUNDO BERNARDO DOS SANTOS, S/N', complemento: null, numero: null, bairro: 'Parque Alvorada I', cidade: 'Luziânia', uf: 'GO', cep: '72836320', referencia: null, email: null },
  { nome: 'IMPÉRIO SOLAR - ME', nomeFantasia: 'DAVID PATRÍCIO DA SILVA', tipo: 'juridica', cpfCnpj: '43515893000110', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 16 (QD 16. 17. 18) S/N, QD 16, LT 05, CASA B', complemento: null, numero: null, bairro: 'Cruzeiro do Sul', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72870636', referencia: null, email: null },
  { nome: 'ECO VISÃO PARTICIPAÇÕES E COLETA DE RESÍDUOS', nomeFantasia: 'ECO VISÃO PARTICIPAÇÕES E COLETA DE RESÍDUOS', tipo: 'juridica', cpfCnpj: '32244406000106', inscEstadual: null, inscMunicipal: null, endereco: 'SAAN - QUADRA 03 LOTE 180', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '70632300', referencia: null, email: null },
  { nome: 'EDUARDO MONTEIRO DE CASTRO GOMES', nomeFantasia: null, tipo: 'fisica', cpfCnpj: null, inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 03, CONJ 11, LOTE 16', complemento: null, numero: null, bairro: 'Setor Habitacional Taquari (Lago Norte)', cidade: 'Brasília', uf: 'DF', cep: '71551348', referencia: null, email: null },
  { nome: 'FERRARI PARAFUSOS LTDA', nomeFantasia: 'FERRARI PARAFUSOS LTDA', tipo: 'juridica', cpfCnpj: '54214507000177', inscEstadual: null, inscMunicipal: null, endereco: 'Rua 28', complemento: null, numero: '1670', bairro: 'Centro', cidade: 'Barretos', uf: 'SP', cep: '14780110', referencia: null, email: null },
  { nome: 'REZENDE SOBRADINHO', nomeFantasia: 'REZENDE SOBRADINHO', tipo: 'juridica', cpfCnpj: '99283000251', inscEstadual: '07.309.382/003-36', inscMunicipal: null, endereco: 'ÁREA ESPECIAL INDUSTRIA  Nº 02 LOTES 1/2 E 3', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73045620', referencia: null, email: null },
  { nome: 'JUNIOR CASA E CONSTRUÇÃO LTDA', nomeFantasia: 'JUNIOR CASA E CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '52496871000141', inscEstadual: null, inscMunicipal: null, endereco: 'Q 07 COMERCIO LOCAL CL 22', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73036155', referencia: null, email: null },
  { nome: 'PORMADE PORTAS DE MADEIRAS DECORATIVAS LTDA', nomeFantasia: 'PORMADE PORTAS DE MADEIRAS DECORATIVAS LTDA', tipo: 'juridica', cpfCnpj: '81639023001890', inscEstadual: '903.51574-06', inscMunicipal: null, endereco: 'RUA PRUDENTE DE MORAIS, 940', complemento: null, numero: null, bairro: 'São Basilio Magno', cidade: 'União da Vitória', uf: 'PR', cep: '84600905', referencia: null, email: null },
  { nome: 'MULTIFORT RENTAL', nomeFantasia: 'MULTIFORT', tipo: 'juridica', cpfCnpj: '30993135000166', inscEstadual: null, inscMunicipal: null, endereco: 'ST SEES QUADRA 13 LOTE 01 SETOR ECONOMICO', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73020413', referencia: null, email: null },
  { nome: 'PHELIPE DIAS MEIRA', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '725855100', inscEstadual: null, inscMunicipal: null, endereco: 'AV DAS ARAUCÁRIAS QD 4530 BLOCO C APTO 1003', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936250', referencia: null, email: null },
  { nome: 'AÇO CENTER COMÉRCIO DE AÇO LTDA', nomeFantasia: 'AÇO CENTER COMÉRCIO DE AÇO LTDA', tipo: 'juridica', cpfCnpj: '26721008000130', inscEstadual: '07.792.672/001-36', inscMunicipal: null, endereco: 'QI 04, LOTES 14 E 15 - SETOR INDUSTRIAL', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135040', referencia: null, email: null },
  { nome: 'SOLIDEZ CONCRETOS LTDA', nomeFantasia: 'SOLIDEZ CONCRETOS', tipo: 'juridica', cpfCnpj: '57644761000101', inscEstadual: null, inscMunicipal: '49977', endereco: 'FAZENDA ALTO HORIZONTE - ESTRADA DAS LAJES, Nº S/N - KM 2 A ESQ 2 KM', complemento: null, numero: null, bairro: 'ZONA RURAL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'FRANCIMAR NUNES SILVA', nomeFantasia: 'FRANCIMAR NUNES SILVA', tipo: 'juridica', cpfCnpj: '22670215000152', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 131, 24', complemento: null, numero: null, bairro: 'Parque Estrela Dalva IX', cidade: 'Luziânia', uf: 'GO', cep: '72853131', referencia: null, email: null },
  { nome: 'MARLON JHONATAN RODRIGUIS FLORENCIO', nomeFantasia: 'MARLON JHONATAN', tipo: 'juridica', cpfCnpj: '49200982000154', inscEstadual: null, inscMunicipal: null, endereco: 'RUA GETÚLIO VARGAS, 789', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'RAFAEL ALVES DOS REIS', nomeFantasia: 'RAFAEL ALVES DOS REIS', tipo: 'juridica', cpfCnpj: '21358985000100', inscEstadual: null, inscMunicipal: null, endereco: 'QS 14, CONJ. 5A, S/N', complemento: null, numero: null, bairro: 'Riacho Fundo I', cidade: 'Brasília', uf: 'DF', cep: '71825405', referencia: null, email: null },
  { nome: 'CASA CONSTRUTOR', nomeFantasia: 'CASA CONSTRUTOR SOBRADINHO', tipo: 'juridica', cpfCnpj: '46848828000103', inscEstadual: null, inscMunicipal: null, endereco: 'ST SEES, QUADRA 13 - 13 SOBRADINHO', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73022041', referencia: null, email: null },
  { nome: 'MANUFATTI ELEMENTOS  CERÂMICOS', nomeFantasia: 'MANUFATTI ELEMENTOS CERÂMICOS', tipo: 'juridica', cpfCnpj: '19583419000141', inscEstadual: null, inscMunicipal: null, endereco: 'ROD. MÁRIO BATISTA MORI, SN', complemento: null, numero: null, bairro: 'Centro', cidade: 'Tatuí', uf: 'SP', cep: '18280000', referencia: null, email: null },
  { nome: 'MADEIREIRA BV LTDA', nomeFantasia: 'MADEIREIRA BV', tipo: 'juridica', cpfCnpj: '58971013000198', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR HABITACIONAL NOVA COLINA,CHACARA N°19', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73270010', referencia: null, email: null },
  { nome: 'EDILSON DOS SANTOS MENDES', nomeFantasia: 'EDILSON DOS SANTOS MENDES', tipo: 'fisica', cpfCnpj: '46240225134', inscEstadual: null, inscMunicipal: null, endereco: 'QNM 01 CONJUNTO A CASA 05', complemento: null, numero: '5', bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72215011', referencia: null, email: null },
  { nome: 'WALTER CÁSSIO DE OLIVEIRA', nomeFantasia: 'WALTER CÁSSIO DE OLIVEIRA', tipo: 'fisica', cpfCnpj: '71375317172', inscEstadual: null, inscMunicipal: null, endereco: 'QNM 24 CONJUNTO J CASA 19', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72210250', referencia: null, email: null },
  { nome: 'SERGIO FILHO PEREIRA LIMA', nomeFantasia: 'SERGIO FILHO PEREIRA LIMA', tipo: 'fisica', cpfCnpj: '7418759690', inscEstadual: null, inscMunicipal: null, endereco: 'QNO 10 ÁREA ESPECIAL R', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72255018', referencia: null, email: null },
  { nome: 'MAIS ESCORAMENTOS, FORMAS, ANDAIMES E SERVIÇOS', nomeFantasia: 'MAIS ESCORAMENTOS, FORMAS, ANDAIMES E SERVIÇOS', tipo: 'juridica', cpfCnpj: '32980071000194', inscEstadual: null, inscMunicipal: null, endereco: 'ÁREA ADE CONJUNTO 1,11 LOTES 12/13', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71985000', referencia: null, email: null },
  { nome: 'ATITUDE MIX IMPORTAÇÃO E DISTRIBUIÇÃO LTDA - ME', nomeFantasia: 'ATITUDE MIX IMPORTAÇÃO E DISTRIBUIÇÃO LTDA - ME', tipo: 'juridica', cpfCnpj: '22997526000120', inscEstadual: '286397555112', inscMunicipal: null, endereco: 'Avenida Dom Pedro I', complemento: null, numero: '19', bairro: 'Conceição', cidade: 'Diadema', uf: 'SP', cep: '09991000', referencia: null, email: 'FINANCEIRO@ATITUDEMIX.COM.BR' },
  { nome: 'SOLDAX SOLDAS LTDA', nomeFantasia: 'SOLDAX SOLDAS LTDA', tipo: 'juridica', cpfCnpj: '31981544000105', inscEstadual: '123222349110', inscMunicipal: null, endereco: 'Rua das Tulipas', complemento: null, numero: '83', bairro: 'Vila Lúcia', cidade: 'São Paulo', uf: 'SP', cep: '03144050', referencia: null, email: null },
  { nome: 'ATALAIA COM. ATACADISTA DE MATERIAIS DE CONSTRUÇÃO', nomeFantasia: 'ATALAIA ATACADISTA DA CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '8389998000170', inscEstadual: null, inscMunicipal: null, endereco: 'AREA ESPECIAL PARA INDUSTRIA DQ 02 LT 04', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73045620', referencia: null, email: null },
  { nome: 'JELSON BEDIN', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '34746080100', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 05 QUADRA 18  LOTE 08', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'BARBOSA COMÉRICO DE MATERIAIS DE CONSTRUÇÃO E PRODUTOS FLORESTAIS LTDA', nomeFantasia: 'ATACADÃO DA MADEIRA', tipo: 'juridica', cpfCnpj: '27021551000198', inscEstadual: '07.797.816/001-96', inscMunicipal: null, endereco: 'EPTG Chácara 55  -  Loja C', complemento: null, numero: '3', bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72005310', referencia: null, email: 'financeiro@atacadodamadeira.com.br' },
  { nome: 'KABUM SA', nomeFantasia: 'KABUM EXPLOSÃO DE PREÇOS BAIXOS', tipo: 'juridica', cpfCnpj: '5570714000825', inscEstadual: null, inscMunicipal: null, endereco: 'ROD.BR 262 222 ,GALPÃO ARMZ 3 4 E 5', complemento: null, numero: null, bairro: 'Vila Bethânia', cidade: 'Viana', uf: 'ES', cep: '29136010', referencia: null, email: null },
  { nome: 'GUVPLAS COMÉRCIO E RECUPERAÇÃO DE PLÁSTICOS LTDA', nomeFantasia: 'GUVPLAS COMÉRCIO E RECUPERAÇÃO DE PLÁSTICOS LTDA', tipo: 'juridica', cpfCnpj: '38136611000134', inscEstadual: '63753135211', inscMunicipal: null, endereco: 'Avenida Morumbi,', complemento: null, numero: '730', bairro: 'Vila Morumbi', cidade: 'São Carlos', uf: 'SP', cep: '13572000', referencia: null, email: null },
  { nome: 'SOL IRRIGAÇÃO SERVIÇOS LTDA', nomeFantasia: 'SOL IRRIGAÇÃO SERVIÇOS LTDA', tipo: 'juridica', cpfCnpj: '38159176000163', inscEstadual: '08368165-5', inscMunicipal: null, endereco: 'AV. PREFEITO SAMUEL BATISTA CRUZ, 2376', complemento: null, numero: null, bairro: 'Shell', cidade: 'Linhares', uf: 'ES', cep: '29901552', referencia: null, email: null },
  { nome: 'GESSO INTEGRAL COMÉRCIO DE GESSO E PREMOLDADOS LTDA - ME', nomeFantasia: 'GESSO INTEGRAL', tipo: 'juridica', cpfCnpj: '9292346000185', inscEstadual: '07.497.573/001-43', inscMunicipal: null, endereco: 'QUADRA 03 LOTE 09 SETOR DE EXPANSÃO ECONÔMICA', complemento: null, numero: null, bairro: 'Setor Econômico de Sobradinho (Sobradinho)', cidade: 'Brasília', uf: 'DF', cep: '73020403', referencia: null, email: null },
  { nome: 'NOVA CASA DISTRIBUIDORA DE  MATERIAIS DE  CONSTRUÇÃO S/A', nomeFantasia: 'NOVA CASA DIST MAT CONST S/A', tipo: 'juridica', cpfCnpj: '74200403000200', inscEstadual: null, inscMunicipal: null, endereco: 'TRECHO  05 -  CJ 03  - LTS 01 A 06, 15 E 16  - POLO JK', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72549720', referencia: null, email: 'watilla.santos@novacasadistribuidora.com.br' },
  { nome: 'MATERIAIS DE CONSTRUÇÃO CONSTRULAR LTDA', nomeFantasia: 'CONSTRULAR', tipo: 'juridica', cpfCnpj: '25077371000100', inscEstadual: '10.190.081-3', inscMunicipal: null, endereco: 'AVENIDA TANCREDO NEVES, Nº 0', complemento: null, numero: null, bairro: 'Setor Bosque', cidade: 'Formosa', uf: 'GO', cep: '73802005', referencia: null, email: null },
  { nome: 'UNIVERSO ATACADISTA MATERIAIS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'UNIVERSO ATACADISTA MATERIAIS PARA CONSTRUÇÃO LTDA', tipo: 'juridica', cpfCnpj: '43881723000150', inscEstadual: '08.090.278/001-69', inscMunicipal: null, endereco: 'SES Q.05,   LOTE  17', complemento: null, numero: null, bairro: 'Setor Econômico de Sobradinho (Sobradinho)', cidade: 'Brasília', uf: 'DF', cep: '73020405', referencia: null, email: 'CONTATO@UNIVERSOATACADISTA.COM.BR' },
  { nome: 'BEM ESTAR BRASILIA', nomeFantasia: 'BEM ESTAR LIFE', tipo: 'juridica', cpfCnpj: '26417283000670', inscEstadual: null, inscMunicipal: null, endereco: 'CND 06 LOTE 6 TAG. NORTE', complemento: null, numero: null, bairro: 'Setor de Desenvolvimento Econômico (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72120065', referencia: null, email: null },
  { nome: 'NOVA ELÉTRICA UNIPESSOAL LTDA', nomeFantasia: 'NOVA ELÉTRICA', tipo: 'juridica', cpfCnpj: '44864937000180', inscEstadual: '10.884.203-7', inscMunicipal: null, endereco: 'RUA 3, S/N, LOTE 05 QUADRA E', complemento: null, numero: null, bairro: 'Jardim Califórnia', cidade: 'Formosa', uf: 'GO', cep: '73807774', referencia: null, email: null },
  { nome: 'BRASTINTAS', nomeFantasia: 'BRASTINTAS', tipo: 'juridica', cpfCnpj: '21573172000124', inscEstadual: null, inscMunicipal: null, endereco: 'QNE 35  LOTE 23  SOBRELOJA', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72125350', referencia: null, email: null },
  { nome: 'CASA OLIVEIRA DE ARTIGOS DO LAR LTDA ME', nomeFantasia: 'CASA OLIVEIRA', tipo: 'juridica', cpfCnpj: '3933182000141', inscEstadual: '07.412.352/001-41', inscMunicipal: null, endereco: 'QUADRA 13, COMÉRCIO LOCAL 06. LOJAS 3/6', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73041615', referencia: null, email: null },
  { nome: 'CONSTRUJUNIOR COMÉRCIO DE MATERIAIS PARA CONSTRUÇÃO EIRELI', nomeFantasia: 'CONSTRUJUNIOR', tipo: 'juridica', cpfCnpj: '37986495000180', inscEstadual: '07.995.064/001-27', inscMunicipal: null, endereco: 'QUADRA 07 CL 22, LOJA 08', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73036155', referencia: null, email: null },
  { nome: 'DNP CHURRASQUEIRA LTDA', nomeFantasia: 'FOGO ARTE CHURRASQUEIRAS', tipo: 'juridica', cpfCnpj: '50705619000170', inscEstadual: '08.219.689/001-71', inscMunicipal: null, endereco: 'QSE 4, LOTE 02, LOJA 05', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72025040', referencia: null, email: null },
  { nome: 'CASA DO MARCENEIRO SIA MATERIAIS PARA CONSTRUÇÃO EIRELI', nomeFantasia: 'CASA DO MARCENEIRO', tipo: 'juridica', cpfCnpj: '1618214000199', inscEstadual: null, inscMunicipal: null, endereco: 'TR SIA TRECHO 03', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'GENIVAL XAVIER DE ANDRADE', nomeFantasia: 'GENIVAL XAVIER DE ANDRADE', tipo: 'fisica', cpfCnpj: '65879059115', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 14 VILAGE, QUADRA 13 LOTE 05', complemento: null, numero: '5', bairro: 'VILAGE', cidade: null, uf: 'GO', cep: '72910000', referencia: null, email: null },
  { nome: 'JAILSON FELIZ DO NASCIMENTO', nomeFantasia: 'JAILSON FELIZ DO NASCIMENTO', tipo: 'fisica', cpfCnpj: '3887687469', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PETUNIA, 5044', complemento: null, numero: '5044', bairro: 'BELVEDERE', cidade: null, uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MAYARA RIBEIRO CAMPOS', nomeFantasia: 'MAYARA RIBEIRO CAMPOS', tipo: 'fisica', cpfCnpj: '8934367636', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 95, QUADRA 94 LOTE 25', complemento: null, numero: '25', bairro: 'VILA SÃO JOÃO', cidade: null, uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'VISAEL TEIXEIRA DE AZEVEDO', nomeFantasia: 'VISAEL TEIXEIRA DE AZEVEDO', tipo: 'fisica', cpfCnpj: '2827706318', inscEstadual: null, inscMunicipal: null, endereco: 'RUA H, QUADRA 36 LOTE 14', complemento: null, numero: '14', bairro: 'ZONA SUL NOVA', cidade: null, uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CONTROLID INDUSTRIA E COMERCIO DE HARDWARE E SERVIÇOS DE TECNOLOGIA LTDA', nomeFantasia: 'FECHADURAS YALE', tipo: 'juridica', cpfCnpj: '8238299000390', inscEstadual: '25313720090', inscMunicipal: null, endereco: 'Rua Hungria,  Conj. 81,82 e 91,92', complemento: null, numero: '888', bairro: 'Jardim Europa', cidade: 'São Paulo', uf: 'SP', cep: '01455000', referencia: null, email: 'silvia.graciano@controlid.com.br' },
  { nome: 'SOVAR E ASSAR CAFETERIA', nomeFantasia: 'SOVAR & ASSAR CAFETERIA', tipo: 'juridica', cpfCnpj: '51685779000167', inscEstadual: null, inscMunicipal: null, endereco: 'RUA MANACÁ NORTE', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71936500', referencia: null, email: null },
  { nome: 'SIC COMERCIAL DE ALIMENTOS EIRELI', nomeFantasia: 'BELLAVIA', tipo: 'juridica', cpfCnpj: '21333974000400', inscEstadual: null, inscMunicipal: null, endereco: 'RUA, 14  SUL,AGUAS CLARAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939720', referencia: null, email: null },
  { nome: 'MERCADO PAGO.COM REPRESENTAÇOES', nomeFantasia: 'MERCADO PAGO', tipo: 'juridica', cpfCnpj: '10573521000191', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'DVG INDUSTRIAL S/A', nomeFantasia: 'DVG INDUSTRIAL S/A (PRECON)', tipo: 'juridica', cpfCnpj: '23452238000153', inscEstadual: null, inscMunicipal: null, endereco: 'AV. LINCOLN DIOGO VIANA,  351  -  DOUTOR LUND', complemento: null, numero: null, bairro: 'Centro', cidade: 'Pedro Leopoldo', uf: 'MG', cep: '33250490', referencia: null, email: 'ECAC@DVG.COM.BR' },
  { nome: 'SIMONE MIOTTI GUIMARAES', nomeFantasia: 'FAZENDA GAMELA', tipo: 'fisica', cpfCnpj: '11290001170', inscEstadual: '11.567.715-1', inscMunicipal: null, endereco: 'EST SURUCUCU, S/N - FAZENDA GAMELA', complemento: null, numero: null, bairro: 'Zona Rural', cidade: 'Luziânia', uf: 'GO', cep: '72800000', referencia: null, email: null },
  { nome: 'KALLANGO TEC SOLUÇÕES COM.E SERVIÇOS', nomeFantasia: 'KALLANGO TEC', tipo: 'juridica', cpfCnpj: '54594853000128', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'DUPLOR COMÉRCIO DE FERRAMENTAS LTDA', nomeFantasia: 'DUPLOR COMÉRCIO DE FERRAMENTAS LTDA', tipo: 'juridica', cpfCnpj: '10622178000128', inscEstadual: '669630106112', inscMunicipal: null, endereco: 'Avenida Victor Andrew', complemento: 'Próximo ao Posto Vic', numero: '3210', bairro: 'Zona Industrial', cidade: 'Sorocaba', uf: 'SP', cep: '18086390', referencia: null, email: null },
  { nome: 'PEDRO COZAC DE OLIVEIRA', nomeFantasia: 'PEDRO COZAC DE OLIVEIRA', tipo: 'fisica', cpfCnpj: '3587903107', inscEstadual: null, inscMunicipal: null, endereco: 'RUA GETÚLIO VARGAS, Nº 52,', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'B2K SELANTES E FIXADORES INDUSTRIA E COMÉRCIO', nomeFantasia: 'B2K SELANTES', tipo: 'juridica', cpfCnpj: '20330308000102', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PROFESSORA AURORA JEREZ RIOS 560', complemento: null, numero: null, bairro: 'Vila Santa Josefa', cidade: 'Limeira', uf: 'SP', cep: '13482255', referencia: null, email: null },
  { nome: 'SUPERIS DISTRIBUIDORA LTDA (DF)', nomeFantasia: 'SUPERIS DISTRIBUIDORA LTDA (DF)', tipo: 'juridica', cpfCnpj: '3875307000124', inscEstadual: '07.411.262/001-24', inscMunicipal: null, endereco: 'SHC/SCR QD 511 BL A LOJA 79 BRASILIA', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70361510', referencia: null, email: 'rafael@krista.com.br' },
  { nome: 'R&M SERVIÇOS E ALUGUEIS', nomeFantasia: 'R&M SERVIÇOS E ALUGUEIS', tipo: 'juridica', cpfCnpj: '24832119000199', inscEstadual: null, inscMunicipal: null, endereco: 'QN 514 CONJUNTO 5, S/N LOTE 03, LOJA 01', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72314005', referencia: null, email: null },
  { nome: 'CAPITAL COMÉRCIO DE MADEIRAS E MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'CAPITAL COMÉRCIO DE MADEIRAS E MATERIAIS DE CONSTRUÇÃO LTDA', tipo: 'juridica', cpfCnpj: '51119924000142', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 12, CHÁCARA 146/1 -  LOTE 05', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '72007625', referencia: null, email: 'CAPITALMADEIRASDF@HOTMAIL.COM' },
  { nome: 'TIAGO CONTE', nomeFantasia: 'CONSTRUWEST', tipo: 'juridica', cpfCnpj: '42134602000181', inscEstadual: '131285898112', inscMunicipal: null, endereco: 'Rua Antônio Freire de Menezes', complemento: null, numero: '168', bairro: 'Vila Perus', cidade: 'São Paulo', uf: 'SP', cep: '05208090', referencia: null, email: null },
  { nome: 'EPM COMÉRCIO DE ACESSÓRIOS LTDA', nomeFantasia: 'EPM COMÉRCIO DE ACESSÓRIOS LTDA', tipo: 'juridica', cpfCnpj: '26531497000168', inscEstadual: '141639674111', inscMunicipal: null, endereco: 'Rua Filon', complemento: null, numero: '123', bairro: 'Vila Cleonice', cidade: 'São Paulo', uf: 'SP', cep: '03286030', referencia: null, email: null },
  { nome: 'HUGO MARCELO ALVES CASTILHO', nomeFantasia: 'DISTRIBUIDORA DE PRODUTOS QUÍMICOS', tipo: 'juridica', cpfCnpj: '23750981000190', inscEstadual: '214206735113', inscMunicipal: null, endereco: 'Rua Primo Padovese', complemento: null, numero: '75', bairro: 'Residencial Atenas', cidade: 'Birigüi', uf: 'SP', cep: '16201367', referencia: null, email: null },
  { nome: 'LUIZ CARLOS DA SILVA PEREIRA', nomeFantasia: 'LUIZ CARLOS DA SILVA PEREIRA', tipo: 'juridica', cpfCnpj: '52778480000110', inscEstadual: '263715892', inscMunicipal: null, endereco: 'RUA FREI ESTANISLAU SCHAETTE', complemento: null, numero: '750', bairro: 'AGUA VERDE', cidade: null, uf: 'SC', cep: '89037000', referencia: null, email: null },
  { nome: 'IBDOR INSTITUTO BRASILEIRO DE DOR - CLÍNICA ANIMA VITA LTDA', nomeFantasia: 'CLÍNICA IBDOR', tipo: 'juridica', cpfCnpj: '7717156000137', inscEstadual: null, inscMunicipal: null, endereco: 'SEPSUL 709/909, BLOCO `A`, CONJ.`B`, 1º SUBSOLO, SALA 21, EDIFÍCIO JÚLIO ADNET', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70390095', referencia: null, email: null },
  { nome: 'CAJU HOME CENTER', nomeFantasia: 'CAJU HOME CENTER', tipo: 'juridica', cpfCnpj: '38231309000165', inscEstadual: null, inscMunicipal: null, endereco: 'RUA  OLIMPO FERREIRA', complemento: null, numero: null, bairro: 'Setor Leste', cidade: 'Luziânia', uf: 'GO', cep: '72803440', referencia: null, email: null },
  { nome: 'MM HOME CENTER LTDA', nomeFantasia: 'MM HOME CENTER', tipo: 'juridica', cpfCnpj: '44581118000126', inscEstadual: null, inscMunicipal: null, endereco: 'AV. ALFREDO NASSER QUADRA 80 LOTE 14 S/N', complemento: null, numero: null, bairro: 'Parque Estrela Dalva I', cidade: 'Luziânia', uf: 'GO', cep: '72871306', referencia: null, email: null },
  { nome: 'CENTROESTE ESQUADRIAS DE ALUMINIO LTDA', nomeFantasia: 'CRJ ESQUADRIAS EM ALUMÍNIO', tipo: 'juridica', cpfCnpj: '37462137000178', inscEstadual: null, inscMunicipal: null, endereco: 'ALAMEDA A, 178', complemento: null, numero: null, bairro: 'Chácaras São Pedro', cidade: 'Aparecida de Goiânia', uf: 'GO', cep: '74923090', referencia: null, email: null },
  { nome: 'JH STORE COMÉRCIO DE CELULARES, EQUIPAMENTOS E ACESSÓRIOS LTDA ME', nomeFantasia: 'JH STORE', tipo: 'juridica', cpfCnpj: '21563567000146', inscEstadual: '07.704.913/001-10', inscMunicipal: null, endereco: 'QE 23, ÁREA ESPECIAL S/N FEIRA DO GUARÁ, 351', complemento: null, numero: null, bairro: 'Guará II', cidade: 'Brasília', uf: 'DF', cep: '71025100', referencia: null, email: null },
  { nome: 'DALUZ INDUSTRIA E COMERCIO DE LUMINÁRIAS EIRELI', nomeFantasia: 'DALUZ INDUSTRIA E COMERCIO DE LUMINÁRIAS EIRELI', tipo: 'juridica', cpfCnpj: '19227142000114', inscEstadual: '002.259.213/0055', inscMunicipal: null, endereco: 'RUA ROLDÃO MIRANDA,  472 B', complemento: null, numero: null, bairro: 'Funcionários', cidade: 'Belo Horizonte', uf: 'MG', cep: '32040335', referencia: null, email: 'daluzindustria@gmail.com' },
  { nome: 'SOLUZ COMERCIO VAREJISTA DE MATERIAIS ELETRICOS', nomeFantasia: 'SOLUZ ILUMINAÇÃO', tipo: 'juridica', cpfCnpj: '26263722000122', inscEstadual: '07.784.793/001-52', inscMunicipal: null, endereco: 'SHC SUL QUADRA 110, BLOCO B LOJA 05', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70373520', referencia: null, email: null },
  { nome: 'LUIZ CAMARA DO NASCIMENTO', nomeFantasia: 'LUIZ CAMARA DO NASCIMENTO', tipo: 'fisica', cpfCnpj: '48830917168', inscEstadual: null, inscMunicipal: null, endereco: 'QD 64 LOTE 07 TERCEIRA ETAPA CEU AZUL', complemento: null, numero: null, bairro: 'Jardim Céu Azul', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72871064', referencia: null, email: null },
  { nome: 'FN ENGENHARIA LTDA', nomeFantasia: 'FN ENGENHARIA', tipo: 'juridica', cpfCnpj: '54396417000144', inscEstadual: null, inscMunicipal: '828739200101', endereco: 'SAAN QUADRA 1 LOTE 680 LJ 40 TERREO PARTE A', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '70632100', referencia: null, email: null },
  { nome: 'JOSÉ RIBAMAR DE SOUSA', nomeFantasia: 'JOSÉ RIBAMAR DE SOUSA', tipo: 'juridica', cpfCnpj: '26724820000110', inscEstadual: null, inscMunicipal: null, endereco: 'DF 425 KM 4,5, 05, SETOR HABITACIONAL CONTAGEM', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73092908', referencia: null, email: null },
  { nome: 'PORTAS DE AÇO TROPICAL LTDA', nomeFantasia: 'PORTA DE AÇO TROPICAL LTDA', tipo: 'juridica', cpfCnpj: '27158387000165', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 6 CHÁCARA 96', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72006010', referencia: null, email: null },
  { nome: 'TI & M VGA TECNOLOGIA DA INFORMAÇÃO LTDA', nomeFantasia: 'TI & M VGA TECNOLOGIA DA INFORMAÇÃO', tipo: 'juridica', cpfCnpj: '60407417000103', inscEstadual: null, inscMunicipal: '45522', endereco: 'RUA IRMA MARIANA GUTIERREZ, 17', complemento: null, numero: null, bairro: 'Vila Morais', cidade: 'Varginha', uf: 'MG', cep: '37004680', referencia: null, email: null },
  { nome: 'ANTÔNIO CLEYTON CORREA OLIVEIRA', nomeFantasia: 'ANTÔNIO CLEYTON CORREA OLIVEIRA', tipo: 'fisica', cpfCnpj: '98372530106', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 18, CASA 18', complemento: null, numero: null, bairro: 'Cidade do Entorno', cidade: 'Águas Lindas de Goiás', uf: 'GO', cep: '72917591', referencia: null, email: null },
  { nome: 'PORTAZ S/A', nomeFantasia: 'PORTAZ', tipo: 'juridica', cpfCnpj: '11023269000100', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 07 QD 04 MD. 25/26 BOX 01 DISTRITO AGRO', complemento: null, numero: null, bairro: 'Distrito Vila Rica', cidade: 'Goiânia', uf: 'GO', cep: '75252310', referencia: null, email: null },
  { nome: 'ILMA FERRAGENS CRISTALINA LTDA', nomeFantasia: 'ILMA FERRAGENS CRISTALINA LTDA', tipo: 'juridica', cpfCnpj: '61830198000125', inscEstadual: '20.297.246-1', inscMunicipal: null, endereco: 'AVENIDA FLAMENGO Nº 07 QD 35  LOTE 07', complemento: null, numero: 'SN', bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'BERLINERLUFT DO BRASIL INDÚSTRIA E COMÉRCIO LTDA', nomeFantasia: 'BERLINERLUFT DO BRASIL INDÚSTRIA E COMÉRCIO', tipo: 'juridica', cpfCnpj: '3593705000158', inscEstadual: '165/0174648', inscMunicipal: '35365', endereco: 'Avenida Presidente Getúlio Vargas', complemento: null, numero: '9720', bairro: 'Maria Regina', cidade: 'Alvorada', uf: 'RS', cep: '94836000', referencia: null, email: null },
  { nome: 'HAMILTON  BORGES ALVES', nomeFantasia: 'HAMILTON  BORGES ALVES', tipo: 'fisica', cpfCnpj: '27865762100', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'JOSÉ FERREIRA DA COSTA', nomeFantasia: 'JOSÉ FERREIRA DA COSTA', tipo: 'fisica', cpfCnpj: '83991026104', inscEstadual: null, inscMunicipal: null, endereco: 'QNM 24 - CONJ. J - CASA 09', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72210241', referencia: null, email: null },
  { nome: 'FELIPE SAKAMOTO PAZ', nomeFantasia: 'FELIPE SAKAMOTO PAZ', tipo: 'fisica', cpfCnpj: '4155842130', inscEstadual: null, inscMunicipal: null, endereco: 'QNM 36 - G2 - CASA 30', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72145000', referencia: null, email: null },
  { nome: 'LUIZ PEREIRA RODRIGUES JUNIOR', nomeFantasia: 'LUIZ PEREIRA RODRIGUES JUNIOR', tipo: 'fisica', cpfCnpj: '80195482115', inscEstadual: null, inscMunicipal: null, endereco: 'SHA - CONJ. 04 - CHÁCARA 10 - CASA 15', complemento: null, numero: null, bairro: 'Lago Sul', cidade: 'Brasília', uf: 'DF', cep: '71625600', referencia: null, email: null },
  { nome: 'HILBERTO SANTANA', nomeFantasia: 'HILBERTO SANTANA', tipo: 'fisica', cpfCnpj: '48689700625', inscEstadual: null, inscMunicipal: null, endereco: 'RUA DA ESPONJA', complemento: null, numero: null, bairro: 'Jardim Marques de Abreu', cidade: 'Goiânia', uf: 'GO', cep: '74343490', referencia: null, email: null },
  { nome: 'TAYRIK SANTOS DA SILVA', nomeFantasia: 'TAYRIK SANTOS DA SILVA', tipo: 'juridica', cpfCnpj: '63399122000112', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 16, LOTE 16, S/N', complemento: null, numero: null, bairro: 'SANTA CLARA', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'tayriksantos3@gmail.com' },
  { nome: 'FLÁVIO DIVINO DOS SANTOS', nomeFantasia: 'FLÁVIO DIVINO DOS SANTOS', tipo: 'juridica', cpfCnpj: '59157713000106', inscEstadual: null, inscMunicipal: null, endereco: 'FLUORINA C/ TUIUTI, QUADRA 23, LOTE 9, 00 SUL 2', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'divinoflavio675@gmail.com' },
  { nome: 'DANIEL DIAS LIMA BARRETO', nomeFantasia: 'DANIEL DIAS LIMA BARRETO', tipo: 'juridica', cpfCnpj: '63382833000184', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 57, LOTE 6, S/N ZONA SUL NOVA', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'danieldiaslimabarreto@gmail.com' },
  { nome: 'ESTIBENS RAFAEL HURTADO', nomeFantasia: 'ESTIBENS RAFAEL HURTADO', tipo: 'juridica', cpfCnpj: '63402797000173', inscEstadual: null, inscMunicipal: null, endereco: 'ADÃO DA SILVA QD 07 LOTE 13B, S/N, HENRIQUE CORTES', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'estibenshurtado97@gmail.com' },
  { nome: 'JOSÉ WILSON DE OLIVEIRA LOPO', nomeFantasia: 'JOSÉ WILSON DE OLIVEIRA LOPO', tipo: 'juridica', cpfCnpj: '63378769000168', inscEstadual: null, inscMunicipal: null, endereco: 'KALED COZAC, 43', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'josewilson11121978@gmail.com' },
  { nome: 'SEBASTIÃO SANTOS TEIXEIRA', nomeFantasia: 'SEBASTIÃO SANTOS TEIXEIRA', tipo: 'juridica', cpfCnpj: '63436171000188', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 2, CASA 9, S/N, CRISTALINA VELHA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'edilinesantos0371@gmail.com' },
  { nome: 'JEREMIAS ROCHA DE OLIVEIRA', nomeFantasia: 'JEREMIAS ROCHA DE OLIVEIRA', tipo: 'juridica', cpfCnpj: '63422144000156', inscEstadual: null, inscMunicipal: null, endereco: '7 DE SETEMBRO, 255', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'm_santana2007@htmail.com' },
  { nome: 'MAGNUM KLEBER TINER - EIRELI', nomeFantasia: 'TRANSPLANTAS', tipo: 'juridica', cpfCnpj: '16560338000138', inscEstadual: '0.761.621/001-05', inscMunicipal: null, endereco: 'EPTG CHÁCARA 54 N 54', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72110800', referencia: null, email: null },
  { nome: 'DECORE INTERIORES', nomeFantasia: 'DECORE INTERIORES', tipo: 'juridica', cpfCnpj: '40235463000157', inscEstadual: null, inscMunicipal: null, endereco: 'AV. SAO FRANCISCO DE ASSIS - SOL NASCENTE', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72215400', referencia: null, email: null },
  { nome: 'DUARTE CORTINARE', nomeFantasia: 'DUARTE CORTINARE', tipo: 'juridica', cpfCnpj: '57644180000161', inscEstadual: null, inscMunicipal: null, endereco: 'QD EQS 414/415 ASA SUL', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70297400', referencia: null, email: null },
  { nome: 'HALL DECOR', nomeFantasia: 'HALL DECOR', tipo: 'juridica', cpfCnpj: '9395306000169', inscEstadual: null, inscMunicipal: null, endereco: 'CLNW 10/11 LOTE E,3 SETOR NOROESTE', complemento: null, numero: null, bairro: 'Setor Noroeste', cidade: 'Brasília', uf: 'DF', cep: '70686625', referencia: null, email: null },
  { nome: 'ADRIANO GONÇALVES LIBORIO', nomeFantasia: 'ADRIANO GONÇALVES LIBORIO', tipo: 'juridica', cpfCnpj: '49631399000106', inscEstadual: null, inscMunicipal: null, endereco: '97, S/N, ZONA SUL NOVA', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'PERSONALISSIMA SERVICOS DE PINTURA E CONSTRUCAO LTDA', nomeFantasia: 'PERSONALISSIMA PINTURA', tipo: 'juridica', cpfCnpj: '61027013000149', inscEstadual: null, inscMunicipal: '839824600181', endereco: 'QR 118 CONJUNTO 4 LOTE 10 LOJA 102', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72302805', referencia: null, email: 'personalissimapintura@hotmail.com' },
  { nome: 'CECIN SARKIS SIA', nomeFantasia: 'CECIN SARKIS SIA', tipo: 'juridica', cpfCnpj: '533018000159', inscEstadual: '07.323.983/001-11', inscMunicipal: null, endereco: 'SIA Quadra 5-C - AE 21', complemento: null, numero: '225', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200055', referencia: null, email: null },
  { nome: 'FRANCISCO ARAUJO AMORIM', nomeFantasia: 'FRANCISCO AMORIM', tipo: 'fisica', cpfCnpj: '86741098372', inscEstadual: null, inscMunicipal: null, endereco: 'QD 327  CS 57 DEL LAGO ITAPOÃ', complemento: null, numero: null, bairro: 'Itapoã I', cidade: 'Brasília', uf: 'DF', cep: '71580941', referencia: null, email: null },
  { nome: 'JURANDI FERNANDES DA SILVA', nomeFantasia: 'JURANDI FERNANDES DA SILVA', tipo: 'juridica', cpfCnpj: '63395283000138', inscEstadual: null, inscMunicipal: null, endereco: 'ZIRCÃO QUADRA 58, LOTE 15, S/N', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'TECNODIGITAL COMUNICAÇÃO VISUAL LTDA', nomeFantasia: 'TECNODIGITAL COMUNICAÇÃO VISUAL LTDA', tipo: 'juridica', cpfCnpj: '1815580000138', inscEstadual: null, inscMunicipal: null, endereco: 'Área Especial SIA QD 4C Quiosque Pincel Placas', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200045', referencia: null, email: null },
  { nome: 'EDICLEITON DA COSTA CHAGAS', nomeFantasia: 'MASTER ELEVADORES (ZEROUM ELEVADORES)', tipo: 'juridica', cpfCnpj: '50437521000189', inscEstadual: null, inscMunicipal: null, endereco: 'Estrada Parque das Cascatas', complemento: null, numero: '135', bairro: 'Portão', cidade: 'Atibaia', uf: 'SP', cep: '12948123', referencia: null, email: null },
  { nome: 'GP COMÉRCIO DE ARTIGOS ELETRONICOS E ACESSÓRIOS LTDA', nomeFantasia: 'GP COMÉRCIO DE ARTIGOS ELETRONICOS E ACESSÓRIOS', tipo: 'juridica', cpfCnpj: '46743270000355', inscEstadual: '08.150.539/003-15', inscMunicipal: null, endereco: 'SMAS TRECHO 1 LT A, S/N', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71218900', referencia: null, email: null },
  { nome: 'DINÂMICA MOTORES ELÉTRICOS LTDA', nomeFantasia: 'COLOMBO MOTORES', tipo: 'juridica', cpfCnpj: '5921425000157', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: '72130535', referencia: null, email: null },
  { nome: 'BOTICÁRIO PRODUTOS DE BELEZA LTDA', nomeFantasia: 'O BOTICÁRIO', tipo: 'juridica', cpfCnpj: '6308851000182', inscEstadual: null, inscMunicipal: null, endereco: 'QS 1 R 210 LT 40 S/N', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71950770', referencia: null, email: null },
  { nome: 'OLIVEIRO DE LIMA MONTEIRO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '21433755149', inscEstadual: null, inscMunicipal: null, endereco: 'SPLM CONJUNTO 03 LOTE 02 - SETOR PLACA DAS MERCEDES', complemento: null, numero: null, bairro: 'Núcleo Bandeirante', cidade: 'Brasília', uf: 'DF', cep: '71732030', referencia: null, email: null },
  { nome: 'AJEL MATERIAIS ELETRICOS LTDA', nomeFantasia: 'AJEL MATERIAIS ELETRICOS LTDA', tipo: 'juridica', cpfCnpj: '1816875000129', inscEstadual: '10.151.219-8', inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: 'GO', cep: '74433020', referencia: null, email: null },
  { nome: 'NOVA SERVIÇOS DE MONTAGEM E MANUTENÇÃO', nomeFantasia: 'NOVA SERVIÇOS DE MONTAGEM E MANUTENÇÃO', tipo: 'juridica', cpfCnpj: '39885867000107', inscEstadual: '08.018.079/001-16', inscMunicipal: null, endereco: 'QI 12 Lote 26/31 - Loja 28 - Setor Industrial (Taguatinga)', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135120', referencia: null, email: 'engenharia@gruponova.com.br' },
  { nome: 'DISTRIBUIDORA TARSO COM. IMPOR. E EXPORTAÇÃO DE MAT. ELETRICOS', nomeFantasia: 'DISTRIBUIDORA TARSO- ECLAT', tipo: 'juridica', cpfCnpj: '4609950000179', inscEstadual: null, inscMunicipal: null, endereco: 'ADE CONJ.14 LOTE 15', complemento: null, numero: null, bairro: 'Setor de Desenvolvimento Econômico (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71988000', referencia: null, email: null },
  { nome: 'RG OSASCO TRANSPORTES RODOVIÁRIOS LTDA', nomeFantasia: 'GRUPO RG TRANSPORTES RODOVIÁRIO', tipo: 'juridica', cpfCnpj: '2592421000184', inscEstadual: '492350967113', inscMunicipal: null, endereco: 'AVENIDA LEONIL CRE BORTOLOSSO', complemento: null, numero: null, bairro: 'Quitaúna', cidade: 'Osasco', uf: 'SP', cep: '06186260', referencia: null, email: null },
  { nome: 'CENTRO DE TRADIÇÕES GAÚCHAS NOVA QUERÊNCIA', nomeFantasia: 'CTG CRISTALINA', tipo: 'juridica', cpfCnpj: '1491653000183', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ANHANGUERA, S/N, QUADRA 46, LOTE 01 A 10', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'YAPAY PAGAMENTOS ONLINE LTDA', nomeFantasia: 'VINDI PAGAMENTOS ONLINE', tipo: 'juridica', cpfCnpj: '14338304000178', inscEstadual: null, inscMunicipal: null, endereco: 'AV ALCIDES LAJES MAGALHAES 54 SALA 48 E 54', complemento: null, numero: null, bairro: 'Jardim Acapulco', cidade: 'Marília', uf: 'SP', cep: '17525181', referencia: null, email: null },
  { nome: 'ESTILO LIVRARIA E PAPELARIA LTDA', nomeFantasia: 'ESTILO LIVRARIA E PAPELARIA LTDA', tipo: 'juridica', cpfCnpj: '17292060000128', inscEstadual: '07.629.627/001-63', inscMunicipal: null, endereco: 'SETOR HABITACIONAL VICENTE PIRES - TRECHO 3 Nº:01', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '72330000', referencia: null, email: null },
  { nome: 'OCEANO FILTROS E CLIMATIZADORES LTDA', nomeFantasia: 'OCEANO FILTROS', tipo: 'juridica', cpfCnpj: '51812433000182', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR DE EXPANSÃO ECONÔMICA Q 2 LT 5', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73020402', referencia: null, email: null },
  { nome: 'EBANX LTDA', nomeFantasia: 'EBANX', tipo: 'juridica', cpfCnpj: '13236697000146', inscEstadual: null, inscMunicipal: null, endereco: 'RUA MARECHAL DEODORO, 630', complemento: null, numero: null, bairro: 'Centro', cidade: 'Curitiba', uf: 'PR', cep: '80010010', referencia: null, email: null },
  { nome: 'S.T.R TRANSPORTES RODOVIÁRIO LTDA', nomeFantasia: 'STR TRANSPORTES RODOVIÁRIO', tipo: 'juridica', cpfCnpj: '586411000100', inscEstadual: '253066360', inscMunicipal: null, endereco: 'RUA DEMOSTHENES FEMINELLA', complemento: null, numero: null, bairro: 'Centro', cidade: 'Tijucas', uf: 'SC', cep: '88200120', referencia: null, email: null },
  { nome: 'LINDT & SPRUNGLI BRAZIL COMPERCIO DE ALIMENTOS', nomeFantasia: 'LINDT', tipo: 'juridica', cpfCnpj: '20702154008206', inscEstadual: '07.956.683/002-14', inscMunicipal: null, endereco: 'Q QS 01 RUA 210 S/N', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '72036004', referencia: null, email: null },
  { nome: 'GILSON DE OLIVEIRA BORGES', nomeFantasia: 'GILSON DE OLIVEIRA BORGES', tipo: 'fisica', cpfCnpj: '1568750129', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA 02, QUADRA 02, LOTE 16', complemento: null, numero: null, bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'LUCIANA BOMBAZAR DE ALMEIDA', nomeFantasia: 'LUCIANA BOMBAZAR', tipo: 'fisica', cpfCnpj: '2958115950', inscEstadual: null, inscMunicipal: null, endereco: 'ALAMEDA DAS ACÁCIAS QD 07 LT 2,4,6 BLOCO C, RIVIERA', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71920540', referencia: null, email: null },
  { nome: 'SR COMERCIO DE PEDRAS LTDA', nomeFantasia: 'IKÊ PEDRAS', tipo: 'juridica', cpfCnpj: '37060696000151', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 01, RUA 01, SAN DIEGO, 161', complemento: null, numero: null, bairro: 'Setor Habitacional Jardim Botânico', cidade: 'Brasília', uf: 'DF', cep: '71680362', referencia: null, email: null },
  { nome: 'ATACADÃO DAS PEDRAS E SERVIÇOS LTDA', nomeFantasia: 'ATACADÃO DAS PEDRAS', tipo: 'juridica', cpfCnpj: '9480432000111', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA EPTG 01, CONJ 03, LOTE 01', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '72001009', referencia: null, email: null },
  { nome: 'S&P BRASIL VENTILAÇÃO LTDA', nomeFantasia: 'OTAM VENTILADORES', tipo: 'juridica', cpfCnpj: '92659507000170', inscEstadual: '096/0025901', inscMunicipal: null, endereco: 'Avenida Francisco Silveira Bitencourt', complemento: null, numero: '1501', bairro: 'Sarandi', cidade: 'Porto Alegre', uf: 'RS', cep: '91150010', referencia: null, email: null },
  { nome: 'POSTO SANTA CECÍLIA LTDA', nomeFantasia: 'POSTO SANTA CECÍLIA', tipo: 'juridica', cpfCnpj: '62240289000173', inscEstadual: null, inscMunicipal: null, endereco: 'ALAMEDA DOS EUCALIPTOS, QUADRA 107, LOTES 13, 08', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71920010', referencia: null, email: null },
  { nome: 'FS ARMAÇÕES LTDA', nomeFantasia: 'FS ARMAÇÕES', tipo: 'juridica', cpfCnpj: '45307926000162', inscEstadual: null, inscMunicipal: '811628500145', endereco: 'QR 217,  CONJ. N, LOTE 19 S/N', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72547514', referencia: null, email: null },
  { nome: 'PINCEL PRINT COMUNICAÇÃO VISUAL LTDA', nomeFantasia: 'PINCEL PRINT', tipo: 'juridica', cpfCnpj: '57387380000186', inscEstadual: null, inscMunicipal: '836542800138', endereco: 'SIA QUADRA 5-C S/N LOTE 12 SALA 105 EDIFICIO NOBREGA', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200055', referencia: null, email: 'pincelplacasfachadas@gmail.com' },
  { nome: 'VIEIRA RAMOS LTDA - ME', nomeFantasia: 'VIEIRA RAMOS', tipo: 'juridica', cpfCnpj: '46707814000161', inscEstadual: null, inscMunicipal: null, endereco: 'TREC SIA TRECHO 3 165 LJ 102 204 A', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'SOLUÇÃO PISCINAS E AQUECIMENTOS', nomeFantasia: 'SOLUÇÃO PISCINAS E AQUECIMENTOS', tipo: 'juridica', cpfCnpj: '10247990000110', inscEstadual: null, inscMunicipal: null, endereco: 'C 03 LOTE 06 LOJA 01 S/N', complemento: null, numero: '308', bairro: 'Taguatinga Centro (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72010030', referencia: null, email: null },
  { nome: 'ACQUA BRASÍLIA COMÉRCIO E SERVIÇO DE PISCINAS LTDA', nomeFantasia: 'ACQUA BRASÍLIA COMÉRCIO E SERVIÇO DE PISCINAS LTDA', tipo: 'juridica', cpfCnpj: '14030044000179', inscEstadual: '07.581.471/001-07', inscMunicipal: null, endereco: 'TERCEIRA AVENIDA, BLOCO 1226A - LOJA 01', complemento: null, numero: null, bairro: 'Núcleo Bandeirante', cidade: 'Brasília', uf: 'DF', cep: '71720565', referencia: null, email: null },
  { nome: 'SODRAMAR INDUSTRIA E COMERCIO LTDA.', nomeFantasia: 'SODRAMAR INDUSTRIA E COMERCIO LTDA.', tipo: 'juridica', cpfCnpj: '51333797000180', inscEstadual: null, inscMunicipal: null, endereco: 'Rua Caramuru', complemento: null, numero: '925', bairro: 'Conceição', cidade: 'Diadema', uf: 'SP', cep: '09911510', referencia: null, email: null },
  { nome: 'MERITO COMERCIO DE EQUIPAMENTOS LTDA', nomeFantasia: 'MERITO COMERCIO DE EQUIPAMENTOS LTDA', tipo: 'juridica', cpfCnpj: '1582892000149', inscEstadual: '154266598119', inscMunicipal: null, endereco: 'Avenida dos Estados', complemento: null, numero: '7328', bairro: 'Jardim Alzira Franco', cidade: 'Santo André', uf: 'SP', cep: '09290340', referencia: null, email: null },
  { nome: 'SOL E AR COMERCIAL LTDA', nomeFantasia: 'SOL E AR COMERCIAL LTDA', tipo: 'juridica', cpfCnpj: '1873020000130', inscEstadual: '062.712.966/0065', inscMunicipal: null, endereco: 'AV. NOSSA SENHORA DO CARMO, 1290', complemento: null, numero: null, bairro: 'Sion', cidade: 'Belo Horizonte', uf: 'MG', cep: '30310000', referencia: null, email: null },
  { nome: 'MUNDO CATEL COMERCIAL LTDA', nomeFantasia: 'MUNDO CATEL COMERCIAL LTDA', tipo: 'juridica', cpfCnpj: '30461276000138', inscEstadual: '119448684118', inscMunicipal: null, endereco: 'Rua Baltazar Brum', complemento: null, numero: '36', bairro: 'Vila Ré', cidade: 'São Paulo', uf: 'SP', cep: '03667000', referencia: null, email: null },
  { nome: 'ATITUDE MIX IMPORTAÇÃO E DISTRIBUIÇÃO LTDA - ME', nomeFantasia: 'ATITUDE MIX IMPORTAÇÃO E DISTRIBUIÇÃO LTDA - ME', tipo: 'juridica', cpfCnpj: '22997526000120', inscEstadual: '286397555112', inscMunicipal: null, endereco: 'Avenida Dom Pedro I', complemento: null, numero: '19', bairro: 'Conceição', cidade: 'Diadema', uf: 'SP', cep: '09991000', referencia: null, email: null },
  { nome: 'PALÁCIO DAS FERRAMENTAS E PARAFUSOS LTDA', nomeFantasia: 'PALÁCIO DAS FERRAMENTAS E PARAFUSOS LTDA', tipo: 'juridica', cpfCnpj: '68422419000175', inscEstadual: '310171097117', inscMunicipal: null, endereco: 'AVENIDA RIO BRANCO, 745 - GALPÃO 08', complemento: null, numero: null, bairro: 'Vila Santos Dumont', cidade: 'Franca', uf: 'SP', cep: '14405901', referencia: null, email: null },
  { nome: 'MATSUFLORA COMERCIO DE PLANTAS', nomeFantasia: 'MATSUFLORA PLANTAS', tipo: 'juridica', cpfCnpj: '5136271000192', inscEstadual: null, inscMunicipal: null, endereco: 'CHÁCARA EPTG 55B', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '71900000', referencia: null, email: null },
  { nome: 'MAQUINAS TERRA INDUSTRIA POLO JK', nomeFantasia: 'METALL PRODUTOS METALÚRGICOS', tipo: 'juridica', cpfCnpj: '26429167000166', inscEstadual: null, inscMunicipal: null, endereco: 'Polo de Desenvolvimento Juscelino Kubitschek Trecho 1 Conjunto 10', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72549550', referencia: null, email: null },
  { nome: 'REI DO LED SIA LTDA', nomeFantasia: 'REI DO LED SIA LTDA', tipo: 'juridica', cpfCnpj: '56023760000179', inscEstadual: '08.316.561/001-00', inscMunicipal: null, endereco: 'SIA Quadra 4-C - Bloco D - Lotes 26, 27 -  Lojas 11 e 76', complemento: null, numero: '26', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200045', referencia: null, email: null },
  { nome: 'AMERICANAS SA', nomeFantasia: 'LOJAS AMERICANAS TAGUATINGA SHOPPING', tipo: 'juridica', cpfCnpj: '776574072815', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 210, QS 01 LT 40', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72036004', referencia: null, email: null },
  { nome: 'MADEIREIRA BRASILIA COM DE MAD E MAT DE CONST LTDA', nomeFantasia: 'MADEIREIRA BRASILIA COM DE MAD E MAT DE CONST LTDA', tipo: 'juridica', cpfCnpj: '22947083000163', inscEstadual: '07.730.835/001-20', inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: 'DF', cep: '71205080', referencia: null, email: 'contato@madbrasilia.com.br' },
  { nome: 'ATI - APARELHOS DE TRANSPORTE INTELIGENTE LTDA', nomeFantasia: 'ATI ELEVADORES', tipo: 'juridica', cpfCnpj: '20502103000167', inscEstadual: '10.604.580-6', inscMunicipal: null, endereco: 'RUA DO GERALDINO, Nº 131', complemento: null, numero: null, bairro: 'Chácaras Buritis', cidade: 'Goiânia', uf: 'GO', cep: '74391470', referencia: null, email: null },
  { nome: 'RWA PREMOLDADOS', nomeFantasia: 'PRÉ MOLDADOS 3 IRMÂOS', tipo: 'juridica', cpfCnpj: '44672680000165', inscEstadual: '08.104.209/001-26', inscMunicipal: null, endereco: 'Q SDMC Q 1 LOTE 13 SN', complemento: null, numero: null, bairro: 'Ceilândia Centro (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265715', referencia: null, email: null },
  { nome: 'VAN GOGH TRAJES MASCULINOS', nomeFantasia: 'GENTLEMAN MENSWEAR', tipo: 'juridica', cpfCnpj: '4539410000166', inscEstadual: '07.835.276/001-61', inscMunicipal: null, endereco: 'QS 01 RUA 210', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72036004', referencia: null, email: null },
  { nome: 'MAXMIX COMÉRCIO LTDA', nomeFantasia: 'CAMICADO', tipo: 'juridica', cpfCnpj: '3002339008876', inscEstadual: '07.528.569/005-30', inscMunicipal: null, endereco: 'RUA 210, 101', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71950904', referencia: null, email: null },
  { nome: 'RF SERVIÇOS CONTRA QUEDA EM ALTURA LTDA', nomeFantasia: 'RF ENGENHARIA', tipo: 'juridica', cpfCnpj: '49730227000181', inscEstadual: null, inscMunicipal: '820071800170', endereco: 'QSC 19, CHACARA 26, CONJUNTO M, LOTE 01, PARTE C', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72017305', referencia: null, email: null },
  { nome: 'JS MULTI RALOS COMÉRCIO E SERVIÇOS LTDA', nomeFantasia: 'JS MULTI RALOS E SERVIÇOS', tipo: 'juridica', cpfCnpj: '23638909000175', inscEstadual: null, inscMunicipal: null, endereco: 'QD 17, CL 18, LOJAS 01 e B', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73045170', referencia: null, email: 'jsmyltiralos@gmail.com' },
  { nome: 'AGROACO II LTDA', nomeFantasia: 'AGROACO II LTDA', tipo: 'juridica', cpfCnpj: '63895541000145', inscEstadual: '20.349.166-1', inscMunicipal: null, endereco: 'AVENIDA FLAMENGO Nº 07 QD 32 LOTE 07', complemento: null, numero: 'S/N', bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'STEEL ART - IND. E COM. DE MATERIAIS DE CONSTRUÇÃO LTDA', nomeFantasia: 'STEEL ART - IND. E COM. DE MATERIAIS DE CONSTRUÇÃO LTDA', tipo: 'juridica', cpfCnpj: '14533048000170', inscEstadual: '10.517.644-3', inscMunicipal: null, endereco: 'RUA QUINTINO BOCAIÚVA, 1087', complemento: null, numero: null, bairro: 'Polocentro 1ª Etapa', cidade: 'Anápolis', uf: 'GO', cep: '75024060', referencia: null, email: null },
  { nome: 'TAYS CRISTINA AVELAR DUARTE', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '5857253306', inscEstadual: null, inscMunicipal: null, endereco: 'QNP 24, CONJUNTO I, CASA 12', complemento: null, numero: null, bairro: 'Ceilândia Sul (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72235409', referencia: null, email: null },
  { nome: 'SALATIEL PINHEIRO CARDOSO', nomeFantasia: 'SALATIEL PINHEIRO CARDOSO', tipo: 'fisica', cpfCnpj: '2911336143', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 1, CONJUNTO 02, CASA 10', complemento: null, numero: null, bairro: 'Setor Leste (Vila Estrutural)', cidade: 'Brasília', uf: 'DF', cep: '71261020', referencia: null, email: null },
  { nome: 'MIKAMI JAPAN PRESENTES UTILITÁRIOS DOMÉSTICOS LTDA', nomeFantasia: 'MIKAMI', tipo: 'juridica', cpfCnpj: '34844954000526', inscEstadual: '07.938.727/004-82', inscMunicipal: null, endereco: 'QS 01 RUA 210 SALÃO 3090', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71950904', referencia: null, email: null },
  { nome: 'ILUX LEDS DISTRIBUIDORA DE ILUMINAÇÃO EM GERAL LTDA', nomeFantasia: 'ILUX LEDS DISTRIBUIDORA DE ILUMINAÇÃO EM GERAL LTDA', tipo: 'juridica', cpfCnpj: '47700998000109', inscEstadual: '08.161.011/001-99', inscMunicipal: null, endereco: 'QUADRA QNO 19, CONJUNTO D -3', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '71261190', referencia: null, email: 'ILUXLEDS@GMAIL.COM' },
  { nome: 'FRANCISCO PEREIRA NETO', nomeFantasia: 'FRANCISCO PEREIRA NETO', tipo: 'juridica', cpfCnpj: '38710502000189', inscEstadual: null, inscMunicipal: '2000004716', endereco: 'RUA 22, QD. 77, LT 22, CASA 02', complemento: null, numero: null, bairro: 'Parque Alvorada I', cidade: 'Luziânia', uf: 'GO', cep: '72836350', referencia: null, email: null },
  { nome: 'KANNEL PORTAS AUTOMÁTICAS COMÉRCIO E SERVIÇOS LTDA', nomeFantasia: 'KANNEL PORTAS AUTOMÁTICAS', tipo: 'juridica', cpfCnpj: '46261153000193', inscEstadual: null, inscMunicipal: '813412400165', endereco: 'CSE 7, AE 19 E 20, LOTE 4', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72025075', referencia: null, email: null },
  { nome: 'DEXCO S/A', nomeFantasia: 'DEXCO S/A (LOUÇAS DECA)', tipo: 'juridica', cpfCnpj: '97837181002271', inscEstadual: '407489356119', inscMunicipal: null, endereco: 'Avenida Antônio Frederico Ozanan', complemento: null, numero: '11900', bairro: 'Distrito Industrial', cidade: 'Jundiaí', uf: 'SP', cep: '13213030', referencia: null, email: null },
  { nome: 'DOCOL INDUSTRIA E COMERCIO LTDA', nomeFantasia: 'DOCOL INDUSTRIA E COMERCIO LTDA', tipo: 'juridica', cpfCnpj: '75339051000141', inscEstadual: '250767805', inscMunicipal: null, endereco: 'AVENIDA EDMUNDO DOUBRAWA, 1001', complemento: null, numero: null, bairro: 'Zona Industrial Norte', cidade: 'Joinville', uf: 'SC', cep: '89219502', referencia: null, email: null },
  { nome: 'VITÓRIA CONSTRUTORA, COMÉRCIO E SERVIÇO LTDA', nomeFantasia: 'VITÓRIA CONSTRUTORA, COMÉRCIO E SERVIÇO', tipo: 'juridica', cpfCnpj: '11066984000120', inscEstadual: '07.762.872/001-53', inscMunicipal: null, endereco: 'ADE CONJ 18, LT31, S/N 31', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72006200', referencia: null, email: null },
  { nome: 'V & V SIQUEIRA PROJETOS DE INTERIORES LTDA', nomeFantasia: 'CASA BELLA MÁRMORES E GRANITOS', tipo: 'juridica', cpfCnpj: '4538280000147', inscEstadual: '07.512.958/001-77', inscMunicipal: null, endereco: 'SIA Trecho 1', complemento: null, numero: '630', bairro: 'Zona Industrial (Guará) - 630 A 780 -   BLOCO 01', cidade: 'Brasília', uf: 'DF', cep: '71200010', referencia: null, email: null },
  { nome: 'MARIA APARECIDA DA CUNHA SOARES', nomeFantasia: 'MARIA APARECIDA DA CUNHA SOARES', tipo: 'juridica', cpfCnpj: '64575538000107', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 98, QD, 86, LOTEE 10A S/N', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'RUTH SOARES SILVA', nomeFantasia: 'RUTH SOARES SILVA', tipo: 'juridica', cpfCnpj: '64527715000180', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 98, QD, 86, LOTEE 10A S/N', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MÁRCIO RODRIGUES DE OLIVEIRA', nomeFantasia: 'MÁRCIO RODRIGUES DE OLIVEIRA', tipo: 'juridica', cpfCnpj: '64348627000110', inscEstadual: null, inscMunicipal: null, endereco: '3N, QD 3, LOTE 28, S/N', complemento: null, numero: null, bairro: 'Belvedere', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'marciojoseaugustopoliana@gmail.com' },
  { nome: 'MXX SOLUÇÕES DIGITAIS LTDA', nomeFantasia: 'MXX SOLUÇÕES DIGITAIS', tipo: 'juridica', cpfCnpj: '43993030000159', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PADRE AUGUSTO, 16 SALA 302', complemento: null, numero: null, bairro: 'Setor Central', cidade: 'Montes Claros de Goiás', uf: 'GO', cep: '39400053', referencia: null, email: null },
  { nome: 'AMAZON SERVIÇOS DE VAREJO DO BRASIL LTDA', nomeFantasia: 'AMAZON SERVIÇOS DE  VAREJO DO BRASIL', tipo: 'juridica', cpfCnpj: '15436940001096', inscEstadual: '07.749.274/003-65', inscMunicipal: null, endereco: 'ROD DF -290, S/N  - SANTA MARIA', complemento: null, numero: null, bairro: 'Santa Maria', cidade: 'Brasília', uf: 'DF', cep: '72501100', referencia: null, email: null },
  { nome: 'DIVULGA MOVÉIS PARA ESCRITORIO', nomeFantasia: 'DIVULGA MOVÉIS', tipo: 'juridica', cpfCnpj: '25684027000171', inscEstadual: null, inscMunicipal: null, endereco: 'QNE 14 LOTE 12 LOJA 02', complemento: null, numero: null, bairro: 'Taguatinga Centro (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72125140', referencia: null, email: null },
  { nome: 'REGA CERRADO LTDA', nomeFantasia: 'REGA CERRADO', tipo: 'juridica', cpfCnpj: '18747763000166', inscEstadual: null, inscMunicipal: '76554900177', endereco: 'QR 313 CONJ 11, CASA 18', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72307311', referencia: null, email: null },
  { nome: 'CONDOMINIO CONNECT TOWERS -BSB', nomeFantasia: 'CONNECT TOWERS', tipo: 'juridica', cpfCnpj: '29267750000106', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 36 SUL AGUAS CLARAS', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71931360', referencia: null, email: null },
  { nome: 'AZEMAR FERREIRA DE SOUZA', nomeFantasia: 'AZEMAR FERREIRA DE SOUZA', tipo: 'juridica', cpfCnpj: '59974309000125', inscEstadual: null, inscMunicipal: null, endereco: '10, S/N', complemento: null, numero: null, bairro: 'Parque Esplanada II', cidade: 'Valparaíso de Goiás', uf: 'GO', cep: '72878081', referencia: null, email: null },
  { nome: 'AUSTRO ENGENHARIA LTDA - ME', nomeFantasia: 'AUSTRO ENGENHARIA', tipo: 'juridica', cpfCnpj: '25229291000115', inscEstadual: null, inscMunicipal: '777604700124', endereco: 'SHC/SW EQRSW 2/3 ÁREA ESPECIAL 02 SALA 101 20º PAVIMENTO', complemento: null, numero: null, bairro: 'Setor Sudoeste', cidade: 'Brasília', uf: 'DF', cep: '70675260', referencia: null, email: null },
  { nome: 'BFG SERVIÇOS ELÉTRICOS LTDA', nomeFantasia: 'BFG SERVIÇOS ELÉTRICOS', tipo: 'juridica', cpfCnpj: '18115016000105', inscEstadual: null, inscMunicipal: null, endereco: 'SETOR SMSE CONJUNTO 13, LOTE 4, FRAÇÃO 4', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72310213', referencia: null, email: null },
  { nome: 'LF JARDIM BOTÂNICO ALUGUEL DE EQUIPAMENTOS', nomeFantasia: 'CASA DO CONSTRUTOR (LAGO SUL)', tipo: 'juridica', cpfCnpj: '34404014000192', inscEstadual: '07.930.553/001-67', inscMunicipal: null, endereco: 'SHIS QI 23 - POLO VERDE  - LOJA 1, 23  -  LAGO SUL', complemento: null, numero: null, bairro: 'Lago Sul', cidade: 'Brasília', uf: 'DF', cep: '07167965', referencia: null, email: null },
  { nome: 'SCHUSTER LOCAÇÕES E REPRESENTAÇÕES LTDA', nomeFantasia: 'NU TRONO LOCAÇÕES', tipo: 'juridica', cpfCnpj: '48144386000131', inscEstadual: '08.169.114/001-06', inscMunicipal: null, endereco: 'BURITIS, CHACARA 36, LOTES 1 E 2', complemento: null, numero: null, bairro: 'Ponte Alta Norte (Gama)', cidade: 'Brasília', uf: 'DF', cep: '72426095', referencia: null, email: null },
  { nome: 'JOSE FIRMINO DE OLIVEIRA', nomeFantasia: 'JOSE FIRMINO', tipo: 'fisica', cpfCnpj: '2724502310', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'CLARO S.A.', nomeFantasia: 'CLARO', tipo: 'juridica', cpfCnpj: '40432544000147', inscEstadual: null, inscMunicipal: null, endereco: 'R HENRI DUNANT 780 TORRE A E TORRE B', complemento: null, numero: null, bairro: 'Santo Amaro', cidade: 'São Paulo', uf: 'SP', cep: '04709110', referencia: null, email: null },
  { nome: 'BHAC BRULIMP E FERRAGENS LTDA', nomeFantasia: 'BRULIMP PRODUTOS DE LIMPEZA', tipo: 'juridica', cpfCnpj: '41383820000197', inscEstadual: '.113.265-9', inscMunicipal: null, endereco: 'AV BRASILIA, N° 1302, FORMOSINHA , DQ 82', complemento: null, numero: null, bairro: 'Nova Formosa', cidade: 'Formosa', uf: 'GO', cep: '73813010', referencia: null, email: null },
  { nome: 'BSB ABRASIVOS', nomeFantasia: 'BSB ABRASIVOS', tipo: 'juridica', cpfCnpj: '21268335000165', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 5, CHACARA 122 LOTE 18', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires - Trecho 3', cidade: 'Brasília', uf: 'DF', cep: '72159000', referencia: null, email: null },
  { nome: 'POP PIPOCA GOURMET', nomeFantasia: 'POP PIPOCA GOURMET', tipo: 'fisica', cpfCnpj: '9317594106', inscEstadual: null, inscMunicipal: null, endereco: 'DF 475 S/N', complemento: null, numero: null, bairro: 'Ponte Alta Norte (Gama)', cidade: 'Brasília', uf: 'DF', cep: '72427000', referencia: null, email: null },
  { nome: 'GEFFESON XAVIER DA SILVA', nomeFantasia: 'GEFFESON XAVIER DA SILVA', tipo: 'fisica', cpfCnpj: '3171926121', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 4A TRAV.3  BLOCO 2/3 SALA 503', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72006206', referencia: null, email: null },
  { nome: 'CASA AFECTO  MOVEIS E DECORAÇÕES LTDA', nomeFantasia: 'CASA AFECTO MOVEIS E DECORAÇOES', tipo: 'juridica', cpfCnpj: '47497778000111', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 05 CHACARA 96 LOTE,09 SETOR VICENTE PIRES', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '71977720', referencia: null, email: null },
  { nome: 'DD CLEAN RIO PISCINAS', nomeFantasia: 'D  CLEAN RI PISCINAS', tipo: 'juridica', cpfCnpj: '23922317000180', inscEstadual: null, inscMunicipal: null, endereco: 'QD CSB 09  LOTE 06  LOJA 08', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72015962', referencia: null, email: null },
  { nome: 'MILENY DOS SANTOS GOMES', nomeFantasia: 'MILENY DOS SANTOS GOMES', tipo: 'juridica', cpfCnpj: '64424365000126', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 3, CONJUNTO 15, 27, SETOR NORTE', complemento: null, numero: null, bairro: 'Vila Estrutural', cidade: 'Brasília', uf: 'DF', cep: '71258280', referencia: null, email: null },
  { nome: 'JOSÉ WILKSON LEÃO OLIVEIRA', nomeFantasia: 'JOSÉ WILKSON LEÃO OLIVEIRA', tipo: 'juridica', cpfCnpj: '41572016000156', inscEstadual: null, inscMunicipal: null, endereco: 'SHPS QUADRA 304, CONJUNTO A, 21', complemento: null, numero: null, bairro: 'Setor Habitacional Pôr do Sol (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '71615370', referencia: null, email: 'jose_wilkson@hotmail.com' },
  { nome: 'EZIEL LUCIO DE LIMA', nomeFantasia: 'EZIEL LUCIO DE LIMA', tipo: 'fisica', cpfCnpj: '69286450168', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 204 LOTE 01', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71939540', referencia: null, email: null },
  { nome: 'GOBER INDUSTRIA E COMERCIO LTDA', nomeFantasia: 'GOBER', tipo: 'juridica', cpfCnpj: '53554226000109', inscEstadual: '111081017113', inscMunicipal: null, endereco: 'RUA HELENA DO SACRAMENTO, 490', complemento: null, numero: null, bairro: 'Mandaqui', cidade: 'São Paulo', uf: 'SP', cep: '02433020', referencia: null, email: null },
  { nome: 'ASSB COMERCIO VAREJISTA DE DOCES LTDA', nomeFantasia: 'CACAU SHOW', tipo: 'juridica', cpfCnpj: '17611014019163', inscEstadual: null, inscMunicipal: null, endereco: 'QS 01 RUA 210, AGUAS CLARAS TAGUATINGA', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71950904', referencia: null, email: null },
  { nome: 'SERGIO DE LIMA LEITE DE JESUS', nomeFantasia: 'SERGIO DE LIMA LEITE DE JESUS', tipo: 'juridica', cpfCnpj: '12027749000101', inscEstadual: null, inscMunicipal: '72059175', endereco: 'RUA DO VERBO DIVINO, 45', complemento: null, numero: null, bairro: 'Chácaras Cotia', cidade: 'Contagem', uf: 'MG', cep: '32183050', referencia: null, email: 'contabil@freitaseschmidt.com.br' },
  { nome: 'MANDA LA TRANSP DE CARGAS LTDA', nomeFantasia: 'MANDALA TRANSPORTE DE CARGAS', tipo: 'juridica', cpfCnpj: '3298420000356', inscEstadual: '336832471110', inscMunicipal: null, endereco: 'RUA FELICIO ANTONIO ALVES, 309', complemento: null, numero: null, bairro: 'Vila Nova Bonsucesso', cidade: 'Guarulhos', uf: 'SP', cep: '07177220', referencia: null, email: 'saopaulo@mandalatransportes.com.br' },
  { nome: 'ISLF SEGURANÇA ELETRONICA LTDA', nomeFantasia: 'ISLF SEGURANÇA ELETRONICA', tipo: 'juridica', cpfCnpj: '38225391000115', inscEstadual: null, inscMunicipal: null, endereco: 'QD 405 CONJ 26 LOTR 09 RECANTO DAS EMAS', complemento: null, numero: null, bairro: 'Recanto das Emas', cidade: 'Brasília', uf: 'DF', cep: '72631126', referencia: null, email: null },
  { nome: 'CONSTRUTORA JHE REVESTIMENTOS LTDA', nomeFantasia: 'CONSTRUTORA JHE', tipo: 'juridica', cpfCnpj: '62915973000108', inscEstadual: '08.432.686/001-17', inscMunicipal: null, endereco: 'QN 403 CJ A LOTE 3 AP 1005 COND: QUEBEC', complemento: null, numero: null, bairro: 'Samambaia Norte (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72319540', referencia: null, email: 'construtorajhe@gmail.com' },
  { nome: 'PERFIL TECH ATACADISTA DE ALUMÍNIOS LTDA', nomeFantasia: 'PERFIL TECH ATACADISTA DE ALUMÍNIOS', tipo: 'juridica', cpfCnpj: '41797420000128', inscEstadual: '08.052.578/001-50', inscMunicipal: null, endereco: 'TRECHO SIA TRECHO 3 LOTES 1430 E 1440', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'WP FORT SEGURANÇA ELETRONICA E SERVIÇOS LTDA', nomeFantasia: 'WP FORT SEGURANÇA ELETRONICA', tipo: 'juridica', cpfCnpj: '40126526000190', inscEstadual: null, inscMunicipal: null, endereco: 'QD SHPS QUADRA 503  CHACARA 02,3A', complemento: null, numero: null, bairro: 'Setor Industrial (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72238290', referencia: null, email: null },
  { nome: 'LOJAS ESTRELA DO LAR LTDA', nomeFantasia: 'LOJAS ESTRELA DO LAR', tipo: 'juridica', cpfCnpj: '28130849000603', inscEstadual: null, inscMunicipal: null, endereco: 'AV. GETULIO VARGAS', complemento: null, numero: null, bairro: 'Centro', cidade: 'Adamantina', uf: 'SP', cep: '12305010', referencia: null, email: null },
  { nome: 'PESOS FITNESS LTDA', nomeFantasia: 'PESOS FITNESS LTDA', tipo: 'juridica', cpfCnpj: '37308922000170', inscEstadual: '003.745.520/0048', inscMunicipal: null, endereco: 'RUA UBERABA , 192', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cláudio', uf: 'MG', cep: '35530000', referencia: null, email: null },
  { nome: 'NORTE BORRACHAS LTDA', nomeFantasia: 'NORTE BORRACHAS LTDA', tipo: 'juridica', cpfCnpj: '62197425000190', inscEstadual: null, inscMunicipal: null, endereco: 'SCLRN 713, BLOCO D - LOJA 51', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70760534', referencia: null, email: null },
  { nome: 'TORA COMÉRCIO DE MADEIRAS LTDA', nomeFantasia: 'TORA COMÉRCIO DE MADEIRAS LTDA', tipo: 'juridica', cpfCnpj: '17308762000152', inscEstadual: '07.629.919/000-132', inscMunicipal: null, endereco: 'EPTG Chácara 55 - Loja B', complemento: null, numero: '3', bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72005310', referencia: null, email: null },
  { nome: 'TORNEDORA JK LTDA ME', nomeFantasia: 'TORNEADORA JK', tipo: 'juridica', cpfCnpj: '4071154000125', inscEstadual: null, inscMunicipal: '741542200122', endereco: 'SETOR DE TRANSPORTES RODOVIÁRIOS DE CARGAS, TRECHO 4, CONJUNTO B, LO', complemento: null, numero: null, bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71225542', referencia: null, email: 'torneadorajk@gmail.com' },
  { nome: 'DAY BRASIL S/A', nomeFantasia: 'DAY BRASIL S/A', tipo: 'juridica', cpfCnpj: '49327943000201', inscEstadual: '398259766110', inscMunicipal: null, endereco: 'Rua José Albino Pereira', complemento: null, numero: '190', bairro: 'Jardim Alvorada', cidade: 'Jandira', uf: 'SP', cep: '06612001', referencia: null, email: null },
  { nome: 'ELLO SISTEMA DECORATIVO EPP LTDA', nomeFantasia: 'ELLO SISTEMA DECORATIVO EPP LTDA', tipo: 'juridica', cpfCnpj: '12014391000182', inscEstadual: '07.540.686/001-98', inscMunicipal: null, endereco: 'EPTG CHÁCARA 54 N 54', complemento: null, numero: '6', bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72110800', referencia: null, email: 'valter.ello@gmail.com' },
  { nome: 'METHA CONSTRUÇÕES E SERVIÇOS LTDA', nomeFantasia: 'METHA CONSTRUÇÕES E SERVIÇOS', tipo: 'juridica', cpfCnpj: '5601496000172', inscEstadual: '07.443.923/001-64', inscMunicipal: null, endereco: 'QI, 23, 18', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135230', referencia: null, email: null },
  { nome: 'LLUMMTECH PROFESSIONAL LIGHTING', nomeFantasia: 'BRONZEART LUMINÁRIAS', tipo: 'juridica', cpfCnpj: '30609969000125', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida Dona Cesária Camargo de Oliveira', complemento: null, numero: '197', bairro: 'Jardim Vista Alegre', cidade: 'Embu das Artes', uf: 'SP', cep: '06807320', referencia: null, email: null },
  { nome: 'AVANT INDÚSTRIA E COMÉRCIO DE PRODUTOS SINTÉTICOS LTDA', nomeFantasia: 'AVANT INDÚSTRIA E COMÉRCIO DE PRODUTOS SINTÉTICOS LTDA', tipo: 'juridica', cpfCnpj: '13441108000161', inscEstadual: null, inscMunicipal: null, endereco: 'Rua da Consolação  -   3º ANDAR', complemento: null, numero: '247', bairro: 'Consolação', cidade: 'São Paulo', uf: 'SP', cep: '01301000', referencia: null, email: null },
  { nome: 'BARRA PAPÉIS INDÚSTRIA E COMÉRCIO LTDA', nomeFantasia: 'FORMAS TUBOMIM', tipo: 'juridica', cpfCnpj: '28747429000166', inscEstadual: null, inscMunicipal: null, endereco: 'RUA PONTAL,  132,  LETRA A - DISTRITO INDUSTRIAL', complemento: null, numero: null, bairro: 'Centro', cidade: 'Elói Mendes', uf: 'MG', cep: '37110000', referencia: null, email: null },
  { nome: 'DIMIBU INDUSTRIA DE ARTEFATOS DE PAPEL E PAPELÃO LTDA', nomeFantasia: 'DIMIBU INDUSTRIA DE ARTEFATOS DE PAPEL E PAPELÃO LTDA', tipo: 'juridica', cpfCnpj: '60810611000127', inscEstadual: '104361268116', inscMunicipal: null, endereco: 'Rua Bento Quirino', complemento: null, numero: '151', bairro: 'Vila Talarico', cidade: 'São Paulo', uf: 'SP', cep: '03534010', referencia: null, email: 'VENDAS@DIMIBU.COM.BR' },
  { nome: 'TUBOS OBRA INDÚSTRIA E COM. DE TUBOS DE PAPELÃO LTDA', nomeFantasia: 'TUBOS OBRA INDÚSTRIA E COM. DE TUBOS DE PAPELÃO LTDA', tipo: 'juridica', cpfCnpj: '63054878000120', inscEstadual: null, inscMunicipal: null, endereco: 'AV. LAURINDO MARSON Nº 111', complemento: null, numero: null, bairro: 'Centro', cidade: 'Boituva', uf: 'SP', cep: '18556320', referencia: null, email: null },
  { nome: 'PLANALTO VIDROS ESPECIAIS LTDA', nomeFantasia: 'PRISMAY INDUSTRIA E COMÉRCIO DE VIDROS', tipo: 'juridica', cpfCnpj: '9153923000158', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA MARGINAL ESTRUTURAL, CAVP, CHÁCARA 123, LOTE 1C', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72007155', referencia: null, email: null },
  { nome: 'VIBE DIGITAL', nomeFantasia: 'VIBE DIGITAL', tipo: 'juridica', cpfCnpj: '53706288000180', inscEstadual: null, inscMunicipal: null, endereco: 'RUA DURVAL', complemento: null, numero: null, bairro: 'Guacuri', cidade: 'São Paulo', uf: 'SP', cep: '07050280', referencia: null, email: null },
  { nome: 'E&L DE ALMEIDA SERVIÇOS LTDA', nomeFantasia: 'FIRE SOLUÇÕES INTELIGENTES', tipo: 'juridica', cpfCnpj: '30793109000194', inscEstadual: null, inscMunicipal: null, endereco: 'DAS PAINEIRAS, LOTE 06, ED. ONE PARK MALL, SALA 22', complemento: null, numero: null, bairro: 'Norte (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71918000', referencia: null, email: null },
  { nome: 'FERNANDO PENHA DE BESSA', nomeFantasia: 'FERNANDO PENHA DE BESSA', tipo: 'juridica', cpfCnpj: '64870097000176', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 30, LOTE 91', complemento: null, numero: null, bairro: 'Setor Oeste (Gama)', cidade: 'Brasília', uf: 'DF', cep: '72420300', referencia: null, email: 'nandobessapenha@gmail.com' },
  { nome: 'SERRALHERIA CRISTAL LTDA', nomeFantasia: 'SERRALHERIA CRISTAL', tipo: 'juridica', cpfCnpj: '21437920000141', inscEstadual: null, inscMunicipal: '37126', endereco: 'RUA TUITI, Nº S/N, QUADRA 32, LOTE 8 B', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'S.A ATACADISTA DE ALIMENTOS LTDA02', nomeFantasia: 'SUPER ADEGA', tipo: 'juridica', cpfCnpj: '7738069000247', inscEstadual: null, inscMunicipal: null, endereco: 'CSG SUL 20 TAGUATINGA SUL', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72035520', referencia: null, email: null },
  { nome: 'CARLOS HENRIQUE BORGES DE MORAES', nomeFantasia: 'CARLOS HENRIQUE', tipo: 'fisica', cpfCnpj: '70323358101', inscEstadual: null, inscMunicipal: null, endereco: 'RUA JK QD 10 LOTE 11', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MULTI FILTROS EIRELI', nomeFantasia: 'MUNDO DOS FILTROS', tipo: 'juridica', cpfCnpj: '15801523000104', inscEstadual: null, inscMunicipal: null, endereco: 'SIA TRECHO 3 LOTES 1720 /1730  ZONA INDUSTRIAL GUARA', complemento: null, numero: null, bairro: 'Zona Industrial', cidade: 'Brasília', uf: 'DF', cep: '71200030', referencia: null, email: null },
  { nome: 'QUER CAFÉ', nomeFantasia: 'QUER CAFÉ', tipo: 'fisica', cpfCnpj: '3381882155', inscEstadual: null, inscMunicipal: null, endereco: 'QS 5,RUA 100, CONDOMÍNIO COSTA VERDE, APTO 405 A', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71963000', referencia: null, email: null },
  { nome: 'STARKEL MÁQUINAS E IMPLEMENTOS AGRÍCOLAS LTDA', nomeFantasia: 'STARKEL MÁQUINAS E IMPLEMENTOS AGRÍCOLAS', tipo: 'juridica', cpfCnpj: '45760648000366', inscEstadual: '005.009.460/0023', inscMunicipal: '71874', endereco: 'RODOVIA MG 235 KM 89,1 -  S/N, LOJA 2', complemento: null, numero: null, bairro: 'Distrito de Guarda dos Ferreiros', cidade: 'São Gotardo', uf: 'MG', cep: '38800000', referencia: null, email: null },
  { nome: 'WR CONSTRUTORA E ARTEFATOS DE CONCRETO LTDA', nomeFantasia: 'WR CONSTRUTORA', tipo: 'juridica', cpfCnpj: '35492780000119', inscEstadual: '10.797.447-79', inscMunicipal: null, endereco: 'RODOVIA BR 040, S/N KM 102', complemento: null, numero: null, bairro: 'SETOR NORTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'HF GUARIENTO GARDEN CENTER', nomeFantasia: 'LOJA AIMIRIM', tipo: 'juridica', cpfCnpj: '30656548000155', inscEstadual: '671464627112', inscMunicipal: null, endereco: 'RUA FRANCISCO PENGA, Nº 26', complemento: null, numero: null, bairro: 'Parque das Indústrias (Nova Veneza)', cidade: 'Sumaré', uf: 'SP', cep: '13178431', referencia: null, email: null },
  { nome: 'VC1 SOLUÇÕES EM TECNOLOGIA LTDA', nomeFantasia: 'VC1 SOLUÇÕES', tipo: 'juridica', cpfCnpj: '23306252000149', inscEstadual: null, inscMunicipal: null, endereco: 'RUA JOSE JUSTINO DE CARVALHO', complemento: null, numero: null, bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '19901560', referencia: null, email: null },
  { nome: '3 IRMAOS MATERIAIS', nomeFantasia: '3 IRMAOS MATERIAIS', tipo: 'juridica', cpfCnpj: '616839000159', inscEstadual: '07.325.952/001-87', inscMunicipal: null, endereco: 'Quadra 1', complemento: null, numero: '7', bairro: 'Setor Industrial (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72265010', referencia: null, email: null },
  { nome: 'JAIRO LOPES FERREIRA - EIRELLI', nomeFantasia: 'JAIRO LOPES FERREIRA - EIRELLI', tipo: 'juridica', cpfCnpj: '2907464000101', inscEstadual: '07.392.200/001-31', inscMunicipal: null, endereco: 'QS 03, PRAÇA 400 - LOTE A - LOJA 02', complemento: null, numero: null, bairro: 'Areal (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71953900', referencia: null, email: null },
  { nome: 'SOLUÇÕES ELÉTRICAS REIS LTDA', nomeFantasia: 'SOLUÇÕES ELÉTRICAS REIS LTDA', tipo: 'juridica', cpfCnpj: '31149038000154', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 52 QD 23 LOTE 09', complemento: null, numero: '9', bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'SOLUCOESELETRICAREIS8689@GMAIL.COM' },
  { nome: 'KOHLER PRODUTOS PARA COZINHA E BANHEIROS LTDA', nomeFantasia: 'KOHLER PRODUTOS PARA COZINHA E BANHEIROS LTDA', tipo: 'juridica', cpfCnpj: '20373585000445', inscEstadual: '026.264.743/0221', inscMunicipal: null, endereco: 'AVENIDA VERADOR PROFESSOR PAULO AFONSO', complemento: null, numero: '1200', bairro: 'Centro', cidade: 'Andradas', uf: 'MG', cep: '37841890', referencia: null, email: null },
  { nome: 'DF ATACADISTA', nomeFantasia: 'DF ATACADISTA', tipo: 'juridica', cpfCnpj: '33578308000178', inscEstadual: '07.914.856/001-00', inscMunicipal: null, endereco: 'SIA Trecho 4', complemento: null, numero: 'S/N', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200040', referencia: null, email: 'MAURO@DFATACADISTA.COM.BR' },
  { nome: 'IRMÃOS PEPE LTDA', nomeFantasia: 'PEPE TINTAS', tipo: 'juridica', cpfCnpj: '37061769000200', inscEstadual: '07.317.995/002-45', inscMunicipal: null, endereco: 'QS 03 EPCT LOTE 11 LOJA 03', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72030979', referencia: null, email: null },
  { nome: 'AC COELHO MATERIAIS PARA CONSTRUÇÃO LTDA', nomeFantasia: 'AC COELHO MAT. DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '37083474000405', inscEstadual: '07.309.426/003-19', inscMunicipal: null, endereco: 'QUADRA, CLS 312 BLOCO A LOJA A', complemento: null, numero: null, bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF', cep: '70364510', referencia: null, email: null },
  { nome: 'CENTRO OESTE AÇO - EPS', nomeFantasia: 'CENTRO OESTE AÇO - EPS', tipo: 'juridica', cpfCnpj: '23011763000133', inscEstadual: '10.638.949-1', inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: 'GO', cep: '72874210', referencia: null, email: 'CENTROOESTEACOEPS@GMAIL.COM' },
  { nome: 'WA EMPREENDIMENTOS E LOCAÇÃO DE EQUIPAMENTOS CONSTRUÇÃO E REFORMAS LTDA', nomeFantasia: 'WA EMPREENDIMENTOS E LOCAÇÃO', tipo: 'juridica', cpfCnpj: '29607087000141', inscEstadual: '003.125.079/0018', inscMunicipal: null, endereco: 'RUA DO FAZENDEIRO, N 978', complemento: null, numero: null, bairro: 'Jardim das Palmeiras', cidade: 'Uberlândia', uf: 'MG', cep: '37412288', referencia: null, email: null },
  { nome: 'BOM JESUS LOCAÇÃO E CAÇAMBA LTDA', nomeFantasia: 'BOM JESUS LOCAÇÃO', tipo: 'juridica', cpfCnpj: '5389137000101', inscEstadual: null, inscMunicipal: null, endereco: 'AV.  ESPANHA ,NUMERO 277, SALA 01', complemento: null, numero: null, bairro: 'Bom Jesus', cidade: 'Uberlândia', uf: 'MG', cep: '38405048', referencia: null, email: null },
  { nome: 'PISOS DRYWALL PORTAS REVESTIMENTOS E CONGENERES EIRELI', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '33482641000189', inscEstadual: '07.913.580/001-80', inscMunicipal: null, endereco: 'SHCGN 710 BLOCO B LOJA 8', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70750732', referencia: null, email: null },
  { nome: 'MANINHO FERRAGENS LTDA', nomeFantasia: 'MANINHO FERRAGENS', tipo: 'juridica', cpfCnpj: '40753806000175', inscEstadual: '08.033.761/001-98', inscMunicipal: null, endereco: 'QD 08, BLOC 07, LOTE 01, LOJA 01', complemento: null, numero: null, bairro: 'Sobradinho', cidade: 'Brasília', uf: 'DF', cep: '73005080', referencia: null, email: null },
  { nome: 'DU RAMO MAQUINAS E EQUIPAMENTOS LTDA', nomeFantasia: 'DU RAMO LOCAÇÃO', tipo: 'juridica', cpfCnpj: '13285350000193', inscEstadual: null, inscMunicipal: null, endereco: 'AV. ESPANHA NUMERO 465', complemento: null, numero: null, bairro: 'Bom Jesus', cidade: 'Uberlândia', uf: 'MG', cep: '38405048', referencia: null, email: null },
  { nome: 'PREDILANDIA  MATERIAIS DE CONSTRUÇÃO', nomeFantasia: 'PREDILANDIA MATERIAIS DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '22664467000179', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA FREDERICO TIBERY 805', complemento: null, numero: null, bairro: 'Bom Jesus', cidade: 'Uberlândia', uf: 'MG', cep: '38405074', referencia: null, email: null },
  { nome: 'UMUARAMA MATERIAIS DE CONSTRUÇÃO', nomeFantasia: 'UMUARAMA MATERIAIAS DE CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '25089115000125', inscEstadual: null, inscMunicipal: null, endereco: 'AV. DOM PEDRO II, 1471- ALTO UMUARAMA', complemento: null, numero: null, bairro: 'Bom Jesus', cidade: 'Uberlândia', uf: 'MG', cep: '38405280', referencia: null, email: null },
  { nome: 'EA UBERLANDIA ALUGUEL DE EQUIPAMENTOS LTDA', nomeFantasia: 'CASA DO CONSTRUTOR', tipo: 'juridica', cpfCnpj: '13213937000197', inscEstadual: null, inscMunicipal: null, endereco: null, complemento: null, numero: null, bairro: null, cidade: null, uf: null, cep: null, referencia: null, email: null },
  { nome: 'TETO LOCADORA', nomeFantasia: 'TETO LOCADORA', tipo: 'juridica', cpfCnpj: '38394049000300', inscEstadual: null, inscMunicipal: null, endereco: 'AV.SEGISMUNDO PEREIRA,2366', complemento: null, numero: null, bairro: 'Santa Mônica', cidade: 'Uberlândia', uf: 'MG', cep: '38408170', referencia: null, email: null },
  { nome: 'MAKSUEL PINHEIRO CARDOSO', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '2339780110', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 01, CONJUNTO 02, CASA 10', complemento: null, numero: null, bairro: 'Setor Leste (Vila Estrutural)', cidade: 'Brasília', uf: 'DF', cep: '71261020', referencia: null, email: null },
  { nome: 'LENHADOR COMERCIO DE MADEIRAS LTDA', nomeFantasia: 'LENHADOR COMERCIO DE MADEIRAS', tipo: 'juridica', cpfCnpj: '23159085000150', inscEstadual: null, inscMunicipal: null, endereco: 'AV. FLAMENGO QD 17 LOTE 01', complemento: null, numero: null, bairro: 'RIO DE JANEIRO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'ALDAIR DUARTE DE LIMA ALECRIM', nomeFantasia: null, tipo: 'fisica', cpfCnpj: '51220679100', inscEstadual: null, inscMunicipal: null, endereco: 'CNB 14, LOTE 05, ED AMARO BEZERRA APTO 109', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72115145', referencia: null, email: null },
  { nome: 'MADEREIRA AUTO ELÉTRICA SANTOS LTDA', nomeFantasia: 'MADEREIRA OLIVEIRA', tipo: 'juridica', cpfCnpj: '499583000147', inscEstadual: null, inscMunicipal: null, endereco: 'RUA RIO BRANCO QD 104 LOT 11/12', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MADEIREIRA MEDEIROS LTDA', nomeFantasia: 'MADEIREIRA MEDEIROS LTDA', tipo: 'juridica', cpfCnpj: '8242840000172', inscEstadual: null, inscMunicipal: null, endereco: 'AV. DR VICENTE SALLES GUIMARAES 630', complemento: null, numero: null, bairro: 'Alto Umuarama', cidade: 'Uberlândia', uf: 'MG', cep: '38405386', referencia: null, email: null },
  { nome: 'UBERCOM MATERIAIS P/ CONSTRUCAO LTDA', nomeFantasia: 'UBERCOM MATERIAIS P/ CONSTRUCAO LTDA', tipo: 'juridica', cpfCnpj: '71085328000104', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA JOAO NAVES DE AVILA, 6530', complemento: null, numero: null, bairro: 'Cidade Jardim', cidade: 'Uberlândia', uf: 'MG', cep: '38408703', referencia: null, email: null },
  { nome: 'ATALA SERVIÇOS GERAIS LTDA', nomeFantasia: 'ATALA SERVIÇOS', tipo: 'juridica', cpfCnpj: '3633237000106', inscEstadual: null, inscMunicipal: '733165000172', endereco: 'QUADRA SNQ 107, BLOCO D APTO 607', complemento: null, numero: null, bairro: 'Asa Norte', cidade: 'Brasília', uf: 'DF', cep: '70743040', referencia: null, email: null },
  { nome: 'NILSON CORREA BISPO', nomeFantasia: 'NILSON CORREA BISPO', tipo: 'juridica', cpfCnpj: '59030369000190', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA QNO 13 CONJUNTO G, 41 A', complemento: null, numero: null, bairro: 'Ceilândia Norte (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72255307', referencia: null, email: null },
  { nome: 'MOVE SOLUÇÕES EM ELETROMOBILIDADE LTDA', nomeFantasia: 'MOVE SOLUÇÕES', tipo: 'juridica', cpfCnpj: '29668246000118', inscEstadual: null, inscMunicipal: null, endereco: 'RUA GEN. LIBERATO BITTENCOURT, 1475', complemento: null, numero: null, bairro: 'Estreito', cidade: 'Florianópolis', uf: 'SC', cep: '88070800', referencia: null, email: null },
  { nome: 'FERRO & AÇO UBERLÂNDIA COMERCIAL LTDA', nomeFantasia: 'FERRO E AÇO', tipo: 'juridica', cpfCnpj: '38507364000135', inscEstadual: '702.826.123/0032', inscMunicipal: null, endereco: 'AVENIDA ENGENHEIRO DINIZ N°2060', complemento: null, numero: null, bairro: 'Martins', cidade: 'Uberlândia', uf: 'MG', cep: '38400462', referencia: null, email: null },
  { nome: 'LEO TERRAS EMPREENDIMENTOS LTDA', nomeFantasia: 'LEO TERRAS', tipo: 'juridica', cpfCnpj: '37424400000134', inscEstadual: null, inscMunicipal: null, endereco: 'AV. KALED COSAC 980B', complemento: null, numero: null, bairro: 'Centro', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'DECORA GESSO LTDA', nomeFantasia: 'DECORA GESSO LTDA', tipo: 'juridica', cpfCnpj: '34986991000145', inscEstadual: '20.096.969-2', inscMunicipal: null, endereco: 'AVENIDA KALED COZAC, 407 - A QUADRA C LOTE 407 A', complemento: null, numero: '20', bairro: 'SETOR OESTE NOVO', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: 'DECORA.GESSO.CRISTALINA@GMAIL.COM' },
  { nome: 'COMERCIAL RA ELETRICA HIDRAULICA LTDA-ME', nomeFantasia: 'CASA DO ACABAMENTO', tipo: 'juridica', cpfCnpj: '41896952000112', inscEstadual: null, inscMunicipal: null, endereco: 'AV. BELO HORIZONTE , N.550', complemento: null, numero: null, bairro: 'Osvaldo Rezende', cidade: 'Uberlândia', uf: 'MG', cep: '38400454', referencia: null, email: null },
  { nome: 'EVERLON GELLER', nomeFantasia: 'EVERLON GELLER', tipo: 'fisica', cpfCnpj: '340670193', inscEstadual: null, inscMunicipal: null, endereco: 'RUA A, QUADRA 103, LOTE 20', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'MOLDURIZE SOLUÇÕES CONSTRUTIVAS LTDA', nomeFantasia: 'ISOPORCORT', tipo: 'juridica', cpfCnpj: '65415256000296', inscEstadual: null, inscMunicipal: null, endereco: 'QN 321 - CONJ. F  S/N  - LOTE 07', complemento: null, numero: null, bairro: 'Samambaia Sul (Samambaia)', cidade: 'Brasília', uf: 'DF', cep: '72309206', referencia: null, email: null },
  { nome: 'ISOBRASILIA SOLUCOES TERMICAS', nomeFantasia: 'ISOBRASILIA SOLUCOES TERMICAS', tipo: 'juridica', cpfCnpj: '55932615000148', inscEstadual: '08.315.044/001-78', inscMunicipal: null, endereco: 'Quadra 2 Conjunto a, 18 - BAIRRO FAZENDINHA', complemento: null, numero: '17', bairro: 'Itapoã I', cidade: 'Brasília', uf: 'DF', cep: '71596223', referencia: null, email: null },
  { nome: 'REPLANT PLANTAS PERMANENTES LTDA', nomeFantasia: 'REPLANT PLANTAS PERMANENTES LTDA', tipo: 'juridica', cpfCnpj: '3624061000118', inscEstadual: null, inscMunicipal: null, endereco: 'Setor Habitacional Vicente Pires - Chácara 544 - lojas 48/49/50/51 -', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72001547', referencia: null, email: null },
  { nome: 'ANTONIO CARLOS PEREIRA DA SILVA', nomeFantasia: 'NACIONAL FILTROS', tipo: 'juridica', cpfCnpj: '6945989000192', inscEstadual: null, inscMunicipal: null, endereco: 'ARENA ESPECIAL 20/21 SETOR CENTRAL', complemento: null, numero: null, bairro: 'Gama', cidade: 'Brasília', uf: 'DF', cep: '72405922', referencia: null, email: null },
  { nome: 'R10  COMERCIO ELETRICO LTDA', nomeFantasia: 'R10 COMERCIO ELETRICO', tipo: 'juridica', cpfCnpj: '54702603000164', inscEstadual: '910.66368-23', inscMunicipal: null, endereco: 'RUA PIONEIRO TOMOICHI KAWAMOTO', complemento: null, numero: null, bairro: 'Jardim Nilza', cidade: 'Maringá', uf: 'PR', cep: '87065146', referencia: null, email: null },
  { nome: 'CINEXPAN INDUSTRIA E COMERCIO DE ARGILA EXPANDIDA LTDA', nomeFantasia: 'CINEXPAN INDUSTRIA E COMERCIO DE ARGILA EXPANDIDA LTDA', tipo: 'juridica', cpfCnpj: '4022404000137', inscEstadual: '712098850117', inscMunicipal: null, endereco: 'Estrada do Rocha', complemento: null, numero: '356', bairro: 'Sítio do Mursa', cidade: 'Várzea Paulista', uf: 'SP', cep: '13226300', referencia: null, email: null },
  { nome: 'CALIFE COMERCIO DE CALÇADOS EIRELI', nomeFantasia: 'CALIFE COMERCIO DE CALÇADOS EIRELI', tipo: 'juridica', cpfCnpj: '33837984000119', inscEstadual: null, inscMunicipal: null, endereco: 'QS 1 RUA 210 LOTE 40 AREAL AGUAS CLARAS', complemento: null, numero: null, bairro: 'Taguatinga Sul (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '71950904', referencia: null, email: null },
  { nome: 'NATURAS COMÉRCIO DE PEDRAS LTDA', nomeFantasia: 'NATURAS COMÉRCIO DE PEDRAS LTDA', tipo: 'juridica', cpfCnpj: '11075963000170', inscEstadual: '07.526.031/001-01', inscMunicipal: null, endereco: 'SMPW, QUADRA 06 - CONJ, 01 - PARTE A', complemento: null, numero: null, bairro: 'Park Way', cidade: 'Brasília', uf: 'DF', cep: '71740601', referencia: null, email: null },
  { nome: 'HONOPLANTAS GARDEN CENTER LTDA', nomeFantasia: 'HONOPLANTAS GARDEN CENTER LTDA', tipo: 'juridica', cpfCnpj: '24876052000194', inscEstadual: null, inscMunicipal: null, endereco: 'Colônia Agrícola Riacho Fundo I,', complemento: null, numero: null, bairro: 'Riacho Fundo II', cidade: 'Brasília', uf: 'DF', cep: '71808370', referencia: null, email: null },
  { nome: 'ELETROMAC LTDA', nomeFantasia: 'ELETROMAC', tipo: 'juridica', cpfCnpj: '21770011000120', inscEstadual: null, inscMunicipal: null, endereco: 'AV. VASCONCELOS COSTA N.525', complemento: null, numero: null, bairro: 'Martins', cidade: 'Uberlândia', uf: 'MG', cep: '38400450', referencia: null, email: null },
  { nome: 'ELETRICA CIDADE LTDA', nomeFantasia: 'ELETRICA CIDADE', tipo: 'juridica', cpfCnpj: '1722901000150', inscEstadual: '702.344.337/0021', inscMunicipal: null, endereco: 'AV. VASCONCELOS COSTA ,583', complemento: null, numero: null, bairro: 'Martins', cidade: 'Uberlândia', uf: 'MG', cep: '38400450', referencia: null, email: null },
  { nome: 'G. PLAC DISTRIBUIDOR DRYWALL E GESSO', nomeFantasia: 'GESSOPLAC', tipo: 'juridica', cpfCnpj: '57786466000181', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ESPANHA 885', complemento: null, numero: null, bairro: 'Tibery', cidade: 'Uberlândia', uf: 'MG', cep: '33840504', referencia: null, email: null },
  { nome: 'WANDERLEY DA PUREZA FERREIRA', nomeFantasia: null, tipo: 'juridica', cpfCnpj: '40888784000150', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 3, 90', complemento: null, numero: null, bairro: 'Vila do Boa (São Sebastião)', cidade: 'Brasília', uf: 'DF', cep: '71697317', referencia: null, email: null },
  { nome: 'MARMORARIA ALVORADA LTDA', nomeFantasia: 'MARMORARIA ALVORADA LTDA', tipo: 'juridica', cpfCnpj: '2016327000187', inscEstadual: null, inscMunicipal: null, endereco: 'TRECHO 02, SN, LOTE 995-1005', complemento: null, numero: '1855', bairro: 'Zona Industrial (Guará)', cidade: 'Brasília', uf: 'DF', cep: '71200020', referencia: null, email: null },
  { nome: '24 K TRANSPORTES LTDA', nomeFantasia: '24 K TRANSPORTES LTDA', tipo: 'juridica', cpfCnpj: '51599467000130', inscEstadual: '124601194114', inscMunicipal: null, endereco: 'Rua Astorga', complemento: null, numero: '90', bairro: 'Vila Guilhermina', cidade: 'São Paulo', uf: 'SP', cep: '03542000', referencia: null, email: 'COMERCIAL@24KTRANSPORTES.COM' },
  { nome: 'S3 AÇO INDUSTRIA E COMÉRCIO LTDA', nomeFantasia: 'S3 AÇO', tipo: 'juridica', cpfCnpj: '49001485000127', inscEstadual: '08.186.442/001-07', inscMunicipal: null, endereco: 'QI 8 N .S/N', complemento: null, numero: null, bairro: 'Setor Industrial (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72135080', referencia: null, email: null },
  { nome: 'ZDE SERVIÇOS E HIDROJATEAMENTO', nomeFantasia: 'ZÉ DO ESGOTO', tipo: 'juridica', cpfCnpj: '61485585000171', inscEstadual: null, inscMunicipal: null, endereco: 'Q 10, CONJUNTO 20, Nº 23', complemento: null, numero: null, bairro: 'Setor Habitacional Vicente Pires', cidade: 'Brasília', uf: 'DF', cep: '72002070', referencia: null, email: null },
  { nome: 'LITRO BOMBAS DF LTDA', nomeFantasia: 'LITRO BOMBAS DF LTDA', tipo: 'juridica', cpfCnpj: '60800149000187', inscEstadual: '08.393.928/001-16', inscMunicipal: null, endereco: 'SHA CONJUNTO 4 CHÁCARA 80, I - LOJA 3', complemento: null, numero: '47', bairro: 'Setor Habitacional Arniqueira (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71994450', referencia: null, email: null },
  { nome: 'PILAR CASA E CONSTRUÇÃO', nomeFantasia: 'PILAR CASA & CONSTRUÇÃO', tipo: 'juridica', cpfCnpj: '30705874000105', inscEstadual: null, inscMunicipal: null, endereco: 'QUADRA 46, LOTE 20 LOA 01', complemento: null, numero: null, bairro: 'SETOR NOROESTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'JOSÉ FERREIRA DE SOUZA', nomeFantasia: 'JOSÉ FERREIRA DE SOUZA', tipo: 'juridica', cpfCnpj: '50899452000125', inscEstadual: null, inscMunicipal: null, endereco: 'Rua do Fazendeiro, Nº 594', complemento: null, numero: null, bairro: 'Jardim das Palmeiras', cidade: 'Uberlândia', uf: 'MG', cep: '38412288', referencia: null, email: null },
  { nome: 'MARCIA DIVINA CORREIA SOUZA', nomeFantasia: 'MARCIA DIVINA CORREIA SOUZA', tipo: 'juridica', cpfCnpj: '51731237000183', inscEstadual: null, inscMunicipal: null, endereco: 'Rua do Fazendeiro, Nº 594', complemento: null, numero: null, bairro: 'Jardim das Palmeiras', cidade: 'Uberlândia', uf: 'MG', cep: '38412288', referencia: null, email: null },
  { nome: 'BMB MATERIAL DE CONSTRUÇÃO SA', nomeFantasia: 'Obramax Atacado de Construção', tipo: 'juridica', cpfCnpj: '23476033002151', inscEstadual: null, inscMunicipal: null, endereco: 'Avenida João Leão, 7001 - Custódio Pereira', complemento: null, numero: null, bairro: 'Custódio Pereira', cidade: 'Uberlândia', uf: 'MG', cep: '38405236', referencia: null, email: null },
  { nome: 'JP CONSTRUTORA E REFORMA LTDA', nomeFantasia: 'JP CONSTRUTORA E REFORMA', tipo: 'juridica', cpfCnpj: '6260428000150', inscEstadual: null, inscMunicipal: '848219300106', endereco: 'Q QNA 09, LOTE 33, LOJA 03', complemento: null, numero: null, bairro: 'Taguatinga Norte (Taguatinga)', cidade: 'Brasília', uf: 'DF', cep: '72110090', referencia: null, email: null },
  { nome: 'SILVIA MARIA LEAL GOMES', nomeFantasia: 'SILVIA MARIA LEAL GOMES', tipo: 'fisica', cpfCnpj: '93705697072', inscEstadual: null, inscMunicipal: null, endereco: 'AV. PAU BRASIL', complemento: null, numero: null, bairro: 'Sul (Águas Claras)', cidade: 'Brasília', uf: 'DF', cep: '71916500', referencia: null, email: null },
  { nome: 'RR INDUSTRIA COM. E DIST. DE VIDROS ALUMINIOS E FERRAMENTAS', nomeFantasia: 'SUPREMA VIDROS', tipo: 'juridica', cpfCnpj: '53039024000110', inscEstadual: null, inscMunicipal: null, endereco: 'Q 47 CONJ. A , 3 LOTE 3 - PARQUE DA BARRAGEM', complemento: null, numero: null, bairro: 'Parque da Barragem Setor 01', cidade: 'Águas Lindas de Goiás', uf: 'GO', cep: '72911208', referencia: null, email: null },
  { nome: 'ARTHUR HANSEL F. SANTOS LTDA', nomeFantasia: 'ARTHUR HANSEL F. SANTOS', tipo: 'juridica', cpfCnpj: '55285764000162', inscEstadual: null, inscMunicipal: null, endereco: 'ADE QD 3 CONJ C, LOTE 24,24', complemento: null, numero: null, bairro: 'Área de Desenvolvimento Econômico (Ceilândia)', cidade: 'Brasília', uf: 'DF', cep: '72237330', referencia: null, email: null },
  { nome: 'PERFILADOS UBERLANDIA LTDA', nomeFantasia: 'PERFILADOS UBERLANDIA', tipo: 'juridica', cpfCnpj: '4172629000170', inscEstadual: null, inscMunicipal: null, endereco: 'AV. COMENDADOR ALEXANDRINO GARCIA', complemento: null, numero: null, bairro: 'Marta Helena', cidade: 'Uberlândia', uf: 'MG', cep: '38402228', referencia: null, email: null },
  { nome: 'BAURUFER COMÉRCIO DE FERRO E AÇO LTDA', nomeFantasia: 'BAURUFER AÇO', tipo: 'juridica', cpfCnpj: '30269970000158', inscEstadual: null, inscMunicipal: null, endereco: 'ALAMEDA JOÃO LEAO , 6145', complemento: null, numero: null, bairro: 'Custódio Pereira', cidade: 'Uberlândia', uf: 'MG', cep: '38405236', referencia: null, email: null },
  { nome: 'RITA  DE CASSINA ARAUJO', nomeFantasia: 'RITA DE CASSIA ARAUJO', tipo: 'juridica', cpfCnpj: '46141250000142', inscEstadual: null, inscMunicipal: null, endereco: 'AV. MOÇAMBIQUE ,267 DOM JESUS', complemento: null, numero: null, bairro: 'Centro', cidade: 'Uberlândia', uf: 'MG', cep: '35633272', referencia: null, email: null },
  { nome: 'MANACES GONZAGA DOS SANTOS', nomeFantasia: 'MANACES GONZAGA DOS SANTOS', tipo: 'fisica', cpfCnpj: '8874875487', inscEstadual: null, inscMunicipal: null, endereco: 'INDIANOPOLIS, N° 63', complemento: null, numero: null, bairro: 'Osvaldo Rezende', cidade: 'Uberlândia', uf: 'MG', cep: '38400474', referencia: null, email: null },
  { nome: 'PERFILOR S/A CONSTRUÇÕES INDUSTRIA E COMERCIO', nomeFantasia: 'PERFILOR INDUSTRIA E COMERCIO', tipo: 'juridica', cpfCnpj: '5476154000178', inscEstadual: '420124818115', inscMunicipal: 'LORENA', endereco: 'AV. PEIXOTO DE CASTRO', complemento: null, numero: null, bairro: 'Área Rural de Lorena', cidade: 'Lorena', uf: 'SP', cep: '12606580', referencia: null, email: null },
  { nome: 'SUPER CLIMA AR CONDICIONADO', nomeFantasia: 'SUPER CLIMA AR CONDICIONADO', tipo: 'juridica', cpfCnpj: '19413901000133', inscEstadual: '07.666.717/001-43', inscMunicipal: null, endereco: 'APLM CONJ 3 SN LOTE 01', complemento: null, numero: null, bairro: 'Setor Placa da Mercedes (Núcleo Bandeirante)', cidade: 'Brasília', uf: 'DF', cep: '71732030', referencia: null, email: null },
  { nome: 'COBERPOOL INDÚSTRIA E COMÉRCIO DE COBERTURAS LTDA', nomeFantasia: 'COBERPOOL', tipo: 'juridica', cpfCnpj: '20900653000134', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ANTÔNIO ÂNGELO AMADIO, 1721 - CENTRO EMPRESARIAL CASTELO BRANCO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Boituva', uf: 'SP', cep: '18552112', referencia: null, email: null },
  { nome: 'WALTUNES INSTALAÇÕES ELÉTRICAS LTDA', nomeFantasia: 'WALTUNES', tipo: 'juridica', cpfCnpj: '15338911000109', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA ANTÔNIO ÂNGELO AMADIO, 1721 - CENTRO EMPRESARIAL CASTELO BRANCO', complemento: null, numero: null, bairro: 'Centro', cidade: 'Boituva', uf: 'SP', cep: '18552112', referencia: null, email: null },
  { nome: 'ADRIEL GUARDIANO DOS SANTOS', nomeFantasia: 'ADRIEL GUARDIANO DOS SANTOS', tipo: 'juridica', cpfCnpj: '65878922000141', inscEstadual: null, inscMunicipal: null, endereco: 'RUA SUCUPIRA, 15', complemento: null, numero: null, bairro: 'Belvedere', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'SANDRO LÚCIO SILVA REIS', nomeFantasia: 'SANDRO LÚCIO SILVA REIS', tipo: 'juridica', cpfCnpj: '66928484000141', inscEstadual: null, inscMunicipal: null, endereco: '11 A, RUA 100, QUADRA 59, LOTE 15, S/N', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'CESAR EUGÊNIO SOARES DOS SANTOS', nomeFantasia: 'CESAR EUGÊNIO SOARES DOS SANTOS', tipo: 'juridica', cpfCnpj: '37412656000121', inscEstadual: null, inscMunicipal: null, endereco: 'RUA 36, S/N, BAIRRO CRISTAL', complemento: null, numero: null, bairro: 'SETOR NORTE', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null },
  { nome: 'JARDIEL SOUZA SOARES', nomeFantasia: 'JARDIEL SOUZA SOARES', tipo: 'fisica', cpfCnpj: '10866385495', inscEstadual: null, inscMunicipal: null, endereco: 'AVENIDA 01, QD 073, LT 003', complemento: null, numero: null, bairro: 'SETOR SUL', cidade: 'Cristalina', uf: 'GO', cep: '73850000', referencia: null, email: null }
];

export async function seedFornecedores() {
  const db = await getDb();
  if (!db) return { inseridos: 0 };
  const existing: any = await db.execute(sql`SELECT COUNT(*) AS cnt FROM fornecedores`);
  const cnt = Number((existing[0] ?? existing)[0]?.cnt ?? 0);
  if (cnt > 0) return { inseridos: 0 };
  let inseridos = 0;
  for (const f of FORNECEDORES_SEED) {
    try {
      await db.execute(sql`INSERT INTO fornecedores
        (nome, nomeFantasia, tipo, cpfCnpj, inscEstadual, inscMunicipal, endereco, complemento, numero, bairro, cidade, uf, cep, referencia, email)
        VALUES (${f.nome}, ${f.nomeFantasia}, ${f.tipo}, ${f.cpfCnpj}, ${f.inscEstadual}, ${f.inscMunicipal},
          ${f.endereco}, ${f.complemento}, ${f.numero}, ${f.bairro}, ${f.cidade}, ${f.uf}, ${f.cep}, ${f.referencia}, ${f.email})`);
      inseridos++;
    } catch { /* ignore */ }
  }
  return { inseridos };
}
