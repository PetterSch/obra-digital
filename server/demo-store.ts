/**
 * demo-store.ts — Store em memória para rodar sem banco de dados.
 * Ativado automaticamente quando DATABASE_URL não está configurado.
 * Todos os dados são perdidos ao reiniciar o servidor.
 */

let nextId = 100;
const id = () => nextId++;

// ─── Tabelas em memória ───────────────────────────────────────────────────

export const store = {
  obras:                [] as any[],
  diarios:              [] as any[],
  atividades:           [] as any[],
  maoDeObra:            [] as any[],
  equipamentos:         [] as any[],
  materiais:            [] as any[],
  movimentacoes:        [] as any[],
  ocorrencias:          [] as any[],
  equipes:              [] as any[],
  colaboradores:        [] as any[],
  presenca:             [] as any[],
  midia:                [] as any[],
  pendencias:           [] as any[],
  relatorios:           [] as any[],
  acessoCliente:        [] as any[],
  acessoObra:           [] as any[],
  sugestoesLLM:         [] as any[],
};

const now = () => new Date();

// ─── Helpers ──────────────────────────────────────────────────────────────

function findById(table: any[], id: number) {
  return table.find(r => r.id === id) ?? null;
}

function removeById(table: any[], id: number) {
  const idx = table.findIndex(r => r.id === id);
  if (idx !== -1) table.splice(idx, 1);
}

function patch(table: any[], id: number, data: any) {
  const idx = table.findIndex(r => r.id === id);
  if (idx !== -1) Object.assign(table[idx], data);
  return table[idx] ?? null;
}

// ─── Obras ────────────────────────────────────────────────────────────────

export function demo_getObrasByUserId(userId: number) {
  return store.obras.filter(o => o.criadoPor === userId);
}

export function demo_getObraById(id: number) {
  return findById(store.obras, id);
}

export function demo_createObra(data: any) {
  const obra = { id: id(), ...data, createdAt: now() };
  store.obras.push(obra);
  return obra;
}

export function demo_updateObra(obraId: number, data: any) {
  return patch(store.obras, obraId, data);
}

export function demo_deleteObra(obraId: number) {
  removeById(store.obras, obraId);
  store.diarios.filter(d => d.obraId === obraId).forEach(d => removeById(store.diarios, d.id));
}

// ─── Diários ──────────────────────────────────────────────────────────────

export function demo_getDiariosByObraId(obraId: number) {
  return store.diarios.filter(d => d.obraId === obraId).sort((a, b) =>
    new Date(b.data).getTime() - new Date(a.data).getTime()
  );
}

export function demo_getDiarioById(diarioId: number) {
  return findById(store.diarios, diarioId);
}

export function demo_createDiario(data: any) {
  const diario = { id: id(), ...data, createdAt: now() };
  store.diarios.push(diario);
  return diario;
}

export function demo_updateDiario(diarioId: number, data: any) {
  return patch(store.diarios, diarioId, data);
}

export function demo_deleteDiario(diarioId: number) {
  removeById(store.diarios, diarioId);
  store.atividades.filter(a => a.diarioId === diarioId).forEach(a => removeById(store.atividades, a.id));
  store.ocorrencias.filter(o => o.diarioId === diarioId).forEach(o => removeById(store.ocorrencias, o.id));
  store.equipamentos.filter(e => e.diarioId === diarioId).forEach(e => removeById(store.equipamentos, e.id));
}

// ─── Atividades ───────────────────────────────────────────────────────────

export function demo_getAtividadesByDiarioId(diarioId: number) {
  return store.atividades.filter(a => a.diarioId === diarioId);
}

export function demo_createAtividade(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.atividades.push(row);
  return row;
}

// ─── Mão de Obra ──────────────────────────────────────────────────────────

export function demo_getMaoDeObraByDiarioId(diarioId: number) {
  return store.maoDeObra.filter(m => m.diarioId === diarioId);
}

export function demo_createMaoDeObra(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.maoDeObra.push(row);
  return row;
}

