/**
 * Gerador de planejamento de obra.
 * Monta as 10 seções a partir de um orçamento (ou em branco).
 */

// Mapeia cada categoria de orçamento para uma fase macro do cronograma
const FASE_MACRO: Record<string, string> = {
  "Projetos e Serviços Iniciais": "Mobilização",
  "Ensaios e Controle Tecnológico": "Comissionamento",
  "Serviços Preliminares": "Mobilização",
  "Demolição e Remoção": "Mobilização",
  "Recuperação e Tratamento": "Mobilização",
  "Terraplenagem": "Fundações",
  "Fundação": "Fundações",
  "Estrutura": "Estrutura",
  "Alvenaria e Vedação": "Vedações",
  "Cobertura": "Vedações",
  "Impermeabilização": "Vedações",
  "Revestimentos de Parede": "Revestimentos",
  "Revestimentos de Piso": "Revestimentos",
  "Forros": "Revestimentos",
  "Pintura": "Acabamentos",
  "Esquadrias de Madeira": "Acabamentos",
  "Esquadrias de Alumínio": "Acabamentos",
  "Esquadrias de PVC": "Acabamentos",
  "Serralheria": "Acabamentos",
  "Vidros": "Acabamentos",
  "Gesso e Decoração": "Acabamentos",
  "Acabamentos Especiais": "Acabamentos",
  "Fachada": "Acabamentos",
  "Toldos e Coberturas Leves": "Acabamentos",
  "Instalações Elétricas": "Instalações",
  "Instalações Hidrossanitárias": "Instalações",
  "Instalações de Gás": "Instalações",
  "Climatização": "Instalações",
  "Aquecimento": "Instalações",
  "Pressurização e Incêndio": "Instalações",
  "Louças e Metais": "Acabamentos",
  "Bancadas e Marcenaria": "Acabamentos",
  "Persianas e Cortinas": "Acabamentos",
  "Piscina": "Acabamentos",
  "Sauna": "Acabamentos",
  "Área Gourmet": "Acabamentos",
  "Paisagismo": "Acabamentos",
  "Pavimentação": "Acabamentos",
  "Automação e Segurança": "Instalações",
  "Energia Solar": "Instalações",
  "Elevador": "Instalações",
  "Acessibilidade": "Acabamentos",
  "Drenagem": "Fundações",
  "Custos Indiretos": "Mobilização",
  "Serviços Finais": "Comissionamento",
};

const ORDEM_FASES = [
  "Mobilização", "Fundações", "Estrutura", "Vedações",
  "Instalações", "Revestimentos", "Acabamentos", "Comissionamento", "Desmobilização",
];

function addDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() + dias);
  return d;
}
function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

export interface PlanejamentoDados {
  origem: "orcamento" | "branco";
  prazoTotalDias: number;
  eap: Array<{ codigo: string; nivel: number; descricao: string; responsavel: string }>;
  cronograma: {
    atividades: Array<{ id: string; descricao: string; fase: string; predecessoras: string; duracaoDias: number; inicio: string; fim: string; critico: boolean; folgaDias: number }>;
    marcos: Array<{ descricao: string; data: string }>;
  };
  recursos: {
    maoDeObra: Array<{ funcao: string; quantidade: number; regime: string; turnos: string }>;
    equipamentos: Array<{ nome: string; metodo: string; periodo: string }>;
    curvaS: Array<{ mes: string; percentualMes: number; percentualAcumulado: number; valorAcumulado: number }>;
  };
  suprimentos: string;
  qualidade: string;
  ssmt: string;
  ambiental: string;
  canteiro: string;
  controle: string;
  riscos: string;
  resumoExecutivo: string;
}

