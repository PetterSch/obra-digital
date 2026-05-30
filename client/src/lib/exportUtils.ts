import * as XLSX from "xlsx";

export interface ConsolidacaoData {
  totalDiarios: number;
  totalAtividades: number;
  totalOcorrencias: number;
  totalFotos: number;
  principaisAtividades: string[];
  principaisOcorrencias: string[];
  climaPredominate: string | null;
  maoDeObraTotal: number;
  equipamentosUtilizados: string[];
  materiaisMovimentados: Array<{ materialId: number; quantidade: number; movimentacoes: number }>;
  diarios?: Array<{
    id: number;
    data: Date | string;
    clima?: string | null;
    temperatura?: string | number | null;
    umidade?: number | null;
    horarioInicio?: string | null;
    horarioFim?: string | null;
    observacoesGerais?: string | null;
    responsavel?: string | null;
  }>;
  atividades?: Array<{
    diarioId: number;
    descricao: string;
    local?: string | null;
    status?: string | null;
    percentualConcluido?: number | null;
    prioridade?: string | null;
  }>;
  ocorrencias?: Array<{
    diarioId: number;
    descricao: string;
    tipo?: string | null;
    criticidade?: string | null;
    responsavel?: string | null;
    prazoSolucao?: Date | string | null;
  }>;
}

const CLIMA_LABELS: Record<string, string> = {
  ensolarado: "Ensolarado",
  nublado: "Nublado",
  chuvoso: "Chuvoso",
  tempestade: "Tempestade",
  ventania: "Ventania",
};

const STATUS_LABELS: Record<string, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const CRITICIDADE_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("pt-BR");
  } catch {
    return String(date);
  }
}

function applyHeaderStyle(ws: XLSX.WorkSheet, range: string) {
  // Basic column widths
  if (!ws["!cols"]) ws["!cols"] = [];
}

