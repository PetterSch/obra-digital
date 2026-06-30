/**
 * Exportação de PDF para o Diário de Obras
 * Usa a API de impressão nativa do browser (window.print) com estilos customizados.
 * Suporta capa profissional com logo configurável via localStorage.
 */

// ─── Configuração de Logo / Empresa ────────────────────────────────────────

export interface PDFConfig {
  logoBase64?: string;       // data:image/png;base64,...
  empresaNome?: string;      // razão social / nome fantasia
  empresaSubtitulo?: string; // slogan, especialidade
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  site?: string;
  responsavelPadrao?: string; // engenheiro responsável padrão
  crea?: string;
}

export function getPDFConfig(): PDFConfig {
  try {
    const raw = localStorage.getItem("pdfConfig");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setPDFConfig(config: PDFConfig): void {
  localStorage.setItem("pdfConfig", JSON.stringify(config));
}

// ─── Helpers de label ──────────────────────────────────────────────────────

function climaLabel(clima?: string): string {
  const map: Record<string, string> = {
    ensolarado: "☀️ Ensolarado",
    nublado: "⛅ Nublado",
    chuvoso: "🌧️ Chuvoso",
    tempestade: "⛈️ Tempestade",
    ventania: "💨 Ventania",
  };
  return clima ? (map[clima] ?? clima) : "Não informado";
}

function statusLabel(status?: string): string {
  const map: Record<string, string> = {
    nao_iniciada: "Não iniciada",
    em_andamento: "Em andamento",
    concluida: "Concluída",
  };
  return status ? (map[status] ?? status) : "";
}

function criticidadeLabel(c?: string): string {
  const map: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
  return c ? (map[c] ?? c) : "";
}

// ─── CSS base compartilhado ────────────────────────────────────────────────

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: white; }

  /* ── Capa ── */
  .cover-page {
    width: 100%; height: 100vh;
    display: flex; flex-direction: column;
    page-break-after: always; break-after: page;
    position: relative; overflow: hidden;
  }
  .cover-bg {
    background: linear-gradient(145deg, #0f2744 0%, #1e3a5f 55%, #1a4a6e 100%);
    flex: 0 0 52%; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 40px 60px; position: relative;
  }
  .cover-bg::after {
    content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 60px;
    background: white; clip-path: ellipse(55% 100% at 50% 100%);
  }
  .cover-logo-wrap {
    background: white; border-radius: 20px;
    padding: 24px 40px; margin-bottom: 28px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    display: flex; align-items: center; gap: 14px;
  }
  .cover-logo-wrap img { height: 110px; max-width: 340px; object-fit: contain; }
  .cover-logo-default { font-size: 26px; font-weight: 800; color: #1e3a5f; letter-spacing: -0.5px; }
  .cover-logo-default span { color: #2563eb; }
  .cover-doc-badge {
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
    color: white; font-size: 11px; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; padding: 5px 18px; border-radius: 20px;
    margin-bottom: 16px;
  }
  .cover-doc-title {
    color: white; font-size: 30px; font-weight: 700;
    text-align: center; line-height: 1.25; letter-spacing: -0.3px;
  }
  .cover-doc-subtitle {
    color: rgba(255,255,255,0.7); font-size: 13px;
    text-align: center; margin-top: 6px;
  }
  .cover-accent {
    position: absolute; top: 0; right: 0;
    width: 180px; height: 180px;
    background: rgba(255,255,255,0.04);
    border-radius: 50%; transform: translate(40%, -40%);
  }
  .cover-accent2 {
    position: absolute; bottom: 80px; left: -30px;
    width: 120px; height: 120px;
    background: rgba(255,255,255,0.04);
    border-radius: 50%;
  }

  .cover-body {
    flex: 1; padding: 40px 60px 30px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .cover-info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    margin-top: 16px;
  }
  .cover-info-item { border-left: 3px solid #1e3a5f; padding-left: 12px; }
  .cover-info-item .lbl {
    font-size: 9px; font-weight: 700; color: #1e3a5f;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;
  }
  .cover-info-item .val { font-size: 13px; color: #1a1a1a; font-weight: 500; }
  .cover-empresa {
    font-size: 11px; color: #6b7280; font-weight: 500;
    letter-spacing: 0.5px; text-transform: uppercase;
    margin-bottom: 4px;
  }
  .cover-obra-nome {
    font-size: 22px; font-weight: 700; color: #1e3a5f;
    line-height: 1.3;
  }
  .cover-footer {
    border-top: 1px solid #e5e7eb; padding-top: 16px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .cover-footer-left { font-size: 10px; color: #9ca3af; line-height: 1.6; }
  .cover-footer-right {
    background: #1e3a5f; color: white;
    font-size: 11px; font-weight: 600; padding: 6px 16px; border-radius: 6px;
  }

  /* ── Cabeçalho das páginas internas ── */
  .page { max-width: 820px; margin: 0 auto; padding: 20px 28px 28px; }
  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 3px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 18px;
  }
  .page-header-left { display: flex; align-items: center; gap: 12px; }
  .page-header-logo img { height: 36px; max-width: 120px; object-fit: contain; }
  .page-header-logo-text { font-size: 14px; font-weight: 800; color: #1e3a5f; letter-spacing: -0.3px; }
  .page-header-logo-text span { color: #2563eb; }
  .page-header-divider { width: 1px; height: 32px; background: #d1d5db; }
  .page-header-info { }
  .page-header-info .obra { font-size: 12px; font-weight: 700; color: #1a1a1a; }
  .page-header-info .sub { font-size: 10px; color: #6b7280; }
  .page-header-right { text-align: right; }
  .page-header-right .doc-id {
    background: #1e3a5f; color: white;
    font-size: 10px; font-weight: 700; letter-spacing: 1px;
    padding: 3px 10px; border-radius: 4px; text-transform: uppercase;
  }
  .page-header-right .date { font-size: 10px; color: #6b7280; margin-top: 4px; }

  /* ── Info da Obra (faixa) ── */
  .obra-info { background: #f0f4f8; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .obra-info-item { font-size: 11px; }
  .obra-info-item strong { color: #1e3a5f; display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }

  /* ── Clima ── */
  .clima-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .clima-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; }
  .clima-card .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .clima-card .value { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-top: 2px; }

  /* ── Seções ── */
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 11px; font-weight: 700; color: #1e3a5f;
    text-transform: uppercase; letter-spacing: 0.8px;
    border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;
    display: flex; align-items: center; gap: 6px;
  }
  .section-title::before {
    content: ''; display: inline-block;
    width: 3px; height: 13px; background: #1e3a5f; border-radius: 2px;
  }

  /* ── Tabelas ── */
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }

  /* ── Observações ── */
  .obs-box { background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 10px 14px; font-size: 11px; line-height: 1.6; }

  /* ── Ocorrências ── */
  .ocorrencia { border-left: 3px solid #6b7280; padding: 8px 12px; margin: 6px 0; background: #f9fafb; border-radius: 0 6px 6px 0; }
  .ocorrencia.alta, .ocorrencia.critica { border-left-color: #dc2626; background: #fff5f5; }
  .ocorrencia.media { border-left-color: #f59e0b; background: #fffbeb; }

  /* ── Assinaturas ── */
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; }
  .assinatura-box { text-align: center; }
  .assinatura-line { border-bottom: 1px solid #1a1a1a; margin-bottom: 4px; height: 44px; }
  .assinatura-label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .assinatura-name { font-size: 11px; font-weight: 600; margin-top: 2px; color: #1a1a1a; }

  /* ── Rodapé ── */
  .page-footer {
    margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 10px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9px; color: #9ca3af;
  }

  /* ── Stats ── */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .stat-card { background: #f0f4f8; border-radius: 6px; padding: 10px 12px; text-align: center; border-top: 3px solid #1e3a5f; }
  .stat-card .num { font-size: 24px; font-weight: 700; color: #1e3a5f; }
  .stat-card .lbl { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

  .progress-bar-outer { background: #e5e7eb; border-radius: 4px; height: 10px; margin-top: 4px; }
  .progress-bar-inner { background: linear-gradient(90deg, #1e3a5f, #2563eb); height: 10px; border-radius: 4px; }

  .resumo-text { background: #f9fafb; border-left: 4px solid #1e3a5f; padding: 14px; border-radius: 0 6px 6px 0; line-height: 1.7; font-size: 11px; white-space: pre-line; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    /* Capa ocupa exatamente uma página, sem gerar página em branco */
    .cover-page { height: 100vh; min-height: 0; overflow: hidden; page-break-after: always; }
    .page { padding: 12px 16px; }
  }
  @page { margin: 0; }
`;

// ─── Builders de bloco ────────────────────────────────────────────────────

function buildCoverPage(opts: {
  docType: string;        // "RDO" | "RELATÓRIO DE PERÍODO" | "RESUMO EXECUTIVO"
  docTitle: string;       // "Registro Diário de Obra"
  docId: string;          // "RDO #42" | "Jan–Fev 2025"
  obraNome: string;
  obraCliente: string;
  obraCodigo: string;
  obraResponsavel: string;
  obraEndereco: string;
  dataReferencia: string; // data do diário ou período
  config: PDFConfig;
}): string {
  const logoHTML = opts.config.logoBase64
    ? `<img src="${opts.config.logoBase64}" alt="Logo" />`
    : `<div class="cover-logo-default">Obra<span>Digital</span></div>`;

  const empresaNome = opts.config.empresaNome || "Diário de Obras Digital";
  const empresaSub  = opts.config.empresaSubtitulo || "Sistema Profissional de Gestão de Obras";
  // Primeira palavra (iniciais, ex: "RC") em preto; restante no tom âmbar da logo
  const _np = empresaNome.trim().split(/\s+/);
  const empresaNomeHTML = _np.length > 1
    ? `<span style="color:#1a1a1a">${_np[0]}</span> <span style="color:#B45309">${_np.slice(1).join(" ")}</span>`
    : `<span style="color:#B45309">${empresaNome}</span>`;
  const now = new Date().toLocaleString("pt-BR");

  // Linha de contato da empresa
  const contatoItems: string[] = [];
  if (opts.config.cnpj)    contatoItems.push(`CNPJ: ${opts.config.cnpj}`);
  if (opts.config.telefone) contatoItems.push(`Tel: ${opts.config.telefone}`);
  if (opts.config.email)   contatoItems.push(opts.config.email);
  if (opts.config.site)    contatoItems.push(opts.config.site);
  const contatoLine = contatoItems.join(" &nbsp;·&nbsp; ");

  // Responsável da empresa (ou da obra se não configurado)
  const responsavel = opts.obraResponsavel;
  const crea = opts.config.crea ? ` &nbsp;·&nbsp; CREA ${opts.config.crea}` : "";

  return `
  <div class="cover-page">
    <div class="cover-bg">
      <div class="cover-accent"></div>
      <div class="cover-accent2"></div>
      <div class="cover-logo-wrap">${logoHTML}</div>
      <div class="cover-doc-badge">${opts.docType}</div>
      <div class="cover-doc-title">${opts.docTitle}</div>
      <div class="cover-doc-subtitle">${opts.dataReferencia}</div>
    </div>

    <div class="cover-body">
      <div>
        <!-- Empresa emissora -->
        <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e5e7eb">
          <div style="font-size:26px;font-weight:800;line-height:1.15;letter-spacing:-0.3px">${empresaNomeHTML}</div>
          ${empresaSub ? `<div style="font-size:12px;color:#6b7280;margin-top:3px">${empresaSub}</div>` : ""}
          ${contatoLine ? `<div style="font-size:11px;color:#6b7280;margin-top:6px">${contatoLine}</div>` : ""}
        </div>

        <!-- Obra -->
        <div class="cover-empresa" style="margin-bottom:4px">OBRA</div>
        <div class="cover-obra-nome">${opts.obraNome}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px">Código: ${opts.obraCodigo}</div>

        <div class="cover-info-grid">
          <div class="cover-info-item">
            <div class="lbl">Cliente</div>
            <div class="val">${opts.obraCliente}</div>
          </div>
          <div class="cover-info-item">
            <div class="lbl">Responsável Técnico</div>
            <div class="val">${responsavel}${crea}</div>
          </div>
          <div class="cover-info-item">
            <div class="lbl">Endereço da obra</div>
            <div class="val">${opts.obraEndereco}</div>
          </div>
          <div class="cover-info-item">
            <div class="lbl">Documento</div>
            <div class="val" style="font-weight:700;color:#1e3a5f">${opts.docId}</div>
          </div>
        </div>
      </div>

      <div class="cover-footer">
        <div class="cover-footer-left">
          ${empresaNome}<br>
          ${opts.config.endereco ? opts.config.endereco + "<br>" : ""}
          Gerado em ${now}
        </div>
        <div class="cover-footer-right">${opts.docId}</div>
      </div>
    </div>
  </div>`;
}

function buildPageHeader(opts: {
  obraNome: string;
  obraCodigo: string;
  docId: string;
  dataRef: string;
  config: PDFConfig;
}): string {
  const logoHTML = opts.config.logoBase64
    ? `<div class="page-header-logo"><img src="${opts.config.logoBase64}" alt="Logo" /></div>`
    : `<div class="page-header-logo-text">Obra<span>Digital</span></div>`;

  const empresaNome = opts.config.empresaNome || "Diário de Obras Digital";
  const subItems: string[] = [`Cód. ${opts.obraCodigo}`];
  if (opts.config.telefone) subItems.push(opts.config.telefone);
  if (opts.config.email)    subItems.push(opts.config.email);

  return `
  <div class="page-header">
    <div class="page-header-left">
      ${logoHTML}
      <div class="page-header-divider"></div>
      <div class="page-header-info">
        <div class="obra">${empresaNome}</div>
        <div class="sub">${subItems.join(" · ")}</div>
      </div>
    </div>
    <div class="page-header-right">
      <div style="font-size:11px;font-weight:700;color:#1e3a5f;white-space:nowrap">${opts.obraNome}</div>
      <div class="doc-id" style="margin-top:3px">${opts.docId}</div>
      <div class="date">${opts.dataRef}</div>
    </div>
  </div>`;
}

function buildPageFooter(docLabel: string, obraNome: string): string {
  const now = new Date().toLocaleString("pt-BR");
  return `
  <div class="page-footer">
    <span>${obraNome} · ${docLabel}</span>
    <span>Gerado em ${now}</span>
  </div>`;
}

function openPrint(html: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Por favor, permita pop-ups para exportar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface DiarioPDFData {
  obra: {
    nome: string;
    codigo: string;
    cliente: string;
    endereco: string;
    responsavelTecnico: string;
  };
  diario: {
    id: number;
    data: string;
    horarioInicio?: string;
    horarioFim?: string;
    criadoEm?: string | Date;
    clima?: string;
    temperatura?: number | string;
    umidade?: number;
    observacoesGerais?: string;
  };
  atividades: Array<{
    descricao: string;
    local?: string;
    status?: string;
    percentualConcluido?: number;
    prioridade?: string;
  }>;
  maoDeObra: Array<{
    equipeNome?: string;
    empresa?: string;
    presentes: number;
    funcoes?: string;
  }>;
  equipamentos?: Array<{
    nome: string;
    quantidade: number;
    horasUso?: number;
    observacoes?: string;
  }>;
  ocorrencias: Array<{
    descricao: string;
    tipo?: string;
    criticidade?: string;
    responsavel?: string;
  }>;
  fotos?: Array<{
    src: string;
    descricao?: string;
  }>;
}

// ─── exportDiarioPDF ───────────────────────────────────────────────────────

export function exportDiarioPDF(data: DiarioPDFData): void {
  const config = getPDFConfig();

  const dataFormatada = new Date(data.diario.data + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const dataFormatadaCurta = new Date(data.diario.data + "T12:00:00").toLocaleDateString("pt-BR");
  const docId = `RDO #${data.diario.id}`;

  const atividadesHTML =
    data.atividades.length === 0
      ? "<tr><td colspan='4' style='color:#666;font-style:italic;padding:8px'>Nenhuma atividade registrada</td></tr>"
      : data.atividades.map((a) => `
          <tr>
            <td>${a.descricao}</td>
            <td>${a.local ?? "—"}</td>
            <td>${statusLabel(a.status)}</td>
            <td style="text-align:center">${a.percentualConcluido ?? 0}%</td>
          </tr>`).join("");

  const totalPresentes = data.maoDeObra.reduce((s, m) => s + (m.presentes || 0), 0);
  const maoDeObraHTML =
    data.maoDeObra.length === 0
      ? "<tr><td colspan='4' style='color:#666;font-style:italic;padding:8px'>Nenhum registro de mão de obra</td></tr>"
      : data.maoDeObra.map((m) => `
          <tr>
            <td>${m.equipeNome ?? "—"}</td>
            <td>${m.empresa ?? "—"}</td>
            <td style="font-size:11px;color:#444">${m.funcoes || "—"}</td>
            <td style="text-align:center;font-weight:700">${m.presentes}</td>
          </tr>`).join("")
        + `<tr><td colspan="3" style="text-align:right;font-weight:700">Total de presentes</td><td style="text-align:center;font-weight:800;color:#B45309">${totalPresentes}</td></tr>`;

  const ocorrenciasHTML =
    data.ocorrencias.length === 0
      ? "<p style='color:#666;font-style:italic;margin:8px 0'>Nenhuma ocorrência registrada.</p>"
      : data.ocorrencias.map((o) => `
          <div class="ocorrencia ${o.criticidade ?? ''}">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong style="font-size:11px">${o.tipo ?? "Ocorrência"}</strong>
              ${o.criticidade ? `<span style="font-size:10px;color:#6b7280;font-weight:600">${criticidadeLabel(o.criticidade)}</span>` : ""}
            </div>
            <p style="font-size:11px;line-height:1.5">${o.descricao}</p>
            ${o.responsavel ? `<div style="font-size:10px;color:#6b7280;margin-top:4px">Responsável: ${o.responsavel}</div>` : ""}
          </div>`).join("");

  const cover = buildCoverPage({
    docType: "Registro Diário de Obra",
    docTitle: "Diário de Obra",
    docId,
    obraNome: data.obra.nome,
    obraCliente: data.obra.cliente,
    obraCodigo: data.obra.codigo,
    obraResponsavel: data.obra.responsavelTecnico,
    obraEndereco: data.obra.endereco,
    dataReferencia: dataFormatada,
    config,
  });

  const header = buildPageHeader({
    obraNome: data.obra.nome,
    obraCodigo: data.obra.codigo,
    docId,
    dataRef: dataFormatadaCurta,
    config,
  });

  const footer = buildPageFooter(docId, data.obra.nome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${docId} — ${data.obra.nome}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
${cover}
<div class="page">
  ${header}

  <div class="obra-info">
    <div class="obra-info-item"><strong>Cliente</strong>${data.obra.cliente}</div>
    <div class="obra-info-item"><strong>Responsável Técnico</strong>${data.obra.responsavelTecnico}</div>
    <div class="obra-info-item"><strong>Horário</strong>${
      data.diario.horarioInicio
        ? `${data.diario.horarioInicio} às ${data.diario.horarioFim ?? "—"}`
        : data.diario.criadoEm
          ? "Registrado às " + new Date(data.diario.criadoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
          : "—"
    }</div>
  </div>

  <div class="section">
    <div class="section-title">Condições Climáticas</div>
    <div class="clima-row">
      <div class="clima-card">
        <div class="label">Clima</div>
        <div class="value">${climaLabel(data.diario.clima)}</div>
      </div>
      <div class="clima-card">
        <div class="label">Temperatura</div>
        <div class="value">${data.diario.temperatura ? `${data.diario.temperatura}°C` : "—"}</div>
      </div>
      <div class="clima-card">
        <div class="label">Umidade</div>
        <div class="value">${data.diario.umidade ? `${data.diario.umidade}%` : "—"}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Atividades Executadas</div>
    <table>
      <thead>
        <tr><th>Descrição</th><th>Local</th><th>Status</th><th style="text-align:center">Concluído</th></tr>
      </thead>
      <tbody>${atividadesHTML}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Mão de Obra</div>
    <table>
      <thead>
        <tr><th>Equipe</th><th>Empresa</th><th>Funções</th><th style="text-align:center">Presentes</th></tr>
      </thead>
      <tbody>${maoDeObraHTML}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Ocorrências e Impedimentos</div>
    ${ocorrenciasHTML}
  </div>

  ${data.diario.observacoesGerais ? `
  <div class="section">
    <div class="section-title">Observações Gerais</div>
    <div class="obs-box">${data.diario.observacoesGerais}</div>
  </div>` : ""}

  <div class="section" style="margin-top:24px">
    <div class="section-title">Assinaturas</div>
    <div class="assinaturas">
      <div class="assinatura-box">
        <div class="assinatura-line"></div>
        <div class="assinatura-label">Engenheiro Responsável</div>
        <div class="assinatura-name">${data.obra.responsavelTecnico}</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-line"></div>
        <div class="assinatura-label">Encarregado / Mestre</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-line"></div>
        <div class="assinatura-label">Cliente / Fiscalização</div>
        <div class="assinatura-name">${data.obra.cliente}</div>
      </div>
    </div>
  </div>

  ${data.fotos && data.fotos.length > 0 ? `
  <div class="section" style="page-break-before:always">
    <div class="section-title">Registro Fotográfico (${data.fotos.length} foto${data.fotos.length !== 1 ? "s" : ""})</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px">
      ${data.fotos.map(f => `
        <div style="break-inside:avoid">
          <img src="${f.src}" alt="${f.descricao || 'Foto'}"
            style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb" />
          ${f.descricao ? `<p style="font-size:9px;color:#6b7280;margin:3px 0 0;text-align:center;line-height:1.3">${f.descricao}</p>` : ""}
        </div>`).join("")}
    </div>
  </div>` : ""}

  ${footer}
</div>
<script>
  window.onload = () => window.print();
  window.onafterprint = () => window.close();
</script>
</body>
</html>`;

  openPrint(html);
}

// ─── exportResumoPDF ───────────────────────────────────────────────────────

export function exportResumoPDF(
  obraNome: string,
  periodo: string,
  dataInicio: string,
  dataFim: string,
  resumoNarrativo: string,
  stats: {
    totalDiarios: number;
    totalAtividades: number;
    totalOcorrencias: number;
    totalFotos: number;
    maoDeObraTotal: number;
    climaPredominante?: string | null;
    principaisAtividades: string[];
    principaisOcorrencias: string[];
  },
  obraMeta?: { codigo?: string; cliente?: string; responsavelTecnico?: string; endereco?: string }
): void {
  const config = getPDFConfig();
  const docId = `Resumo ${periodo}`;
  const dataRef = `${dataInicio} a ${dataFim}`;

  const climaIcons: Record<string, string> = {
    ensolarado: "☀️ Ensolarado", nublado: "⛅ Nublado",
    chuvoso: "🌧️ Chuvoso", tempestade: "⛈️ Tempestade", ventania: "💨 Ventania",
  };

  const atividadesListHTML =
    stats.principaisAtividades.length === 0
      ? "<li style='color:#666;font-style:italic'>Nenhuma atividade registrada</li>"
      : stats.principaisAtividades.map((a) => `<li style="margin-bottom:4px;line-height:1.5">${a}</li>`).join("");

  const ocorrenciasListHTML =
    stats.principaisOcorrencias.length === 0
      ? "<li style='color:#666;font-style:italic'>Nenhuma ocorrência crítica registrada</li>"
      : stats.principaisOcorrencias.map((o) => `<li style="margin-bottom:4px;line-height:1.5">${o}</li>`).join("");

  const cover = buildCoverPage({
    docType: "Resumo Executivo",
    docTitle: "Resumo Executivo",
    docId,
    obraNome,
    obraCliente: obraMeta?.cliente ?? "—",
    obraCodigo: obraMeta?.codigo ?? "—",
    obraResponsavel: obraMeta?.responsavelTecnico ?? "—",
    obraEndereco: obraMeta?.endereco ?? "—",
    dataReferencia: dataRef,
    config,
  });

  const header = buildPageHeader({
    obraNome,
    obraCodigo: obraMeta?.codigo ?? "—",
    docId,
    dataRef,
    config,
  });

  const footer = buildPageFooter(docId, obraNome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${docId} — ${obraNome}</title>
  <style>${BASE_CSS}
    ul { padding-left: 18px; }
  </style>
</head>
<body>
${cover}
<div class="page">
  ${header}

  <div class="stats-grid">
    <div class="stat-card"><div class="num">${stats.totalDiarios}</div><div class="lbl">Diários</div></div>
    <div class="stat-card"><div class="num">${stats.totalAtividades}</div><div class="lbl">Atividades</div></div>
    <div class="stat-card"><div class="num">${stats.maoDeObraTotal}</div><div class="lbl">Mão de Obra</div></div>
    <div class="stat-card"><div class="num">${stats.totalOcorrencias}</div><div class="lbl">Ocorrências</div></div>
    <div class="stat-card"><div class="num">${stats.totalFotos}</div><div class="lbl">Fotos</div></div>
    <div class="stat-card"><div class="num" style="font-size:20px">${stats.climaPredominante ? (climaIcons[stats.climaPredominante] ?? stats.climaPredominante) : "—"}</div><div class="lbl">Clima predominante</div></div>
  </div>

  <div class="section">
    <div class="section-title">Resumo Executivo</div>
    <div class="resumo-text">${resumoNarrativo || "Resumo não gerado."}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="section">
      <div class="section-title">Principais Atividades</div>
      <ul>${atividadesListHTML}</ul>
    </div>
    <div class="section">
      <div class="section-title">Ocorrências Críticas</div>
      <ul>${ocorrenciasListHTML}</ul>
    </div>
  </div>

  ${footer}
</div>
<script>
  window.onload = () => window.print();
  window.onafterprint = () => window.close();
</script>
</body>
</html>`;

  openPrint(html);
}

// ─── exportPeriodoPDF ──────────────────────────────────────────────────────

export interface PeriodoPDFData {
  obra: {
    nome: string;
    codigo: string;
    cliente: string;
    endereco: string;
    responsavelTecnico: string;
    percentualAndamento?: number | null;
  };
  periodo: {
    dataInicio: string;
    dataFim: string;
  };
  diarios: Array<{
    id: number;
    data: string | Date;
    clima?: string;
    temperatura?: string | number | null;
    horarioInicio?: string | null;
    horarioFim?: string | null;
    observacoesGerais?: string | null;
  }>;
  stats: {
    totalDiarios: number;
    climaPredominante: string | null;
    climaCounts: Record<string, number>;
  };
}

const CLIMA_LABELS_PDF: Record<string, string> = {
  ensolarado: "☀️ Ensolarado",
  nublado: "⛅ Nublado",
  chuvoso: "🌧️ Chuvoso",
  tempestade: "⛈️ Tempestade",
  ventania: "💨 Ventania",
};

export function exportPeriodoPDF(data: PeriodoPDFData): void {
  const config = getPDFConfig();
  const { obra, periodo, diarios, stats } = data;
  const docId = `Relatório ${periodo.dataInicio}–${periodo.dataFim}`;
  const dataRef = `${periodo.dataInicio} a ${periodo.dataFim}`;

  const climaBarras = Object.entries(stats.climaCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([clima, count]) => {
      const pct = stats.totalDiarios > 0 ? Math.round((count / stats.totalDiarios) * 100) : 0;
      const colors: Record<string, string> = {
        ensolarado: "#f59e0b", nublado: "#6b7280",
        chuvoso: "#3b82f6", tempestade: "#7c3aed", ventania: "#0891b2",
      };
      return `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">
            <span>${CLIMA_LABELS_PDF[clima] ?? clima}</span>
            <span style="font-weight:600">${count} dia(s) — ${pct}%</span>
          </div>
          <div style="background:#e5e7eb;border-radius:3px;height:8px">
            <div style="background:${colors[clima] ?? "#6b7280"};width:${pct}%;height:8px;border-radius:3px"></div>
          </div>
        </div>`;
    }).join("");

  const diariosHTML = diarios.map(d => {
    const dataFmt = new Date(typeof d.data === "string" ? d.data + "T12:00:00" : d.data)
      .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
    const horario = d.horarioInicio && d.horarioFim
      ? `${d.horarioInicio} – ${d.horarioFim}`
      : d.horarioInicio ?? "—";
    return `
      <tr>
        <td style="white-space:nowrap">${dataFmt}</td>
        <td>${CLIMA_LABELS_PDF[d.clima ?? ""] ?? d.clima ?? "—"}</td>
        <td style="white-space:nowrap">${horario}</td>
        <td style="color:#6b7280;font-size:10px">${d.observacoesGerais
          ? (d.observacoesGerais.length > 110 ? d.observacoesGerais.slice(0, 110) + "…" : d.observacoesGerais)
          : "—"}</td>
      </tr>`;
  }).join("");

  const cover = buildCoverPage({
    docType: "Relatório de Período",
    docTitle: "Relatório de Período",
    docId,
    obraNome: obra.nome,
    obraCliente: obra.cliente,
    obraCodigo: obra.codigo,
    obraResponsavel: obra.responsavelTecnico,
    obraEndereco: obra.endereco,
    dataReferencia: dataRef,
    config,
  });

  const header = buildPageHeader({
    obraNome: obra.nome,
    obraCodigo: obra.codigo,
    docId,
    dataRef,
    config,
  });

  const footer = buildPageFooter(docId, obra.nome);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Período — ${obra.nome}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
${cover}
<div class="page">
  ${header}

  <div class="obra-info">
    <div class="obra-info-item"><strong>Cliente</strong>${obra.cliente}</div>
    <div class="obra-info-item"><strong>Responsável Técnico</strong>${obra.responsavelTecnico}</div>
    <div class="obra-info-item"><strong>Endereço</strong>${obra.endereco}</div>
  </div>

  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card"><div class="num">${stats.totalDiarios}</div><div class="lbl">Diários no período</div></div>
    <div class="stat-card"><div class="num">${obra.percentualAndamento ?? 0}%</div><div class="lbl">Progresso da obra</div></div>
    <div class="stat-card"><div class="num" style="font-size:18px">${stats.climaPredominante ? (CLIMA_LABELS_PDF[stats.climaPredominante] ?? stats.climaPredominante) : "—"}</div><div class="lbl">Clima predominante</div></div>
  </div>

  ${obra.percentualAndamento != null ? `
  <div class="section">
    <div class="section-title">Progresso geral da obra</div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${obra.percentualAndamento}% concluído</div>
    <div class="progress-bar-outer"><div class="progress-bar-inner" style="width:${obra.percentualAndamento}%"></div></div>
  </div>` : ""}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div>
      <div class="section-title">Distribuição climática</div>
      ${stats.totalDiarios === 0 ? "<p style='color:#666;font-style:italic;font-size:11px'>Sem registros</p>" : climaBarras}
    </div>
    <div>
      <div class="section-title">Resumo do período</div>
      <table>
        <tbody>
          <tr><td style="color:#6b7280">Início</td><td style="font-weight:600">${periodo.dataInicio}</td></tr>
          <tr><td style="color:#6b7280">Fim</td><td style="font-weight:600">${periodo.dataFim}</td></tr>
          <tr><td style="color:#6b7280">Diários</td><td style="font-weight:600">${stats.totalDiarios}</td></tr>
          <tr><td style="color:#6b7280">Obra</td><td style="font-weight:600">${obra.nome}</td></tr>
          <tr><td style="color:#6b7280">Código</td><td style="font-weight:600">${obra.codigo}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Diários do período</div>
    <table>
      <thead>
        <tr><th>Data</th><th>Clima</th><th>Horário</th><th>Observações</th></tr>
      </thead>
      <tbody>
        ${diarios.length === 0
          ? `<tr><td colspan="4" style="color:#666;font-style:italic;padding:10px">Nenhum diário registrado</td></tr>`
          : diariosHTML}
      </tbody>
    </table>
  </div>

  <div class="section" style="margin-top:20px">
    <div class="section-title">Assinaturas</div>
    <div class="assinaturas">
      <div class="assinatura-box">
        <div class="assinatura-line"></div>
        <div class="assinatura-label">Engenheiro responsável</div>
        <div class="assinatura-name">${obra.responsavelTecnico}</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-line"></div>
        <div class="assinatura-label">Encarregado / Mestre</div>
      </div>
      <div class="assinatura-box">
        <div class="assinatura-line"></div>
        <div class="assinatura-label">Cliente / Fiscalização</div>
        <div class="assinatura-name">${obra.cliente}</div>
      </div>
    </div>
  </div>

  ${footer}
</div>
<script>
  window.onload = () => window.print();
  window.onafterprint = () => window.close();
</script>
</body>
</html>`;

  openPrint(html);
}

// ─── exportOrcamentoPDF ─────────────────────────────────────────────────────

export interface OrcamentoPDFData {
  obraNome: string;
  obraCodigo: string;
  cliente: string;
  responsavelTecnico: string;
  endereco: string;
  nome: string;
  itens: Array<{ categoria?: string; descricao: string; unidade?: string; quantidade: number; precoUnitario: number }>;
  totais: {
    custoDirecto: number; bdi: number; valorBdi: number; valorComBdi: number;
    adm: number; valorAdministracao: number; valorTotal: number;
    area: number; custoM2SemAdm: number; custoM2ComAdm: number;
  };
}

export function exportOrcamentoPDF(data: OrcamentoPDFData): void {
  const config = getPDFConfig();
  const docId = "Orçamento";
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cover = buildCoverPage({
    docType: "Orçamento de Obra",
    docTitle: data.nome,
    docId,
    obraNome: data.obraNome,
    obraCliente: data.cliente,
    obraCodigo: data.obraCodigo,
    obraResponsavel: data.responsavelTecnico,
    obraEndereco: data.endereco,
    dataReferencia: data.cliente && data.cliente !== "—" ? `Cliente: ${data.cliente}` : "",
    config,
  });

  const header = buildPageHeader({
    obraNome: data.obraNome, obraCodigo: data.obraCodigo, docId,
    dataRef: data.nome, config,
  });
  const footer = buildPageFooter(docId, data.obraNome);

  // Agrupa itens por categoria
  const porCat: Record<string, typeof data.itens> = {};
  data.itens.forEach(it => { (porCat[it.categoria || "Outros"] ??= []).push(it); });

  // BDI é EMBUTIDO (diluído) nos preços unitários — não aparece como linha no PDF.
  const fatorBdi = 1 + (data.totais.bdi || 0) / 100;

  let linhas = "";
  for (const [cat, lista] of Object.entries(porCat)) {
    linhas += `<tr><td colspan="5" style="background:#f0f4f8;font-weight:700;color:#1e3a5f;font-size:10px;text-transform:uppercase;padding:6px 8px">${cat}</td></tr>`;
    for (const it of lista) {
      const precoComBdi = it.precoUnitario * fatorBdi;
      const total = it.quantidade * precoComBdi;
      linhas += `<tr>
        <td>${it.descricao}</td>
        <td style="text-align:center">${it.unidade ?? "—"}</td>
        <td style="text-align:right">${it.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right">${brl(precoComBdi)}</td>
        <td style="text-align:right;font-weight:600">${brl(total)}</td>
      </tr>`;
    }
  }

  const t = data.totais;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Orçamento — ${data.obraNome}</title><style>${BASE_CSS}
  .orc-resumo { width: 60%; margin-left: auto; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .orc-resumo div { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
  .orc-resumo .total { background: #1e3a5f; color: #fff; font-weight: 700; font-size: 14px; }
  .orc-m2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
  .orc-m2 .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; text-align: center; }
  .orc-m2 .box.dest { background: #f0f4f8; border-color: #1e3a5f; }
  .orc-m2 .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .orc-m2 .val { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-top: 3px; }
</style></head><body>
${cover}
<div class="page">
  ${header}
  <div class="section">
    <div class="section-title">Composição do Orçamento</div>
    <table>
      <thead><tr>
        <th>Descrição</th><th style="text-align:center">Un.</th>
        <th style="text-align:right">Qtd.</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${linhas || `<tr><td colspan="5" style="color:#666;font-style:italic;padding:10px">Nenhum item</td></tr>`}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Fechamento</div>
    <div class="orc-resumo">
      <div><span style="font-weight:600">Subtotal dos serviços</span><span style="font-weight:600">${brl(t.valorComBdi)}</span></div>
      <div><span>Administração da obra (${t.adm}%)</span><span>${brl(t.valorAdministracao)}</span></div>
      <div class="total"><span>VALOR TOTAL DA OBRA</span><span>${brl(t.valorTotal)}</span></div>
    </div>
    ${t.area > 0 ? `
    <div class="orc-m2">
      <div class="box"><div class="lbl">Área total</div><div class="val">${t.area.toLocaleString("pt-BR")} m²</div></div>
      <div class="box"><div class="lbl">Custo por m² (sem adm.)</div><div class="val">${brl(t.custoM2SemAdm)}</div></div>
    </div>
    <div class="orc-m2" style="margin-top:12px">
      <div class="box dest" style="grid-column:1/-1"><div class="lbl">Custo por m² (com administração)</div><div class="val">${brl(t.custoM2ComAdm)}</div></div>
    </div>` : ""}
  </div>
  ${footer}
</div>
<script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script>
</body></html>`;

  openPrint(html);
}

// ─── Ordem de Compra ───────────────────────────────────────────────────────

export interface OrdemCompraPDFData {
  numero: number;            // número da OC (será formatado com 2 dígitos)
  dataEmissao: string;       // data/hora de geração (ISO ou já formatada)
  obraNome: string;
  obraCodigo: string;
  obraEndereco: string;
  fornecedorNome: string;
  fornecedorId?: string | null;   // identificador (CNPJ/CPF), se houver
  geradoPor: string;
  itens: { descricao: string; unidade?: string | null; quantidade: number; valorUnitario: number }[];
  frete: number;
  observacao?: string | null;
}

/**
 * Exporta o PDF de uma Ordem de Compra (apenas OCs "Gerada").
 * Estrutura de dados desacoplada do layout — o visual final pode ser ajustado
 * depois sem alterar a lógica de montagem/cálculo dos totais.
 */
export function exportOrdemCompraPDF(data: OrdemCompraPDFData): void {
  const config = getPDFConfig();
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const numeroFmt = String(data.numero).padStart(2, "0");
  const docId = `OC #${numeroFmt}`;
  const dataEmissao = (() => {
    const d = new Date(data.dataEmissao);
    return isNaN(d.getTime()) ? data.dataEmissao : d.toLocaleString("pt-BR");
  })();

  const cover = buildCoverPage({
    docType: "Ordem de Compra",
    docTitle: `Ordem de Compra nº ${numeroFmt}`,
    docId,
    obraNome: data.obraNome,
    obraCliente: data.fornecedorNome,
    obraCodigo: data.obraCodigo,
    obraResponsavel: data.geradoPor,
    obraEndereco: data.obraEndereco,
    dataReferencia: `Fornecedor: ${data.fornecedorNome}`,
    config,
  });

  const header = buildPageHeader({
    obraNome: data.obraNome, obraCodigo: data.obraCodigo, docId,
    dataRef: `OC nº ${numeroFmt}`, config,
  });
  const footer = buildPageFooter(docId, data.obraNome);

  const totalItens = data.itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0);
  const totalGeral = totalItens + (data.frete || 0);

  const linhas = data.itens.map(it => `<tr>
    <td>${it.descricao}</td>
    <td style="text-align:center">${it.unidade ?? "—"}</td>
    <td style="text-align:right">${it.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
    <td style="text-align:right">${brl(it.valorUnitario)}</td>
    <td style="text-align:right;font-weight:600">${brl(it.quantidade * it.valorUnitario)}</td>
  </tr>`).join("");

  const fornecedorLinha = [data.fornecedorNome, data.fornecedorId ? `(${data.fornecedorId})` : ""].filter(Boolean).join(" ");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>OC-${numeroFmt}-${data.obraNome}</title><style>${BASE_CSS}
  @page { size: A4 portrait; margin: 0; }
  .oc-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 14px; }
  .oc-meta .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .oc-meta .val { font-size: 13px; font-weight: 600; color: #1e3a5f; }
  .oc-resumo { width: 50%; margin-left: auto; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-top: 14px; }
  .oc-resumo div { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
  .oc-resumo .total { background: #1e3a5f; color: #fff; font-weight: 700; font-size: 14px; }
  .oc-obs { margin-top: 14px; padding: 10px 12px; background: #f9fafb; border-left: 3px solid #1e3a5f; border-radius: 4px; font-size: 12px; }
</style></head><body>
${cover}
<div class="page">
  ${header}
  <div class="section">
    <div class="section-title">Dados da Ordem de Compra</div>
    <div class="oc-meta">
      <div><div class="lbl">Número da OC</div><div class="val">${numeroFmt}</div></div>
      <div><div class="lbl">Data de emissão</div><div class="val">${dataEmissao}</div></div>
      <div><div class="lbl">Obra</div><div class="val">${data.obraNome} (${data.obraCodigo})</div></div>
      <div><div class="lbl">Fornecedor</div><div class="val">${fornecedorLinha}</div></div>
      <div><div class="lbl">Gerado por</div><div class="val">${data.geradoPor || "—"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itens</div>
    <table>
      <thead><tr>
        <th>Insumo / Descrição</th><th style="text-align:center">Un.</th>
        <th style="text-align:right">Qtd.</th><th style="text-align:right">Valor Unit.</th><th style="text-align:right">Valor Total</th>
      </tr></thead>
      <tbody>${linhas || `<tr><td colspan="5" style="color:#666;font-style:italic;padding:10px">Nenhum item</td></tr>`}</tbody>
    </table>

    <div class="oc-resumo">
      <div><span>Subtotal dos itens</span><span>${brl(totalItens)}</span></div>
      <div><span>Frete</span><span>${brl(data.frete || 0)}</span></div>
      <div class="total"><span>TOTAL GERAL</span><span>${brl(totalGeral)}</span></div>
    </div>

    ${data.observacao ? `<div class="oc-obs"><strong>Observações:</strong> ${data.observacao}</div>` : ""}
  </div>
  ${footer}
</div>
<script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script>
</body></html>`;

  openPrint(html);
}