// Conteúdos técnicos padrão (editáveis no app)
const TEXTO_SUPRIMENTOS = `LISTA DE MATERIAIS CRÍTICOS (lead time estimado):
- Aço CA-50/CA-60: 15 dias
- Concreto usinado: 2 dias (agendamento prévio)
- Esquadrias de alumínio: 30-45 dias
- Elevador: 60-90 dias
- Telhas/estrutura metálica: 20-30 dias
- Louças e metais: 15 dias

ESTRATÉGIA DE COMPRAS:
- Materiais com lead time alto: compra antecipada (esquadrias, elevador, estrutura metálica)
- Materiais de uso contínuo: just-in-time (cimento, areia, brita)
- Estratégia mista conforme cronograma físico-financeiro

PLANO DE COTAÇÕES E FORNECEDORES:
- Mínimo de 3 cotações por item relevante
- Homologação de fornecedores (qualidade, prazo, idoneidade)

LOGÍSTICA E ESTOCAGEM:
- Definir janelas de entrega conforme avanço da obra
- Área de estoque coberta para cimento, gesso e materiais sensíveis
- Controle de recebimento com inspeção (conferência de nota, quantidade e qualidade)`;

const TEXTO_QUALIDADE = `PROCEDIMENTOS DE EXECUÇÃO DE SERVIÇO (PES) por etapa:
- Fundação, Estrutura, Alvenaria, Impermeabilização, Revestimento, Instalações

CHECKLIST DE INSPEÇÃO (antes, durante e após cada serviço):
- Conferência de projeto e materiais (antes)
- Acompanhamento de execução conforme norma (durante)
- Verificação final e aceitação (após)

ENSAIOS E TESTES OBRIGATÓRIOS:
- Sondagem do solo (SPT)
- Slump test e rompimento de corpos de prova (concreto)
- Prova de carga (fundações)
- Estanqueidade (impermeabilização e hidráulica)
- Resistência à compressão (concreto e argamassa)

RASTREABILIDADE:
- Identificação de lotes de concreto/material
- Registros fotográficos por etapa
- Diário de Obra atualizado diariamente`;

const TEXTO_SSMT = `ANÁLISE PRELIMINAR DE RISCO (APR) por frente de trabalho.

NORMAS REGULAMENTADORAS APLICÁVEIS:
- NR-18 (Condições no setor da construção)
- NR-35 (Trabalho em altura)
- NR-10 (Instalações elétricas)
- NR-6 (EPI)
- NR-5 (CIPA)
- NR-12 (Máquinas e equipamentos)

EPIs OBRIGATÓRIOS por função: capacete, botina, luvas, óculos, protetor auricular, cinto de segurança (altura), etc.

TREINAMENTOS: integração admissional, NR-18, NR-35, reciclagens periódicas.

PLANO DE EMERGÊNCIA: rotas de evacuação, brigada/primeiros socorros, contatos de emergência (SAMU 192, Bombeiros 193).

SINALIZAÇÃO: tapumes, placas de advertência, isolamento de áreas de risco.

DOCUMENTAÇÃO OBRIGATÓRIA: PCMAT/PGR, LTCAT, PPP, ASO.`;

const TEXTO_AMBIENTAL = `CLASSIFICAÇÃO DE RESÍDUOS (CONAMA 307/431):
- Classe A: reutilizáveis/recicláveis como agregado (concreto, argamassa, alvenaria)
- Classe B: recicláveis (madeira, plástico, papel, metal, vidro)
- Classe C: sem tecnologia de reciclagem viável (gesso - destinação específica)
- Classe D: perigosos (tintas, solventes, óleos, amianto)

DESTINAÇÃO LEGAL: cada classe para destino licenciado (aterro de inertes, recicladoras, ATT, coprocessamento).

ARMAZENAMENTO TEMPORÁRIO (ATT interna): baias segregadas por classe.

CONTROLE DE EFLUENTES, POEIRA E RUÍDO: umectação, telas, horários de boas vizinhanças.

LICENÇAS: comunicar órgão ambiental municipal/estadual; emitir CTR (Controle de Transporte de Resíduos).`;