export function exportResumoToExcel(
  obraNome: string,
  periodo: string,
  dataInicio: string,
  dataFim: string,
  resumo: string,
  consolidacao: ConsolidacaoData
) {
  const workbook = XLSX.utils.book_new();
  const now = new Date().toLocaleString("pt-BR");

  // ── Sheet 1: Resumo executivo ─────────────────────────────────────
  const resumoSheet = XLSX.utils.aoa_to_sheet([
    [`RESUMO EXECUTIVO DE OBRA — ${obraNome.toUpperCase()}`],
    [],
    ["Obra:", obraNome],
    ["Período:", `${dataInicio} a ${dataFim}`],
    ["Tipo de período:", periodo],
    ["Gerado em:", now],
    [],
    ["RESUMO NARRATIVO"],
    [resumo || "Resumo não gerado."],
  ]);
  resumoSheet["!cols"] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(workbook, resumoSheet, "Resumo");

  // ── Sheet 2: Estatísticas ─────────────────────────────────────────
  const statsSheet = XLSX.utils.aoa_to_sheet([
    ["ESTATÍSTICAS DO PERÍODO"],
    [],
    ["Indicador", "Valor"],
    ["Total de diários registrados", consolidacao.totalDiarios],
    ["Total de atividades", consolidacao.totalAtividades],
    ["Total de ocorrências", consolidacao.totalOcorrencias],
    ["Total de fotos", consolidacao.totalFotos],
    ["Mão de obra (registros)", consolidacao.maoDeObraTotal],
    ["Clima predominante", CLIMA_LABELS[consolidacao.climaPredominate ?? ""] || consolidacao.climaPredominate || "N/A"],
    ["Equipamentos únicos utilizados", consolidacao.equipamentosUtilizados.length],
    ["Materiais movimentados", consolidacao.materiaisMovimentados.length],
  ]);
  statsSheet["!cols"] = [{ wch: 36 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, statsSheet, "Estatísticas");

  // ── Sheet 3: Diários detalhados ───────────────────────────────────
  if (consolidacao.diarios && consolidacao.diarios.length > 0) {
    const rows: unknown[][] = [
      ["DIÁRIOS DO PERÍODO"],
      [],
      ["#", "Data", "Clima", "Temp (°C)", "Umidade (%)", "Horário Início", "Horário Fim", "Observações"],
      ...consolidacao.diarios.map((d, i) => [
        i + 1,
        formatDate(d.data),
        CLIMA_LABELS[d.clima ?? ""] || d.clima || "—",
        d.temperatura ? Number(d.temperatura) : "—",
        d.umidade ?? "—",
        d.horarioInicio || "—",
        d.horarioFim || "—",
        d.observacoesGerais || "",
      ]),
    ];
    const diariosSheet = XLSX.utils.aoa_to_sheet(rows);
    diariosSheet["!cols"] = [
      { wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(workbook, diariosSheet, "Diários");
  }

  // ── Sheet 4: Atividades ───────────────────────────────────────────
  if (consolidacao.atividades && consolidacao.atividades.length > 0) {
    const diarioMap = new Map((consolidacao.diarios ?? []).map(d => [d.id, formatDate(d.data)]));
    const rows: unknown[][] = [
      ["ATIVIDADES DO PERÍODO"],
      [],
      ["Data", "Descrição", "Local", "Status", "% Concluído", "Prioridade"],
      ...consolidacao.atividades.map(a => [
        diarioMap.get(a.diarioId) || "—",
        a.descricao,
        a.local || "—",
        STATUS_LABELS[a.status ?? ""] || a.status || "—",
        a.percentualConcluido != null ? `${a.percentualConcluido}%` : "—",
        a.prioridade || "—",
      ]),
    ];
    const ativSheet = XLSX.utils.aoa_to_sheet(rows);
    ativSheet["!cols"] = [
      { wch: 14 }, { wch: 45 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, ativSheet, "Atividades");
  } else if (consolidacao.principaisAtividades.length > 0) {
    const ativSheet = XLSX.utils.aoa_to_sheet([
      ["PRINCIPAIS ATIVIDADES CONCLUÍDAS"],
      [],
      ["Atividade"],
      ...consolidacao.principaisAtividades.map((a) => [a]),
    ]);
    ativSheet["!cols"] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, ativSheet, "Atividades");
  }

  // ── Sheet 5: Ocorrências ──────────────────────────────────────────
  if (consolidacao.ocorrencias && consolidacao.ocorrencias.length > 0) {
    const diarioMap = new Map((consolidacao.diarios ?? []).map(d => [d.id, formatDate(d.data)]));
    const rows: unknown[][] = [
      ["OCORRÊNCIAS DO PERÍODO"],
      [],
      ["Data", "Tipo", "Descrição", "Criticidade", "Responsável", "Prazo para solução"],
      ...consolidacao.ocorrencias.map(o => [
        diarioMap.get(o.diarioId) || "—",
        o.tipo || "—",
        o.descricao,
        CRITICIDADE_LABELS[o.criticidade ?? ""] || o.criticidade || "—",
        o.responsavel || "—",
        formatDate(o.prazoSolucao),
      ]),
    ];
    const ocorSheet = XLSX.utils.aoa_to_sheet(rows);
    ocorSheet["!cols"] = [
      { wch: 14 }, { wch: 20 }, { wch: 45 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(workbook, ocorSheet, "Ocorrências");
  } else if (consolidacao.principaisOcorrencias.length > 0) {
    const ocorSheet = XLSX.utils.aoa_to_sheet([
      ["OCORRÊNCIAS DE ALTA CRITICIDADE"],
      [],
      ["Ocorrência"],
      ...consolidacao.principaisOcorrencias.map((o) => [o]),
    ]);
    ocorSheet["!cols"] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, ocorSheet, "Ocorrências");
  }

  // ── Sheet 6: Equipamentos ─────────────────────────────────────────
  if (consolidacao.equipamentosUtilizados.length > 0) {
    const equipSheet = XLSX.utils.aoa_to_sheet([
      ["EQUIPAMENTOS UTILIZADOS NO PERÍODO"],
      [],
      ["Equipamento"],
      ...consolidacao.equipamentosUtilizados.map((e) => [e]),
    ]);
    equipSheet["!cols"] = [{ wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, equipSheet, "Equipamentos");
  }

  // ── Sheet 7: Materiais ────────────────────────────────────────────
  if (consolidacao.materiaisMovimentados.length > 0) {
    const matSheet = XLSX.utils.aoa_to_sheet([
      ["MATERIAIS MOVIMENTADOS NO PERÍODO"],
      [],
      ["ID do Material", "Quantidade Total", "Nº de Movimentações"],
      ...consolidacao.materiaisMovimentados.map((m) => [
        m.materialId,
        m.quantidade,
        m.movimentacoes,
      ]),
    ]);
    matSheet["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, matSheet, "Materiais");
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `resumo-${obraNome.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportDiariosToExcel(
  obraNome: string,
  diarios: Array<{
    id: number;
    data: string;
    clima?: string;
    temperatura?: number;
    umidade?: number;
    horarioInicio?: string;
    horarioFim?: string;
    observacoesGerais?: string;
    atividades?: Array<{ descricao: string; status?: string; percentualConcluido?: number }>;
    maoDeObra?: Array<{ funcao: string; quantidade: number; horasTrabalhadas?: number }>;
    ocorrencias?: Array<{ descricao: string; criticidade?: string }>;
  }>
) {
  const workbook = XLSX.utils.book_new();
  const now = new Date().toLocaleString("pt-BR");

  // ── Sheet 1: Lista de diários ──────────────────────────────────────
  const diariosSheet = XLSX.utils.aoa_to_sheet([
    [`DIÁRIOS DE OBRA — ${obraNome.toUpperCase()}`],
    ["Exportado em:", now],
    [],
    ["#", "Data", "Clima", "Temp (°C)", "Umidade (%)", "Início", "Fim", "Atividades", "Mão de Obra", "Observações"],
    ...diarios.map((d, i) => [
      i + 1,
      new Date(d.data).toLocaleDateString("pt-BR"),
      CLIMA_LABELS[d.clima ?? ""] || d.clima || "N/A",
      d.temperatura ?? "—",
      d.umidade ?? "—",
      d.horarioInicio || "—",
      d.horarioFim || "—",
      d.atividades?.length ?? "—",
      d.maoDeObra?.length ?? "—",
      d.observacoesGerais || "",
    ]),
  ]);
  diariosSheet["!cols"] = [
    { wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 13 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(workbook, diariosSheet, "Diários");

  // ── Sheet 2: Atividades (de todos os diários) ─────────────────────
  const todasAtividades = diarios.flatMap(d =>
    (d.atividades ?? []).map(a => ({
      data: new Date(d.data).toLocaleDateString("pt-BR"),
      ...a,
    }))
  );
  if (todasAtividades.length > 0) {
    const ativSheet = XLSX.utils.aoa_to_sheet([
      ["ATIVIDADES REGISTRADAS"],
      [],
      ["Data", "Descrição", "Status", "% Concluído"],
      ...todasAtividades.map(a => [
        a.data,
        a.descricao,
        STATUS_LABELS[a.status ?? ""] || a.status || "—",
        a.percentualConcluido != null ? `${a.percentualConcluido}%` : "—",
      ]),
    ]);
    ativSheet["!cols"] = [{ wch: 14 }, { wch: 50 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, ativSheet, "Atividades");
  }

  // ── Sheet 3: Mão de obra ──────────────────────────────────────────
  const todaMaoDeObra = diarios.flatMap(d =>
    (d.maoDeObra ?? []).map(m => ({
      data: new Date(d.data).toLocaleDateString("pt-BR"),
      ...m,
    }))
  );
  if (todaMaoDeObra.length > 0) {
    const mdoSheet = XLSX.utils.aoa_to_sheet([
      ["MÃO DE OBRA REGISTRADA"],
      [],
      ["Data", "Função", "Quantidade", "Horas trabalhadas"],
      ...todaMaoDeObra.map(m => [
        m.data,
        m.funcao,
        m.quantidade,
        m.horasTrabalhadas ?? "—",
      ]),
    ]);
    mdoSheet["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, mdoSheet, "Mão de Obra");
  }

  // ── Sheet 4: Ocorrências ──────────────────────────────────────────
  const todasOcorrencias = diarios.flatMap(d =>
    (d.ocorrencias ?? []).map(o => ({
      data: new Date(d.data).toLocaleDateString("pt-BR"),
      ...o,
    }))
  );
  if (todasOcorrencias.length > 0) {
    const ocorSheet = XLSX.utils.aoa_to_sheet([
      ["OCORRÊNCIAS REGISTRADAS"],
      [],
      ["Data", "Descrição", "Criticidade"],
      ...todasOcorrencias.map(o => [
        o.data,
        o.descricao,
        CRITICIDADE_LABELS[o.criticidade ?? ""] || o.criticidade || "—",
      ]),
    ]);
    ocorSheet["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, ocorSheet, "Ocorrências");
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `diarios-${obraNome.replace(/\s+/g, "-").toLowerCase()}-${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// ─── Exportação de Orçamento para Excel ────────────────────────────────────

export interface OrcamentoExcelData {
  obraNome: string;
  obraCodigo?: string;
  cliente?: string;
  nome: string;
  itens: Array<{ categoria?: string; descricao: string; unidade?: string; quantidade: number; precoUnitario: number }>;
  totais: {
    custoDirecto: number; bdi: number; valorBdi: number; valorComBdi: number;
    adm: number; valorAdministracao: number; valorTotal: number;
    area: number; custoM2SemAdm: number; custoM2ComAdm: number;
  };
}

export function exportOrcamentoToExcel(data: OrcamentoExcelData) {
  const wb = XLSX.utils.book_new();
  const moeda = (n: number) => Number(n.toFixed(2));

  // Cabeçalho + itens
  const rows: any[][] = [
    ["ORÇAMENTO DE OBRA"],
    [],
    ["Obra:", data.obraNome, "", "Código:", data.obraCodigo ?? ""],
    ["Cliente:", data.cliente ?? "", "", "Orçamento:", data.nome],
    [],
    ["Categoria", "Descrição", "Un.", "Quantidade", "Preço Unit. (R$)", "Total (R$)"],
  ];

  let catAtual = "";
  data.itens.forEach(it => {
    const total = it.quantidade * it.precoUnitario;
    rows.push([
      it.categoria !== catAtual ? (catAtual = it.categoria || "", it.categoria || "") : "",
      it.descricao, it.unidade ?? "", moeda(it.quantidade), moeda(it.precoUnitario), moeda(total),
    ]);
  });

  rows.push([]);
  rows.push(["", "", "", "", "Custo direto:", moeda(data.totais.custoDirecto)]);
  rows.push(["", "", "", "", `BDI (${data.totais.bdi}%):`, moeda(data.totais.valorBdi)]);
  rows.push(["", "", "", "", "Subtotal com BDI:", moeda(data.totais.valorComBdi)]);
  rows.push(["", "", "", "", `Administração (${data.totais.adm}%):`, moeda(data.totais.valorAdministracao)]);
  rows.push(["", "", "", "", "VALOR TOTAL DA OBRA:", moeda(data.totais.valorTotal)]);
  rows.push([]);
  rows.push(["", "", "", "", "Área total (m²):", moeda(data.totais.area)]);
  rows.push(["", "", "", "", "Custo por m² (sem adm.):", moeda(data.totais.custoM2SemAdm)]);
  rows.push(["", "", "", "", "Custo por m² (com adm.):", moeda(data.totais.custoM2ComAdm)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "Orçamento");

  const nomeArq = `Orcamento_${data.obraNome.replace(/[^a-z0-9]/gi, "_")}_${data.nome.replace(/[^a-z0-9]/gi, "_")}.xlsx`;
  XLSX.writeFile(wb, nomeArq);
}
