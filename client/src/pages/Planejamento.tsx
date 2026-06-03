import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2, ArrowLeft, FileDown, FileSpreadsheet, CalendarRange } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { planilhaSimples } from "@/lib/exportUtils";
import { getPDFConfig } from "@/lib/pdfExport";
import { PageHeader } from "@/components/PageHeader";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => { try { return new Date(s + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return s; } };

// ─── Exportações ───────────────────────────────────────────────────────────
function exportarExcel(nome: string, d: any) {
  const wb = XLSX.utils.book_new();
  // EAP
  const eap = [["Código", "Nível", "Descrição", "Responsável"],
    ...(d.eap || []).map((e: any) => [e.codigo, e.nivel, e.descricao, e.responsavel])];
  XLSX.utils.book_append_sheet(wb, planilhaSimples(eap, [12, 8, 50, 24]), "EAP");
  // Cronograma
  const cron = [["ID", "Atividade", "Fase", "Predecessora", "Duração (dias)", "Início", "Fim", "Crítico", "Folga"],
    ...(d.cronograma?.atividades || []).map((a: any) => [a.id, a.descricao, a.fase, a.predecessoras, a.duracaoDias, a.inicio, a.fim, a.critico ? "Sim" : "Não", a.folgaDias])];
  XLSX.utils.book_append_sheet(wb, planilhaSimples(cron, [8, 40, 18, 14, 14, 14, 14, 10, 8]), "Cronograma");
  // Recursos
  const mo = [["Função", "Quantidade", "Regime", "Turnos"],
    ...(d.recursos?.maoDeObra || []).map((m: any) => [m.funcao, m.quantidade, m.regime, m.turnos])];
  XLSX.utils.book_append_sheet(wb, planilhaSimples(mo, [28, 12, 18, 20]), "Mão de Obra");
  const eq = [["Equipamento", "Método", "Período"],
    ...(d.recursos?.equipamentos || []).map((e: any) => [e.nome, e.metodo, e.periodo])];
  XLSX.utils.book_append_sheet(wb, planilhaSimples(eq, [30, 24, 20]), "Equipamentos");
  // Curva S
  const cs = [["Mês", "% no mês", "% acumulado", "Valor acumulado (R$)"],
    ...(d.recursos?.curvaS || []).map((c: any) => [c.mes, c.percentualMes, c.percentualAcumulado, c.valorAcumulado])];
  XLSX.utils.book_append_sheet(wb, planilhaSimples(cs, [12, 12, 14, 22], [3]), "Curva S");
  XLSX.writeFile(wb, `Planejamento_${nome.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
}

function exportarProject(nome: string, d: any) {
  // MS Project XML (MSPDI) — cronograma
  const ativs = d.cronograma?.atividades || [];
  const tasks = ativs.map((a: any, i: number) => {
    const start = a.inicio + "T08:00:00";
    const finish = a.fim + "T17:00:00";
    const horas = (a.duracaoDias || 1) * 8;
    return `    <Task>
      <UID>${i + 1}</UID>
      <ID>${i + 1}</ID>
      <Name>${String(a.descricao).replace(/[<&>]/g, "")}</Name>
      <Type>0</Type>
      <OutlineLevel>1</OutlineLevel>
      <Start>${start}</Start>
      <Finish>${finish}</Finish>
      <Duration>PT${horas}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
    </Task>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${nome}</Name>
  <Tasks>
${tasks}
  </Tasks>
</Project>`;
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Cronograma_${nome.replace(/[^a-z0-9]/gi, "_")}.xml`;
  a.click(); URL.revokeObjectURL(url);
}

function ganttHTMLPdf(ativs: any[]) {
  const v = (ativs || []).filter(a => a.inicio && a.fim);
  if (!v.length) return "<p style='font-size:10px;color:#666'>Sem atividades com datas. Use \"Recalcular datas\" no cronograma.</p>";
  const min = new Date(Math.min(...v.map(a => toDate(a.inicio).getTime())));
  const max = new Date(Math.max(...v.map(a => toDate(a.fim).getTime())));
  const total = Math.max(1, diasEntre(min, max) + 1);
  const BAR = 520, LABEL = 165, ROW = 16;
  const px = (dias: number) => (dias / total) * BAR;
  const tickArr: { left: number; label: string }[] = [];
  const m = new Date(min.getFullYear(), min.getMonth(), 1);
  while (m <= max) { tickArr.push({ left: Math.max(0, diasEntre(min, m)), label: `${String(m.getMonth() + 1).padStart(2, "0")}/${String(m.getFullYear()).slice(2)}` }); m.setMonth(m.getMonth() + 1); }
  const header = `<div style="position:relative;height:13px;margin-left:${LABEL}px;width:${BAR}px;border-bottom:1px solid #ccc">` +
    tickArr.map(t => `<span style="position:absolute;left:${px(t.left)}px;font-size:7px;color:#888;border-left:1px solid #ddd;padding-left:1px">${t.label}</span>`).join("") + `</div>`;
  const rows = v.map(a => {
    const left = px(diasEntre(min, toDate(a.inicio)));
    const w = Math.max(2, px(diasEntre(toDate(a.inicio), toDate(a.fim)) + 1));
    const color = a.critico ? "#dc2626" : "#B45309";
    return `<div style="position:relative;height:${ROW}px;border-bottom:1px solid #f2f2f2">
      <span style="position:absolute;left:0;width:${LABEL - 4}px;font-size:8px;overflow:hidden;white-space:nowrap;line-height:${ROW}px;color:#333">${a.id} ${String(a.descricao || "").slice(0, 34)}</span>
      <span style="position:absolute;left:${LABEL + left}px;top:3px;height:10px;width:${w}px;background:${color};border:1px solid ${color};border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact"></span>
    </div>`;
  }).join("");
  return `<div style="font-size:8px">${header}${rows}<div style="margin-top:5px;font-size:8px;color:#555"><span style="display:inline-block;width:8px;height:8px;background:#dc2626;border-radius:2px;vertical-align:middle"></span> Caminho crítico &nbsp;&nbsp; <span style="display:inline-block;width:8px;height:8px;background:#B45309;border-radius:2px;vertical-align:middle"></span> Atividade com folga</div></div>`;
}

function exportarPDF(nome: string, d: any) {
  const cfg = getPDFConfig();
  const empresa = cfg.empresaNome || "Obra Digital";
  const linha = (txt: string) => `<div style="white-space:pre-wrap;font-size:11px;line-height:1.6;color:#1a1a1a">${txt || "—"}</div>`;
  const tabela = (cols: string[], rows: any[][]) => `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:6px">
    <thead><tr>${cols.map(c => `<th style="background:#1e3a5f;color:#fff;padding:5px;text-align:left">${c}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:5px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const sec = (titulo: string, corpo: string) => `<div style="margin-bottom:18px"><h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:3px;margin-bottom:8px">${titulo}</h2>${corpo}</div>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Planejamento ${nome}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  html,body{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a}
  h1{color:#1e3a5f;font-size:22px}@page{margin:1.5cm}</style></head><body>
  <div style="border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:18px">
    <div style="font-size:11px;color:#B45309;font-weight:700">${empresa}</div>
    <h1>Planejamento de Obra</h1><div style="color:#666;font-size:12px">${nome}</div>
  </div>
  ${sec("Resumo Executivo", linha(d.resumoExecutivo))}
  ${sec("1. EAP — Estrutura Analítica do Projeto", tabela(["Código", "Descrição", "Responsável"], (d.eap || []).map((e: any) => [e.codigo, (e.nivel === 1 ? "<b>" + e.descricao + "</b>" : "&nbsp;&nbsp;" + e.descricao), e.responsavel])))}
  ${sec("2. Cronograma de Obras", tabela(["ID", "Atividade", "Fase", "Dur.", "Pred.", "Início", "Fim", "Folga"], (d.cronograma?.atividades || []).map((a: any) => [a.id, a.descricao, a.fase, a.duracaoDias + "d", a.predecessoras || "—", fmtData(a.inicio), fmtData(a.fim), a.critico ? "<b style='color:#dc2626'>crítica</b>" : (a.folgaDias ?? 0) + "d"])))}
  ${sec("2.1 Gráfico de Gantt", ganttHTMLPdf(d.cronograma?.atividades || []))}
  ${(d.cronograma?.marcos?.length ? sec("2.2 Marcos Contratuais", tabela(["Marco", "Data"], d.cronograma.marcos.map((m: any) => [m.descricao, fmtData(m.data)]))) : "")}
  ${sec("3. Planejamento de Recursos", tabela(["Função", "Qtd", "Regime", "Turnos"], (d.recursos?.maoDeObra || []).map((m: any) => [m.funcao, m.quantidade, m.regime, m.turnos]))
    + tabela(["Equipamento", "Método", "Período"], (d.recursos?.equipamentos || []).map((e: any) => [e.nome, e.metodo, e.periodo]))
    + (d.recursos?.curvaS?.length ? "<p style='font-size:11px;margin-top:8px;font-weight:600'>Curva S de desembolso</p>" + tabela(["Mês", "% mês", "% acum.", "Acumulado"], d.recursos.curvaS.map((c: any) => [c.mes, c.percentualMes + "%", c.percentualAcumulado + "%", brl(c.valorAcumulado)])) : ""))}
  ${(() => { const cg = computeCarga(d.cronograma?.atividades || [], d.recursos?.maoDeObra || []); return cg.length ? sec("3.1 Análise de Carga (Superalocação)", tabela(["Função", "Capacidade", "Pico", "Situação"], cg.map((c: any) => [c.funcao, c.capacidade, c.pico, c.status === "super" ? `Superalocado (pico ${c.pico} > ${c.capacidade})` : c.status === "cheio" ? "Totalmente alocado" : c.status === "sub" ? `Subutilizado (${c.pico}/${c.capacidade})` : "Ocioso"]))) : ""; })()}
  ${(() => { const linhas = (d.cronograma?.atividades || []).filter((a: any) => (a.alocacoes || []).length).map((a: any) => [`${a.id} ${a.descricao}`, (a.alocacoes || []).map((al: any) => `${al.funcao} (${al.quantidade})`).join(", ")]); return linhas.length ? sec("3.2 Alocação de Equipe por Atividade", tabela(["Atividade", "Equipe alocada"], linhas)) : ""; })()}
  ${sec("4. Suprimentos e Compras", linha(d.suprimentos))}
  ${sec("5. Plano de Qualidade", linha(d.qualidade))}
  ${sec("6. Saúde, Segurança e Medicina do Trabalho", linha(d.ssmt))}
  ${sec("7. Plano Ambiental e Resíduos (PGRCC)", linha(d.ambiental))}
  ${sec("8. Mobilização e Canteiro de Obras", linha(d.canteiro))}
  ${sec("9. Linha de Base, Indicadores e Controle", linha(d.controle))}
  ${sec("10. Riscos e Plano de Contingência", linha(d.riscos))}
  <script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Permita pop-ups para exportar PDF"); return; }
  w.document.write(html); w.document.close();
}

// ─── Agendamento automático (CPM) ───────────────────────────────────────────
const diasEntre = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const addDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toDate = (s: string) => new Date((s || "") + "T12:00:00");
const fmtISO = (d: Date) => d.toISOString().split("T")[0];

function calcularCronograma(ativs: any[], projStartISO: string) {
  if (!ativs.length) return ativs;
  const start = toDate(projStartISO || new Date().toISOString().split("T")[0]);
  const byId: Record<string, any> = {};
  ativs.forEach(a => { byId[String(a.id)] = a; });
  const preds = (a: any) => String(a.predecessoras || "").split(/[,;\s]+/).map(s => s.trim())
    .filter(Boolean).filter(pid => byId[pid] && pid !== String(a.id));
  // ordenação topológica (com proteção contra ciclos)
  const order: any[] = []; const vis: Record<string, number> = {}; const tmp: Record<string, number> = {};
  const visit = (a: any) => {
    const k = String(a.id);
    if (vis[k] || tmp[k]) return;
    tmp[k] = 1; preds(a).forEach(pid => visit(byId[pid])); tmp[k] = 0; vis[k] = 1; order.push(a);
  };
  ativs.forEach(visit);
  // passada para frente
  const ES: Record<string, number> = {}, EF: Record<string, number> = {};
  for (const a of order) {
    const k = String(a.id); const dur = Math.max(1, a.duracaoDias || 1); const ps = preds(a);
    let es: number;
    if (a.travado && a.inicio) es = diasEntre(start, toDate(a.inicio));
    else if (ps.length === 0) es = 0;
    else es = Math.max(...ps.map(pid => (EF[pid] ?? 0) + 1));
    if (es < 0) es = 0;
    ES[k] = es; EF[k] = es + dur - 1;
  }
  const projEF = Math.max(0, ...order.map(a => EF[String(a.id)] ?? 0));
  // passada para trás (folga / caminho crítico)
  const LS: Record<string, number> = {};
  const succs: Record<string, string[]> = {};
  order.forEach(a => preds(a).forEach(pid => { (succs[pid] = succs[pid] || []).push(String(a.id)); }));
  for (let i = order.length - 1; i >= 0; i--) {
    const a = order[i]; const k = String(a.id); const dur = Math.max(1, a.duracaoDias || 1);
    const ss = succs[k] || [];
    const lf = ss.length ? Math.min(...ss.map(sid => (LS[sid] ?? projEF) - 1)) : projEF;
    LS[k] = lf - dur + 1;
  }
  return ativs.map(a => {
    const k = String(a.id); const folga = Math.max(0, (LS[k] ?? ES[k] ?? 0) - (ES[k] ?? 0));
    return { ...a, inicio: fmtISO(addDias(start, ES[k] || 0)), fim: fmtISO(addDias(start, EF[k] || 0)), folgaDias: folga, critico: folga <= 0 };
  });
}

// ─── Análise de carga / superalocação ───────────────────────────────────────
function computeCarga(ativs: any[], maoDeObra: any[]) {
  const funcoes = (maoDeObra || []).filter(m => m.funcao).map(m => ({ funcao: m.funcao, capacidade: Number(m.quantidade) || 0 }));
  return funcoes.map(f => {
    const eventos: { t: number; q: number }[] = [];
    (ativs || []).forEach(a => {
      if (!a.inicio || !a.fim) return;
      const al = (a.alocacoes || []).find((x: any) => x.funcao === f.funcao);
      const q = al ? Number(al.quantidade) || 0 : 0;
      if (q > 0) {
        eventos.push({ t: toDate(a.inicio).getTime(), q });
        eventos.push({ t: addDias(toDate(a.fim), 1).getTime(), q: -q });
      }
    });
    eventos.sort((x, y) => x.t - y.t || x.q - y.q);
    let cur = 0, pico = 0, picoT: number | null = null;
    for (const e of eventos) { cur += e.q; if (cur > pico) { pico = cur; picoT = e.t; } }
    let status: "super" | "cheio" | "sub" | "ocioso";
    if (pico === 0) status = "ocioso";
    else if (pico > f.capacidade) status = "super";
    else if (pico === f.capacidade) status = "cheio";
    else status = "sub";
    return { ...f, pico, picoData: picoT ? fmtISO(new Date(picoT)) : null, status };
  });
}

// ─── Gráfico de Gantt ────────────────────────────────────────────────────────
function Gantt({ ativs }: { ativs: any[] }) {
  const validas = (ativs || []).filter(a => a.inicio && a.fim);
  if (!validas.length) return <p className="p-4 text-sm text-muted-foreground">Sem atividades com datas. Adicione atividades e clique em <b>Recalcular datas</b>.</p>;
  const min = new Date(Math.min(...validas.map(a => toDate(a.inicio).getTime())));
  const max = new Date(Math.max(...validas.map(a => toDate(a.fim).getTime())));
  const total = Math.max(1, diasEntre(min, max) + 1);
  const DAY = total > 365 ? 3 : total > 120 ? 5 : 9; // px por dia
  const chartW = total * DAY;
  const LABEL = 220;
  // marcas de mês
  const ticks: { left: number; label: string }[] = [];
  const m = new Date(min.getFullYear(), min.getMonth(), 1);
  while (m <= max) {
    ticks.push({ left: Math.max(0, diasEntre(min, m)) * DAY, label: `${String(m.getMonth() + 1).padStart(2, "0")}/${String(m.getFullYear()).slice(2)}` });
    m.setMonth(m.getMonth() + 1);
  }
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LABEL + chartW + 16 }} className="text-xs">
        {/* cabeçalho de meses */}
        <div className="flex border-b sticky top-0 bg-background">
          <div style={{ width: LABEL }} className="shrink-0 p-2 font-medium text-muted-foreground">Atividade</div>
          <div className="relative" style={{ width: chartW, height: 28 }}>
            {ticks.map((t, i) => (
              <div key={i} className="absolute top-0 h-full border-l border-border/60 pl-1 text-[10px] text-muted-foreground" style={{ left: t.left }}>{t.label}</div>
            ))}
          </div>
        </div>
        {/* linhas */}
        {validas.map((a, i) => {
          const ini = toDate(a.inicio), fim = toDate(a.fim);
          const left = diasEntre(min, ini) * DAY;
          const w = Math.max(DAY, (diasEntre(ini, fim) + 1) * DAY);
          return (
            <div key={i} className="flex items-center border-b last:border-0 hover:bg-muted/20" style={{ height: 30 }}>
              <div style={{ width: LABEL }} className="shrink-0 px-2 truncate" title={a.descricao}>
                <span className="text-muted-foreground mr-1">{a.id}</span>{a.descricao}
              </div>
              <div className="relative" style={{ width: chartW, height: "100%" }}>
                {ticks.map((t, j) => (<div key={j} className="absolute top-0 h-full border-l border-border/30" style={{ left: t.left }} />))}
                <div className="absolute rounded shadow-sm flex items-center" title={`${a.descricao} · ${fmtData(a.inicio)} → ${fmtData(a.fim)} · ${a.duracaoDias}d${a.critico ? " · CRÍTICA" : ` · folga ${a.folgaDias}d`}`}
                  style={{ left, width: w, top: 6, height: 18, background: a.critico ? "#dc2626" : "#B45309", opacity: 0.92 }}>
                  <span className="text-[10px] text-white px-1 truncate">{a.duracaoDias}d</span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex gap-4 p-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "#dc2626" }} /> Caminho crítico (folga zero)</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: "#B45309" }} /> Atividade com folga</span>
        </div>
      </div>
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────
function Editor({ id, onBack }: { id: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.planejamento.getById.useQuery({ id });
  const [dados, setDados] = useState<any>(null);
  const save = trpc.planejamento.updateDados.useMutation({
    onSuccess: () => { toast.success("Planejamento salvo!"); utils.planejamento.getById.invalidate({ id }); },
  });

  useEffect(() => { if (data?.dados) setDados(data.dados); }, [data]);

  if (isLoading || !dados) return <div className="flex justify-center py-10"><Spinner /></div>;
  const nome = data?.nome || "Planejamento";
  const projInicio = (data as any)?.dataInicio ? String((data as any).dataInicio).split("T")[0] : new Date().toISOString().split("T")[0];
  const setTexto = (campo: string, v: string) => setDados((p: any) => ({ ...p, [campo]: v }));
  const recalcular = () => setAtiv(arr => calcularCronograma(arr, projInicio));
  const setAtivAloc = (i: number, fn: (a: any[]) => any[]) => setAtiv(arr => arr.map((a, idx) => idx === i ? { ...a, alocacoes: fn(a.alocacoes || []) } : a));
  const cargaList = computeCarga(dados.cronograma?.atividades || [], dados.recursos?.maoDeObra || []);
  const funcoesDisp = (dados.recursos?.maoDeObra || []).filter((m: any) => m.funcao);

  // ── Helpers de edição das tabelas ──
  const cellCls = "h-8 border-0 shadow-none px-2 focus-visible:ring-1 focus-visible:ring-primary/40 rounded";
  const setEap = (fn: (a: any[]) => any[]) => setDados((p: any) => ({ ...p, eap: fn(p.eap || []) }));
  const setAtiv = (fn: (a: any[]) => any[]) => setDados((p: any) => ({ ...p, cronograma: { ...(p.cronograma || {}), atividades: fn(p.cronograma?.atividades || []) } }));
  const setMarcos = (fn: (a: any[]) => any[]) => setDados((p: any) => ({ ...p, cronograma: { ...(p.cronograma || {}), marcos: fn(p.cronograma?.marcos || []) } }));
  const setMO = (fn: (a: any[]) => any[]) => setDados((p: any) => ({ ...p, recursos: { ...(p.recursos || {}), maoDeObra: fn(p.recursos?.maoDeObra || []) } }));
  const setEq = (fn: (a: any[]) => any[]) => setDados((p: any) => ({ ...p, recursos: { ...(p.recursos || {}), equipamentos: fn(p.recursos?.equipamentos || []) } }));
  const setCurva = (fn: (a: any[]) => any[]) => setDados((p: any) => ({ ...p, recursos: { ...(p.recursos || {}), curvaS: fn(p.recursos?.curvaS || []) } }));
  const edit = (arr: any[], i: number, campo: string, v: any) => arr.map((r, idx) => idx === i ? { ...r, [campo]: v } : r);
  const del = (arr: any[], i: number) => arr.filter((_, idx) => idx !== i);

  const secoesTexto: [string, string, string][] = [
    ["suprimentos", "4. Suprimentos e Compras", dados.suprimentos],
    ["qualidade", "5. Plano de Qualidade", dados.qualidade],
    ["ssmt", "6. SSMT (Segurança)", dados.ssmt],
    ["ambiental", "7. Ambiental / Resíduos", dados.ambiental],
    ["canteiro", "8. Mobilização e Canteiro", dados.canteiro],
    ["controle", "9. Indicadores e Controle", dados.controle],
    ["riscos", "10. Riscos e Contingência", dados.riscos],
  ];

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{nome}</h3>
          <p className="text-sm text-muted-foreground">Prazo estimado: {dados.prazoTotalDias} dias · {dados.cronograma?.atividades?.length || 0} atividades</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarPDF(nome, dados)}><FileDown className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarExcel(nome, dados)}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarProject(nome, dados)}><CalendarRange className="w-4 h-4" /> Project</Button>
          <Button size="sm" onClick={() => save.mutate({ id, dados })} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="eap" className="text-xs">EAP</TabsTrigger>
          <TabsTrigger value="cronograma" className="text-xs">Cronograma</TabsTrigger>
          <TabsTrigger value="recursos" className="text-xs">Recursos</TabsTrigger>
          <TabsTrigger value="alocacao" className="text-xs">Alocação</TabsTrigger>
          <TabsTrigger value="textos" className="text-xs">Planos (4-10)</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4">
          <Card><CardContent className="py-4">
            <Textarea className="min-h-[300px] font-mono text-xs" value={dados.resumoExecutivo}
              onChange={e => setTexto("resumoExecutivo", e.target.value)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="eap" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="text-left p-2 pl-4 w-24">Código</th><th className="text-center p-2 w-16">Nível</th><th className="text-left p-2">Descrição</th><th className="text-left p-2 w-44">Responsável</th><th className="w-10"></th>
              </tr></thead>
              <tbody>
                {(dados.eap || []).map((e: any, i: number) => (
                  <tr key={i} className={`border-b last:border-0 ${e.nivel === 1 ? "bg-primary/5" : ""}`}>
                    <td className="p-1 pl-3"><Input className={cellCls} value={e.codigo ?? ""} onChange={ev => setEap(a => edit(a, i, "codigo", ev.target.value))} /></td>
                    <td className="p-1"><Input type="number" min={1} className={cellCls + " text-center"} value={e.nivel ?? 1} onChange={ev => setEap(a => edit(a, i, "nivel", parseInt(ev.target.value) || 1))} /></td>
                    <td className="p-1"><Input className={cellCls + (e.nivel === 1 ? " font-semibold" : "")} value={e.descricao ?? ""} onChange={ev => setEap(a => edit(a, i, "descricao", ev.target.value))} /></td>
                    <td className="p-1"><Input className={cellCls} value={e.responsavel ?? ""} onChange={ev => setEap(a => edit(a, i, "responsavel", ev.target.value))} /></td>
                    <td className="p-1 text-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEap(a => del(a, i))}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEap(a => [...a, { codigo: "", nivel: 2, descricao: "", responsavel: "" }])}><Plus className="w-4 h-4" /> Adicionar item</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cronograma" className="mt-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">Defina <b>duração</b> e <b>predecessoras</b> (IDs separados por vírgula) e clique em <b>Recalcular datas</b>. Use o cadeado 🔒 para fixar uma data manualmente.</p>
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={recalcular}><CalendarRange className="w-4 h-4" /> Recalcular datas</Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="text-left p-2 pl-3 w-14">ID</th><th className="text-left p-2">Atividade</th><th className="text-left p-2 w-32">Fase</th>
                <th className="text-center p-2 w-16">Dur.</th><th className="text-left p-2 w-24">Pred.</th><th className="text-left p-2 w-36">Início</th><th className="text-left p-2 w-36">Fim</th><th className="text-center p-2 w-16">Folga</th><th className="w-10"></th>
              </tr></thead>
              <tbody>
                {(dados.cronograma?.atividades || []).map((a: any, i: number) => (
                  <tr key={i} className={`border-b last:border-0 ${a.critico ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                    <td className="p-1 pl-3"><Input className={cellCls} value={a.id ?? ""} onChange={ev => setAtiv(arr => edit(arr, i, "id", ev.target.value))} /></td>
                    <td className="p-1"><Input className={cellCls} value={a.descricao ?? ""} onChange={ev => setAtiv(arr => edit(arr, i, "descricao", ev.target.value))} /></td>
                    <td className="p-1"><Input className={cellCls} value={a.fase ?? ""} onChange={ev => setAtiv(arr => edit(arr, i, "fase", ev.target.value))} /></td>
                    <td className="p-1"><Input type="number" min={0} className={cellCls + " text-center"} value={a.duracaoDias ?? 0} onChange={ev => setAtiv(arr => edit(arr, i, "duracaoDias", parseInt(ev.target.value) || 0))} /></td>
                    <td className="p-1"><Input className={cellCls} placeholder="ex: 1,2" value={a.predecessoras ?? ""} onChange={ev => setAtiv(arr => edit(arr, i, "predecessoras", ev.target.value))} /></td>
                    <td className="p-1"><div className="flex items-center gap-1">
                      <Input type="date" className={cellCls} value={a.inicio ?? ""} onChange={ev => setAtiv(arr => edit(arr, i, "inicio", ev.target.value).map((x, idx) => idx === i ? { ...x, travado: true } : x))} />
                      <button type="button" title={a.travado ? "Data fixada — clique para liberar" : "Data automática — clique para fixar"} className={`shrink-0 text-xs ${a.travado ? "" : "opacity-40"}`} onClick={() => setAtiv(arr => edit(arr, i, "travado", !a.travado))}>{a.travado ? "🔒" : "🔓"}</button>
                    </div></td>
                    <td className="p-1"><Input type="date" className={cellCls} value={a.fim ?? ""} onChange={ev => setAtiv(arr => edit(arr, i, "fim", ev.target.value))} /></td>
                    <td className="p-1 text-center text-xs">{a.critico ? <span className="text-red-600 font-medium">crítica</span> : <span className="text-muted-foreground">{a.folgaDias ?? 0}d</span>}</td>
                    <td className="p-1 text-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAtiv(arr => del(arr, i))}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3 border-t"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAtiv(arr => [...arr, { id: String(arr.length + 1), descricao: "", fase: "", duracaoDias: 1, predecessoras: arr.length ? String(arr.length) : "", inicio: "", fim: "", critico: false, folgaDias: 0 }])}><Plus className="w-4 h-4" /> Adicionar atividade</Button></div>
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <p className="text-sm font-medium mb-2">Gráfico de Gantt</p>
            <Gantt ativs={dados.cronograma?.atividades || []} />
          </CardContent></Card>
          <Card><CardContent className="py-3">
            <p className="text-sm font-medium mb-2">Marcos contratuais</p>
            <div className="space-y-2">
              {(dados.cronograma?.marcos || []).map((m: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input className="h-8 flex-1" placeholder="Descrição do marco" value={m.descricao ?? ""} onChange={ev => setMarcos(arr => edit(arr, i, "descricao", ev.target.value))} />
                  <Input type="date" className="h-8 w-40" value={m.data ?? ""} onChange={ev => setMarcos(arr => edit(arr, i, "data", ev.target.value))} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setMarcos(arr => del(arr, i))}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => setMarcos(arr => [...arr, { descricao: "", data: "" }])}><Plus className="w-4 h-4" /> Adicionar marco</Button>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="recursos" className="mt-4 space-y-3">
          <Card><CardContent className="p-0 overflow-x-auto">
            <p className="text-sm font-medium p-3 pb-1">Mão de obra</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-3">Função</th><th className="text-center p-2 w-20">Qtd</th><th className="text-left p-2 w-36">Regime</th><th className="text-left p-2 w-40">Turnos</th><th className="w-10"></th></tr></thead>
              <tbody>{(dados.recursos?.maoDeObra || []).map((m: any, i: number) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1 pl-3"><Input className={cellCls} value={m.funcao ?? ""} onChange={ev => setMO(a => edit(a, i, "funcao", ev.target.value))} /></td>
                  <td className="p-1"><Input type="number" min={0} className={cellCls + " text-center"} value={m.quantidade ?? 0} onChange={ev => setMO(a => edit(a, i, "quantidade", parseInt(ev.target.value) || 0))} /></td>
                  <td className="p-1"><Input className={cellCls} value={m.regime ?? ""} onChange={ev => setMO(a => edit(a, i, "regime", ev.target.value))} /></td>
                  <td className="p-1"><Input className={cellCls} value={m.turnos ?? ""} onChange={ev => setMO(a => edit(a, i, "turnos", ev.target.value))} /></td>
                  <td className="p-1 text-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setMO(a => del(a, i))}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="p-3 border-t"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMO(a => [...a, { funcao: "", quantidade: 1, regime: "CLT", turnos: "1 turno" }])}><Plus className="w-4 h-4" /> Adicionar função</Button></div>
          </CardContent></Card>
          <Card><CardContent className="p-0 overflow-x-auto">
            <p className="text-sm font-medium p-3 pb-1">Equipamentos</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-3">Equipamento</th><th className="text-left p-2">Método</th><th className="text-left p-2 w-40">Período</th><th className="w-10"></th></tr></thead>
              <tbody>{(dados.recursos?.equipamentos || []).map((e: any, i: number) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1 pl-3"><Input className={cellCls} value={e.nome ?? ""} onChange={ev => setEq(a => edit(a, i, "nome", ev.target.value))} /></td>
                  <td className="p-1"><Input className={cellCls} value={e.metodo ?? ""} onChange={ev => setEq(a => edit(a, i, "metodo", ev.target.value))} /></td>
                  <td className="p-1"><Input className={cellCls} value={e.periodo ?? ""} onChange={ev => setEq(a => edit(a, i, "periodo", ev.target.value))} /></td>
                  <td className="p-1 text-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEq(a => del(a, i))}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="p-3 border-t"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEq(a => [...a, { nome: "", metodo: "", periodo: "" }])}><Plus className="w-4 h-4" /> Adicionar equipamento</Button></div>
          </CardContent></Card>
          <Card><CardContent className="p-0 overflow-x-auto">
            <p className="text-sm font-medium p-3 pb-1">Curva S de desembolso</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-3 w-28">Mês</th><th className="text-right p-2 w-24">% mês</th><th className="text-right p-2 w-24">% acum.</th><th className="text-right p-2">Acumulado (R$)</th><th className="w-10"></th></tr></thead>
              <tbody>{(dados.recursos?.curvaS || []).map((c: any, i: number) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="p-1 pl-3"><Input className={cellCls} value={c.mes ?? ""} onChange={ev => setCurva(a => edit(a, i, "mes", ev.target.value))} /></td>
                  <td className="p-1"><Input type="number" step="0.01" className={cellCls + " text-right"} value={c.percentualMes ?? 0} onChange={ev => setCurva(a => edit(a, i, "percentualMes", parseFloat(ev.target.value) || 0))} /></td>
                  <td className="p-1"><Input type="number" step="0.01" className={cellCls + " text-right"} value={c.percentualAcumulado ?? 0} onChange={ev => setCurva(a => edit(a, i, "percentualAcumulado", parseFloat(ev.target.value) || 0))} /></td>
                  <td className="p-1"><Input type="number" step="0.01" className={cellCls + " text-right"} value={c.valorAcumulado ?? 0} onChange={ev => setCurva(a => edit(a, i, "valorAcumulado", parseFloat(ev.target.value) || 0))} /></td>
                  <td className="p-1 text-center"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCurva(a => del(a, i))}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="p-3 border-t"><Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCurva(a => [...a, { mes: "", percentualMes: 0, percentualAcumulado: 0, valorAcumulado: 0 }])}><Plus className="w-4 h-4" /> Adicionar mês</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="alocacao" className="mt-4 space-y-3">
          <Card><CardContent className="py-3">
            <p className="text-sm font-medium mb-1">Análise de carga (superalocação)</p>
            <p className="text-xs text-muted-foreground mb-3">Compara a <b>capacidade</b> de cada função (cadastrada em Recursos) com o <b>pico de demanda</b> simultânea entre as atividades. Recalcule as datas do cronograma antes de analisar.</p>
            {cargaList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cadastre a mão de obra na aba <b>Recursos</b> para habilitar a análise.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-3">Função</th><th className="text-center p-2 w-24">Capacidade</th><th className="text-center p-2 w-28">Pico demanda</th><th className="text-left p-2 w-64">Situação</th></tr></thead>
                <tbody>
                  {cargaList.map((c: any, i: number) => {
                    const cor = c.status === "super" ? "text-red-600" : c.status === "cheio" ? "text-amber-600" : c.status === "sub" ? "text-emerald-600" : "text-muted-foreground";
                    const txt = c.status === "super" ? `⚠️ Superalocado — pico ${c.pico} excede ${c.capacidade}${c.picoData ? ` (em ${fmtData(c.picoData)})` : ""}`
                      : c.status === "cheio" ? `Totalmente alocado (${c.pico}/${c.capacidade})`
                      : c.status === "sub" ? `Subutilizado — pico ${c.pico} de ${c.capacidade}`
                      : "Ocioso — não alocado a nenhuma atividade";
                    return (
                      <tr key={i} className={`border-b last:border-0 ${c.status === "super" ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                        <td className="p-2 pl-3">{c.funcao}</td>
                        <td className="text-center p-2">{c.capacidade}</td>
                        <td className="text-center p-2 font-medium">{c.pico}</td>
                        <td className={`p-2 text-xs ${cor}`}>{txt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent></Card>

          <Card><CardContent className="p-0">
            <p className="text-sm font-medium p-3 pb-1">Alocação de equipe por atividade</p>
            {(dados.cronograma?.atividades || []).length === 0 ? (
              <p className="text-sm text-muted-foreground p-3 pt-0">Adicione atividades na aba <b>Cronograma</b> primeiro.</p>
            ) : (dados.cronograma?.atividades || []).map((a: any, i: number) => (
              <div key={i} className="border-t p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="text-sm"><span className="text-muted-foreground mr-1">{a.id}</span><b>{a.descricao || "(sem nome)"}</b>
                    {a.inicio && a.fim ? <span className="text-xs text-muted-foreground ml-2">{fmtData(a.inicio)} → {fmtData(a.fim)} · {a.duracaoDias}d</span> : null}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7" disabled={funcoesDisp.length === 0}
                    onClick={() => setAtivAloc(i, arr => [...arr, { funcao: funcoesDisp[0]?.funcao || "", quantidade: 1 }])}><Plus className="w-3.5 h-3.5" /> Alocar função</Button>
                </div>
                {(a.alocacoes || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma função alocada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(a.alocacoes || []).map((al: any, j: number) => (
                      <div key={j} className="flex items-center gap-2">
                        <Select value={al.funcao || ""} onValueChange={v => setAtivAloc(i, arr => edit(arr, j, "funcao", v))}>
                          <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Função" /></SelectTrigger>
                          <SelectContent>{funcoesDisp.map((m: any, k: number) => <SelectItem key={k} value={m.funcao}>{m.funcao}</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min={1} className="h-8 w-24" value={al.quantidade ?? 1} onChange={ev => setAtivAloc(i, arr => edit(arr, j, "quantidade", parseInt(ev.target.value) || 0))} />
                        <span className="text-xs text-muted-foreground">pessoa(s)</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAtivAloc(i, arr => del(arr, j))}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="textos" className="mt-4 space-y-4">
          {secoesTexto.map(([campo, titulo, valor]) => (
            <Card key={campo}><CardContent className="py-4">
              <p className="text-sm font-semibold mb-2">{titulo}</p>
              <Textarea className="min-h-[160px] font-mono text-xs" value={valor}
                onChange={e => setTexto(campo, e.target.value)} />
            </CardContent></Card>
          ))}
          <p className="text-xs text-muted-foreground">Edite os textos conforme a obra e clique em "Salvar" no topo.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Modal criar ───────────────────────────────────────────────────────────
function NovoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const { data: orcamentos = [] } = trpc.planejamento.orcamentosDisponiveis.useQuery(undefined, { enabled: open });
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [origem, setOrigem] = useState<"orcamento" | "branco">("orcamento");
  const [orcamentoId, setOrcamentoId] = useState<string>("");

  const createMut = trpc.planejamento.create.useMutation({
    onSuccess: (r: any) => { toast.success("Planejamento criado!"); onCreated(r.id); reset(); },
    onError: (e) => toast.error(e.message || "Erro ao criar"),
  });
  const reset = () => { setNome(""); setOrigem("orcamento"); setOrcamentoId(""); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Planejamento</DialogTitle>
          <DialogDescription>Crie a partir de um orçamento pronto ou em branco.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do planejamento *</Label>
            <Input placeholder="Ex: Planejamento Residência Silva" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Base do planejamento</Label>
            <Select value={origem} onValueChange={v => setOrigem(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="orcamento">📋 A partir de um orçamento pronto</SelectItem>
                <SelectItem value="branco">📄 Começar em branco</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {origem === "orcamento" && (
            <div className="space-y-1.5">
              <Label>Orçamento *</Label>
              {orcamentos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground bg-muted/30">
                  Nenhum orçamento cadastrado ainda. Vá em <strong>Orçamentos → Novo Orçamento</strong>, crie e salve um orçamento — depois ele aparecerá aqui. Ou escolha <strong>"Começar em branco"</strong> acima.
                </div>
              ) : (
                <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o orçamento" /></SelectTrigger>
                  <SelectContent>
                    {(orcamentos as any[]).map(o => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.nome}{o.clienteNome ? ` — ${o.clienteNome}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={createMut.isPending || !nome || (origem === "orcamento" && !orcamentoId)}
              onClick={() => createMut.mutate({ nome, dataInicio, orcamentoId: origem === "orcamento" ? parseInt(orcamentoId) : undefined })}>
              {createMut.isPending ? "Gerando..." : "Criar planejamento"}
            </Button>
            <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────
export default function Planejamento() {
  const [sel, setSel] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const { data: lista = [], isLoading, refetch } = trpc.planejamento.list.useQuery();
  const delMut = trpc.planejamento.delete.useMutation({ onSuccess: () => { toast.success("Excluído"); refetch(); } });

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        {sel ? (
          <Editor id={sel} onBack={() => { setSel(null); refetch(); }} />
        ) : (
          <>
            <PageHeader
              title="Planejamento"
              description="Planeje a obra a partir de um orçamento pronto ou do zero"
              icon={ClipboardList}
              actions={<Button className="gap-2" onClick={() => setModal(true)}><Plus className="w-4 h-4" /> Novo Planejamento</Button>}
            />
            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (lista as any[]).length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground mb-4">Nenhum planejamento criado ainda</p>
                <Button onClick={() => setModal(true)} className="gap-2"><Plus className="w-4 h-4" /> Criar primeiro planejamento</Button>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {(lista as any[]).map(p => (
                  <Card key={p.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setSel(p.id)}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-sm text-muted-foreground">Início: {p.dataInicio ? fmtData(p.dataInicio) : "—"}{p.orcamentoId ? " · gerado de orçamento" : " · em branco"}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${p.nome}"?`)) delMut.mutate({ id: p.id }); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <NovoModal open={modal} onClose={() => setModal(false)} onCreated={(id) => { setModal(false); refetch(); setSel(id); }} />
    </DashboardLayout>
  );
}