const TEXTO_CANTEIRO = `LAYOUT DO CANTEIRO:
- Escritório, vestiários, refeitório, almoxarifado, área de materiais, banheiros, circulação

INSTALAÇÕES PROVISÓRIAS:
- Energia (entrada provisória/DG), água e esgoto

EQUIPAMENTOS DE APOIO:
- Betoneira, andaimes, escoramento, grua/guindaste (se aplicável)

PLANO DE DESMOBILIZAÇÃO:
- Retirada de instalações provisórias, limpeza e entrega da área ao final`;

const TEXTO_CONTROLE = `LINHA DE BASE:
- Schedule Baseline (cronograma-base) e Cost Baseline (orçamento-base) congelados na aprovação.

INDICADORES (Earned Value Management):
- SPI (Índice de Desempenho de Prazo) = VA / VP
- CPI (Índice de Desempenho de Custo) = VA / CR

GATILHOS DE ALERTA:
- SPI < 0,85 ou desvio de prazo/custo acima de 10% → aciona plano de ação

PLANO DE AÇÃO PARA DESVIOS: responsável, prazo e ação corretiva definidos.

CONTROLE DE MUDANÇAS (Change Control): toda alteração de escopo formalizada e aprovada.`;

const TEXTO_RISCOS = `MATRIZ DE RISCOS (probabilidade × impacto): Alto / Médio / Baixo.

TOP 10 RISCOS (causa → efeito → resposta):
1. Chuvas intensas → atraso em fundação/estrutura → replanejar frentes cobertas
2. Falta de material → paralisação → compras antecipadas e fornecedores alternativos
3. Falência de fornecedor → desabastecimento → homologar 2º fornecedor
4. Mão de obra insuficiente → atraso → banco de empreiteiros
5. Erros de projeto → retrabalho → compatibilização/BIM prévia
6. Acidente de trabalho → paralisação/multa → SSMT rigoroso
7. Variação de preços → estouro de orçamento → contratos com reajuste previsto
8. Embargo/fiscalização → parada → documentação e licenças em dia
9. Condições do solo divergentes → revisão de fundação → sondagem adequada
10. Inadimplência do cliente → fluxo de caixa → medições e marcos de pagamento

RESERVA DE CONTINGÊNCIA RECOMENDADA: 5% a 10% sobre o orçamento.

PLANO B PARA RISCOS CRÍTICOS: definido para chuvas, greve, falta de material e falência de fornecedor.`;