// ─── Equipamentos ─────────────────────────────────────────────────────────

export function demo_getEquipamentosByDiarioId(diarioId: number) {
  return store.equipamentos.filter(e => e.diarioId === diarioId);
}

export function demo_createEquipamento(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.equipamentos.push(row);
  return row;
}

// ─── Materiais ────────────────────────────────────────────────────────────

export function demo_getMaterialsByObraId(obraId: number) {
  return store.materiais.filter(m => m.obraId === obraId);
}

export function demo_createMaterial(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.materiais.push(row);
  return row;
}

export function demo_updateMaterial(materialId: number, data: any) {
  return patch(store.materiais, materialId, data);
}

export function demo_getMovimentacoesByMaterialId(materialId: number) {
  return store.movimentacoes.filter(m => m.materialId === materialId);
}

export function demo_createMovimentacao(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.movimentacoes.push(row);
  return row;
}

// ─── Ocorrências ──────────────────────────────────────────────────────────

export function demo_getOcorrenciasByDiarioId(diarioId: number) {
  return store.ocorrencias.filter(o => o.diarioId === diarioId);
}

export function demo_createOcorrencia(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.ocorrencias.push(row);
  return row;
}

export function demo_updateOcorrencia(ocorrenciaId: number, data: any) {
  return patch(store.ocorrencias, ocorrenciaId, data);
}

// ─── Equipes ──────────────────────────────────────────────────────────────

export function demo_getEquipes() {
  return store.equipes;
}

export function demo_getEquipeById(id: number) {
  return findById(store.equipes, id);
}

export function demo_createEquipe(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.equipes.push(row);
  return row;
}

export function demo_updateEquipe(equipeId: number, data: any) {
  return patch(store.equipes, equipeId, data);
}

export function demo_deleteEquipe(equipeId: number) {
  removeById(store.equipes, equipeId);
}

// ─── Colaboradores ────────────────────────────────────────────────────────

export function demo_getColaboradoresByEquipeId(equipeId: number) {
  return store.colaboradores.filter(c => c.equipeId === equipeId);
}

export function demo_createColaborador(data: any) {
  const row = { id: id(), ...data, ativo: data.ativo ?? true, createdAt: now() };
  store.colaboradores.push(row);
  return row;
}

export function demo_updateColaborador(colaboradorId: number, data: any) {
  return patch(store.colaboradores, colaboradorId, data);
}

export function demo_deleteColaborador(colaboradorId: number) {
  removeById(store.colaboradores, colaboradorId);
}

// ─── Presença ─────────────────────────────────────────────────────────────

export function demo_getPresencaByDiarioId(diarioId: number) {
  return store.presenca.filter(p => p.diarioId === diarioId);
}

export function demo_createPresenca(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.presenca.push(row);
  return row;
}

// ─── Mídia ────────────────────────────────────────────────────────────────

export function demo_getMidiaByObraId(obraId: number) {
  const diarioIds = store.diarios.filter(d => d.obraId === obraId).map(d => d.id);
  return store.midia.filter(m => diarioIds.includes(m.diarioId));
}

export function demo_getMidiaByDiarioId(diarioId: number) {
  return store.midia.filter(m => m.diarioId === diarioId);
}

export function demo_createMidia(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.midia.push(row);
  return row;
}

// ─── Pendências ───────────────────────────────────────────────────────────

export function demo_getPendenciasByObraId(obraId: number) {
  return store.pendencias.filter(p => p.obraId === obraId);
}

export function demo_createPendencia(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.pendencias.push(row);
  return row;
}

export function demo_updatePendencia(pendenciaId: number, data: any) {
  return patch(store.pendencias, pendenciaId, data);
}

// ─── Relatórios ───────────────────────────────────────────────────────────

export function demo_getRelatoriosByObraId(obraId: number) {
  return store.relatorios.filter(r => r.obraId === obraId);
}

export function demo_createRelatorio(data: any) {
  const row = { id: id(), ...data, geradoEm: now() };
  store.relatorios.push(row);
  return row;
}

