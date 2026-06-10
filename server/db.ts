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
    SELECT p.id, p.numero, p.observacao, p.criadoEm,
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

export async function createProtocolo(data: { obraId: number; numero?: string; observacao?: string; notas: ProtocoloNotaInput[] }) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const res: any = await db.execute(sql`INSERT INTO protocolos (obraId, numero, observacao) VALUES (${data.obraId}, ${data.numero ?? null}, ${data.observacao ?? null})`);
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
    SELECT p.id, p.numero, p.solicitante, p.observacao, p.status, p.criadoEm,
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

export async function createPedido(data: { obraId: number; numero?: string; solicitante?: string; observacao?: string; status?: string; itens: PedidoItemInput[] }) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const res: any = await db.execute(sql`INSERT INTO pedidos_compra (obraId, numero, solicitante, observacao, status)
    VALUES (${data.obraId}, ${data.numero ?? null}, ${data.solicitante ?? null}, ${data.observacao ?? null}, ${data.status ?? "aberto"})`);
  const id = (res[0]?.insertId ?? res.insertId) as number;
  await inserirPedidoItens(id, data.itens);
  return { id };
}

export async function updatePedido(id: number, data: { numero?: string; solicitante?: string; observacao?: string; status?: string; itens: PedidoItemInput[] }) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`UPDATE pedidos_compra SET numero = ${data.numero ?? null}, solicitante = ${data.solicitante ?? null}, observacao = ${data.observacao ?? null}, status = ${data.status ?? null} WHERE id = ${id}`);
  await db.execute(sql`DELETE FROM pedido_itens WHERE pedidoId = ${id}`);
  await inserirPedidoItens(id, data.itens);
}

export async function deletePedido(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.execute(sql`DELETE FROM pedido_itens WHERE pedidoId = ${id}`);
  await db.execute(sql`DELETE FROM pedidos_compra WHERE id = ${id}`);
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