export function gerarPlanejamento(opts: {
  dataInicio: string;
  orcamento?: { nome: string; itens: Array<{ categoria?: string; descricao: string; quantidade: number; precoUnitario: number }>; valorTotal: number } | null;
}): PlanejamentoDados {
  const inicio = new Date((opts.dataInicio || new Date().toISOString().split("T")[0]) + "T12:00:00");
  const itens = opts.orcamento?.itens ?? [];
  const valorTotal = opts.orcamento?.valorTotal ?? 0;

  // ── EAP ──────────────────────────────────────────────────────────
  const eap: PlanejamentoDados["eap"] = [];
  // Agrupa por categoria
  const porCat: Record<string, typeof itens> = {};
  itens.forEach(it => { (porCat[it.categoria || "Geral"] ??= []).push(it); });
  const categorias = Object.keys(porCat);

  let nivel1 = 0;
  for (const cat of categorias) {
    nivel1++;
    eap.push({ codigo: `${nivel1}`, nivel: 1, descricao: cat, responsavel: "Engenheiro" });
    let nivel2 = 0;
    for (const it of porCat[cat]) {
      nivel2++;
      eap.push({ codigo: `${nivel1}.${nivel2}`, nivel: 2, descricao: it.descricao, responsavel: "Mestre/Encarregado" });
    }
  }

  // ── CRONOGRAMA ───────────────────────────────────────────────────
  // Uma atividade por categoria, ordenada por fase macro, durações proporcionais ao custo
  const custoCat: Record<string, number> = {};
  for (const cat of categorias) {
    custoCat[cat] = porCat[cat].reduce((s, it) => s + it.quantidade * it.precoUnitario, 0);
  }
  const custoTotalItens = Object.values(custoCat).reduce((a, b) => a + b, 0) || 1;
  const PRAZO_BASE = Math.max(60, categorias.length * 12); // dias

  // ordena categorias pela fase macro
  const catsOrdenadas = [...categorias].sort((a, b) => {
    const fa = ORDEM_FASES.indexOf(FASE_MACRO[a] || "Acabamentos");
    const fb = ORDEM_FASES.indexOf(FASE_MACRO[b] || "Acabamentos");
    return fa - fb;
  });

  const atividades: PlanejamentoDados["cronograma"]["atividades"] = [];
  let cursor = new Date(inicio);
  let idx = 0;
  let prevId = "";
  for (const cat of catsOrdenadas) {
    idx++;
    const dur = Math.max(3, Math.round(PRAZO_BASE * (custoCat[cat] / custoTotalItens)) || 5);
    const ini = new Date(cursor);
    const fim = addDias(ini, dur - 1);
    atividades.push({
      id: `A${idx}`,
      descricao: cat,
      fase: FASE_MACRO[cat] || "Acabamentos",
      predecessoras: prevId,
      duracaoDias: dur,
      inicio: fmt(ini),
      fim: fmt(fim),
      critico: true,        // V1: sequência linear = tudo crítico
      folgaDias: 0,
    });
    prevId = `A${idx}`;
    cursor = addDias(fim, 1);
  }
  const prazoTotalDias = atividades.length > 0
    ? Math.round((new Date(atividades[atividades.length - 1].fim).getTime() - inicio.getTime()) / 86400000) + 1
    : PRAZO_BASE;

  // Marcos
  const marcos: PlanejamentoDados["cronograma"]["marcos"] = [];
  if (atividades.length > 0) {
    marcos.push({ descricao: "Início da obra", data: atividades[0].inicio });
    const fundacoes = atividades.filter(a => a.fase === "Fundações").pop();
    if (fundacoes) marcos.push({ descricao: "Conclusão das fundações", data: fundacoes.fim });
    const estrutura = atividades.filter(a => a.fase === "Estrutura").pop();
    if (estrutura) marcos.push({ descricao: "Conclusão da estrutura", data: estrutura.fim });
    marcos.push({ descricao: "Entrega da obra", data: atividades[atividades.length - 1].fim });
  }

  // ── RECURSOS ─────────────────────────────────────────────────────
  const maoDeObra: PlanejamentoDados["recursos"]["maoDeObra"] = [
    { funcao: "Mestre de Obras", quantidade: 1, regime: "CLT", turnos: "Integral" },
    { funcao: "Encarregado", quantidade: 1, regime: "CLT", turnos: "Integral" },
    { funcao: "Servente / Ajudante", quantidade: 4, regime: "CLT", turnos: "1 turno (8h)" },
    { funcao: "Pedreiro", quantidade: 3, regime: "CLT/Empreitada", turnos: "1 turno (8h)" },
    { funcao: "Carpinteiro", quantidade: 2, regime: "Empreitada", turnos: "1 turno (8h)" },
    { funcao: "Armador (Ferreiro)", quantidade: 2, regime: "Empreitada", turnos: "1 turno (8h)" },
    { funcao: "Eletricista", quantidade: 1, regime: "Empreitada", turnos: "Conforme fase" },
    { funcao: "Bombeiro Hidráulico", quantidade: 1, regime: "Empreitada", turnos: "Conforme fase" },
    { funcao: "Ladrilheiro (Azulejista)", quantidade: 2, regime: "Empreitada", turnos: "Fase de revestimento" },
    { funcao: "Gesseiro", quantidade: 1, regime: "Empreitada", turnos: "Fase de acabamento" },
    { funcao: "Serralheiro", quantidade: 1, regime: "Empreitada", turnos: "Conforme fase" },
    { funcao: "Pintor", quantidade: 2, regime: "Empreitada", turnos: "Fase de acabamento" },
  ];
  const equipamentos: PlanejamentoDados["recursos"]["equipamentos"] = [
    { nome: "Betoneira", metodo: "Próprio/Alugado", periodo: "Fundação a estrutura" },
    { nome: "Andaimes", metodo: "Alugado", periodo: "Estrutura a acabamento" },
    { nome: "Escoramento/formas", metodo: "Alugado", periodo: "Estrutura" },
    { nome: "Compactador de solo", metodo: "Alugado", periodo: "Terraplenagem/fundação" },
    { nome: "Ferramentas elétricas", metodo: "Próprio", periodo: "Toda a obra" },
  ];

  // Curva S mensal: distribui o custo das atividades pelos meses
  const curvaS: PlanejamentoDados["recursos"]["curvaS"] = [];
  if (atividades.length > 0 && valorTotal > 0) {
    const fimObra = new Date(atividades[atividades.length - 1].fim);
    const meses: { rotulo: string; ini: Date; fim: Date }[] = [];
    let m = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (m <= fimObra) {
      const ini = new Date(m);
      const fim = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      meses.push({ rotulo: `${String(m.getMonth() + 1).padStart(2, "0")}/${m.getFullYear()}`, ini, fim });
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }
    // custo por dia de cada atividade, agregado por mês
    const custoPorMes: Record<string, number> = {};
    for (const a of atividades) {
      const custoAtiv = custoCat[a.descricao] || 0;
      const ai = new Date(a.inicio), af = new Date(a.fim);
      const totalDias = a.duracaoDias || 1;
      const custoDia = custoAtiv / totalDias;
      for (const mes of meses) {
        const ini = ai > mes.ini ? ai : mes.ini;
        const fim = af < mes.fim ? af : mes.fim;
        const dias = Math.max(0, Math.round((fim.getTime() - ini.getTime()) / 86400000) + (ini <= fim ? 1 : 0));
        if (dias > 0) custoPorMes[mes.rotulo] = (custoPorMes[mes.rotulo] || 0) + custoDia * dias;
      }
    }
    let acumulado = 0;
    for (const mes of meses) {
      const custoMes = custoPorMes[mes.rotulo] || 0;
      acumulado += custoMes;
      curvaS.push({
        mes: mes.rotulo,
        percentualMes: Math.round((custoMes / custoTotalItens) * 1000) / 10,
        percentualAcumulado: Math.round((acumulado / custoTotalItens) * 1000) / 10,
        valorAcumulado: Math.round(acumulado),
      });
    }
  }

  // ── RESUMO EXECUTIVO ─────────────────────────────────────────────
  const resumoExecutivo = `RESUMO EXECUTIVO DO PLANEJAMENTO

Obra/Orçamento: ${opts.orcamento?.nome ?? "Planejamento em branco"}
Início previsto: ${fmt(inicio)}
Prazo total estimado: ${prazoTotalDias} dias (${Math.ceil(prazoTotalDias / 30)} meses)
Valor total do orçamento: ${valorTotal > 0 ? "R$ " + valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "a definir"}

Fases macro: ${Array.from(new Set(atividades.map(a => a.fase))).join(" → ") || "a definir"}
Total de pacotes de trabalho (EAP): ${eap.length}
Atividades no cronograma: ${atividades.length}

Reserva de contingência recomendada: 5% a 10%.
Indicadores de controle: SPI e CPI (Earned Value).`;

  return {
    origem: opts.orcamento ? "orcamento" : "branco",
    prazoTotalDias,
    eap,
    cronograma: { atividades, marcos },
    recursos: { maoDeObra, equipamentos, curvaS },
    suprimentos: TEXTO_SUPRIMENTOS,
    qualidade: TEXTO_QUALIDADE,
    ssmt: TEXTO_SSMT,
    ambiental: TEXTO_AMBIENTAL,
    canteiro: TEXTO_CANTEIRO,
    controle: TEXTO_CONTROLE,
    riscos: TEXTO_RISCOS,
    resumoExecutivo,
  };
}