// ─── Acesso Cliente ───────────────────────────────────────────────────────

export function demo_getAcessoClienteByToken(token: string) {
  return store.acessoCliente.find(a => a.tokenAcesso === token) ?? null;
}

export function demo_createAcessoCliente(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.acessoCliente.push(row);
  return row;
}

// ─── Acesso Obra ──────────────────────────────────────────────────────────

export function demo_getUserAccessToObra(usuarioId: number, obraId: number) {
  return store.acessoObra.find(a => a.usuarioId === usuarioId && a.obraId === obraId) ?? null;
}

export function demo_getObraAccessList(obraId: number) {
  return store.acessoObra.filter(a => a.obraId === obraId);
}

export function demo_getUserObras(usuarioId: number) {
  return store.acessoObra.filter(a => a.usuarioId === usuarioId);
}

export function demo_createAcessoObra(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.acessoObra.push(row);
  return row;
}

export function demo_updateAcessoObra(acessoId: number, data: any) {
  return patch(store.acessoObra, acessoId, data);
}

export function demo_deleteAcessoObra(acessoId: number) {
  removeById(store.acessoObra, acessoId);
}

// ─── Sugestões LLM ────────────────────────────────────────────────────────

export function demo_getSugestoesLLMByDiarioId(diarioId: number) {
  return store.sugestoesLLM.filter(s => s.diarioId === diarioId);
}

export function demo_createSugestaoLLM(data: any) {
  const row = { id: id(), ...data, createdAt: now() };
  store.sugestoesLLM.push(row);
  return row;
}

export function demo_updateSugestaoLLM(sugestaoId: number, data: any) {
  return patch(store.sugestoesLLM, sugestaoId, data);
}

export function demo_getSugestoesLLM(obraId?: number, aprovada?: boolean) {
  return store.sugestoesLLM.filter(s => {
    if (obraId !== undefined) {
      const diario = findById(store.diarios, s.diarioId);
      if (!diario || diario.obraId !== obraId) return false;
    }
    if (aprovada !== undefined && s.aceita !== aprovada) return false;
    return true;
  });
}

export function demo_getSugestaoLLMById(id: number) {
  return findById(store.sugestoesLLM, id);
}

export function demo_deleteSugestaoLLM(id: number) {
  removeById(store.sugestoesLLM, id);
}

// ─── Consolidação de período (para relatórios) ────────────────────────────

export function demo_getConsolidacaoPeriodo(obraId: number, dataInicio: Date, dataFim: Date) {
  const diariosObra = store.diarios.filter(d => {
    const data = new Date(d.data);
    return d.obraId === obraId && data >= dataInicio && data <= dataFim;
  });

  const diarioIds = diariosObra.map(d => d.id);
  const atividadesTotal = store.atividades.filter(a => diarioIds.includes(a.diarioId));
  const ocorrenciasTotal = store.ocorrencias.filter(o => diarioIds.includes(o.diarioId));
  const midiaTotal = store.midia.filter(m => diarioIds.includes(m.diarioId));
  const maoTotal = store.maoDeObra.filter(m => diarioIds.includes(m.diarioId));

  const climaCounts: Record<string, number> = {};
  diariosObra.forEach(d => {
    if (d.clima) climaCounts[d.clima] = (climaCounts[d.clima] ?? 0) + 1;
  });
  const climaPredominate = Object.entries(climaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalDiarios: diariosObra.length,
    totalAtividades: atividadesTotal.length,
    totalOcorrencias: ocorrenciasTotal.length,
    totalFotos: midiaTotal.length,
    maoDeObraTotal: maoTotal.reduce((s, m) => s + (m.quantidade ?? 1), 0),
    climaPredominate,
    climaCounts,
    principaisAtividades: atividadesTotal.slice(0, 5).map(a => a.descricao),
    principaisOcorrencias: ocorrenciasTotal
      .filter(o => o.criticidade === 'alta' || o.criticidade === 'critica')
      .slice(0, 5)
      .map(o => o.descricao),
  };
}
