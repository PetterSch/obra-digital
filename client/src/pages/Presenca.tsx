import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, CalendarCheck, Users, UserCheck, FileDown, FileSpreadsheet, Activity } from "lucide-react";
import { getPDFConfig } from "@/lib/pdfExport";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const z2 = (n: number) => String(n).padStart(2, "0");

export default function Presenca() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/obras/:obraId/presenca");
  const obraId = params?.obraId ? parseInt(params.obraId) : null;
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1); // 1-12
  const [equipeSel, setEquipeSel] = useState<string>("");
  const [operarioSel, setOperarioSel] = useState<string>("");

  const { data: obra } = trpc.obras.getById.useQuery({ id: obraId! }, { enabled: !!obraId });
  const { data, isLoading } = trpc.presenca.calendario.useQuery({ obraId: obraId!, ano, mes }, { enabled: !!obraId });

  const equipes = (data?.equipes || []) as any[];
  const dias = (data?.dias || []) as any[];
  const equipeAtual = equipes.find((e) => String(e.id) === equipeSel);
  const operarios = equipeAtual?.colaboradores || [];

  const mudarMes = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMes(m); setAno(a);
  };

  // Média de presença por equipe (média de presentes nos dias em que a equipe teve registro)
  const mediaEquipe = (eqId: number) => {
    const diasEq = dias.filter((d) => d.porEquipe[eqId]);
    if (!diasEq.length) return 0;
    return diasEq.reduce((s, d) => s + d.porEquipe[eqId].presentes, 0) / diasEq.length;
  };

  // Monta a grade do calendário
  const primeiroDia = new Date(ano, mes - 1, 1).getDay(); // 0=Dom
  const totalDias = new Date(ano, mes, 0).getDate();
  const celulas: (number | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  const diaPresente = (dia: number): { presente: boolean; qtd: number } => {
    if (!equipeSel) return { presente: false, qtd: 0 };
    const dataStr = `${ano}-${z2(mes)}-${z2(dia)}`;
    const reg = dias.find((d) => d.data === dataStr);
    const pe = reg?.porEquipe?.[Number(equipeSel)];
    if (!pe) return { presente: false, qtd: 0 };
    if (operarioSel) {
      return { presente: pe.operarios.includes(Number(operarioSel)), qtd: 1 };
    }
    return { presente: pe.presentes > 0, qtd: pe.presentes };
  };

  const totalEq = equipeAtual?.totalColaboradores || 0;
  const hojeStr = `${hoje.getFullYear()}-${z2(hoje.getMonth() + 1)}-${z2(hoje.getDate())}`;
  const shadeDia = (qtd: number) => {
    if (operarioSel) return "bg-emerald-500 text-white border-emerald-600";
    const r = totalEq ? qtd / totalEq : 1;
    if (r >= 0.9) return "bg-emerald-600 text-white border-emerald-700";
    if (r >= 0.6) return "bg-emerald-500 text-white border-emerald-600";
    if (r >= 0.3) return "bg-emerald-400 text-white border-emerald-500";
    return "bg-emerald-200 text-emerald-900 border-emerald-300";
  };

  const mediaGeral = equipes.length ? equipes.reduce((s, e) => s + mediaEquipe(e.id), 0) / equipes.length : 0;
  const totalCadastrados = equipes.reduce((s, e) => s + (e.totalColaboradores || 0), 0);

  // Monta HTML do calendário (para o PDF)
  const calendarioHTML = (eqId: number | null, opId: number | null) => {
    let html = `<table style="width:100%;max-width:480px;border-collapse:separate;border-spacing:4px;table-layout:fixed">
      <thead><tr>${DIAS_SEMANA.map(d => `<th style="font-size:9px;color:#888;padding:2px">${d}</th>`).join("")}</tr></thead><tbody><tr>`;
    let col = 0;
    for (let i = 0; i < primeiroDia; i++) { html += `<td></td>`; col++; }
    for (let d = 1; d <= totalDias; d++) {
      const dataStr = `${ano}-${z2(mes)}-${z2(d)}`;
      const reg = dias.find((x) => x.data === dataStr);
      let presente = false, num = 0;
      if (eqId == null) {
        const eqsDia = reg ? Object.keys(reg.porEquipe || {}) : [];
        presente = eqsDia.length > 0; num = eqsDia.length;
      } else {
        const pe = reg?.porEquipe?.[eqId];
        presente = pe ? (opId ? pe.operarios.includes(opId) : pe.presentes > 0) : false;
        num = pe?.presentes || 0;
      }
      const bg = presente ? "#10b981" : "#f3f3f3";
      const cor = presente ? "#fff" : "#aaa";
      const sub = presente && !opId ? `<div style="font-size:8px;font-weight:400">${num}</div>` : "";
      html += `<td style="background:${bg};color:${cor};text-align:center;padding:7px 2px;border-radius:6px;font-size:11px;font-weight:600;-webkit-print-color-adjust:exact;print-color-adjust:exact">${d}${sub}</td>`;
      col++;
      if (col % 7 === 0) html += `</tr><tr>`;
    }
    html += `</tr></tbody></table>`;
    return html;
  };

  const exportarPDF = () => {
    const cfg = getPDFConfig();
    const empresa = cfg.empresaNome || "Obra Digital";
    const linhasMedia = equipes.map((e) => {
      const m = mediaEquipe(e.id);
      const pct = e.totalColaboradores ? Math.round((m / e.totalColaboradores) * 100) : 0;
      return `<tr><td style="padding:5px;border-bottom:1px solid #eee">${e.nome}</td>
        <td style="padding:5px;border-bottom:1px solid #eee;text-align:center">${e.totalColaboradores}</td>
        <td style="padding:5px;border-bottom:1px solid #eee;text-align:center">${m.toFixed(1).replace(".0", "")}</td>
        <td style="padding:5px;border-bottom:1px solid #eee;text-align:center">${pct}%</td></tr>`;
    }).join("");
    const tituloCal = equipeAtual
      ? `Calendário — ${equipeAtual.nome}${operarioSel ? " · " + (operarios.find((o: any) => String(o.id) === operarioSel)?.nome || "") : ""}`
      : "Calendário — Dias com equipes em obra";
    const legendaCal = equipeAtual
      ? (operarioSel ? "Verde = operário presente" : "Verde = equipe presente (nº = presentes)")
      : "Verde = houve equipe(s) em obra (nº = equipes no dia)";
    const calHtml = `<h2 style="font-size:13px;color:#1e3a5f;margin:18px 0 8px">${tituloCal}</h2>${calendarioHTML(equipeAtual ? Number(equipeSel) : null, operarioSel ? Number(operarioSel) : null)}
      <p style="font-size:10px;color:#666;margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px"></span> ${legendaCal} &nbsp; <span style="display:inline-block;width:10px;height:10px;background:#f3f3f3;border-radius:2px"></span> Sem registro</p>`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Presença</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a}@page{margin:1.5cm}</style></head><body>
      <div style="border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:16px">
        <div style="font-size:11px;color:#B45309;font-weight:700">${empresa}</div>
        <h1 style="color:#1e3a5f;font-size:20px">Calendário de Presença</h1>
        <div style="color:#666;font-size:12px">${obra?.nome || ""} · ${MESES[mes - 1]}/${ano}</div>
      </div>
      <h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:3px;margin-bottom:8px">Média de Presença por Equipe</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>${["Equipe", "Cadastrados", "Média", "% Presença"].map(c => `<th style="background:#1e3a5f;color:#fff;padding:6px;text-align:left">${c}</th>`).join("")}</tr></thead>
        <tbody>${linhasMedia}</tbody>
      </table>
      ${calHtml}
      <script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para exportar PDF"); return; }
    w.document.write(html); w.document.close();
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    // Médias
    const med = [["Equipe", "Empresa", "Cadastrados", "Média de presença", "% Presença"],
      ...equipes.map((e) => {
        const m = mediaEquipe(e.id);
        return [e.nome, e.empresa || "", e.totalColaboradores, Number(m.toFixed(1)), e.totalColaboradores ? Math.round((m / e.totalColaboradores) * 100) / 100 : 0];
      })];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(med), "Médias");
    // Presença diária (matriz dia x equipe)
    const header = ["Dia", ...equipes.map((e) => e.nome)];
    const linhas = [];
    for (let d = 1; d <= totalDias; d++) {
      const dataStr = `${ano}-${z2(mes)}-${z2(d)}`;
      const reg = dias.find((x) => x.data === dataStr);
      if (!reg) continue;
      linhas.push([`${z2(d)}/${z2(mes)}/${ano}`, ...equipes.map((e) => reg.porEquipe?.[e.id]?.presentes ?? 0)]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...linhas]), "Presença diária");
    XLSX.writeFile(wb, `Presenca_${(obra?.nome || "obra").replace(/[^a-z0-9]/gi, "_")}_${ano}-${z2(mes)}.xlsx`);
    toast.success("Excel gerado!");
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          breadcrumb={[{ label: "Obras", href: "/obras" }, { label: obra?.nome || "Obra", href: `/obras/${obraId}` }, { label: "Calendário de Presença" }]}
          title="Calendário de Presença"
          description="Média e dias de presença das equipes por mês"
          icon={CalendarCheck}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="icon" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="font-medium min-w-[130px] text-center">{MESES[mes - 1]} / {ano}</span>
              <Button variant="outline" size="icon" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={equipes.length === 0} onClick={exportarPDF}><FileDown className="w-4 h-4" /> PDF</Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={equipes.length === 0} onClick={exportarExcel}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : equipes.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Nenhum registro de presença neste mês.
          </CardContent></Card>
        ) : (
          <>
            {/* Resumo compacto */}
            <Card><CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
                <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><span className="text-muted-foreground">Média geral:</span> <b>{mediaGeral.toFixed(1).replace(".0", "")}</b></span>
                <span className="flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Cadastrados:</span> <b>{totalCadastrados}</b> <span className="text-muted-foreground">· {equipes.length} equipes</span></span>
                <span className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-emerald-600" /><span className="text-muted-foreground">Dias com registro:</span> <b>{dias.length}</b></span>
              </div>
            </CardContent></Card>

            {/* Médias por equipe */}
            <p className="text-sm font-medium">Média por equipe <span className="text-muted-foreground font-normal">— clique para ver no calendário</span></p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {equipes.map((e) => {
                const media = mediaEquipe(e.id);
                const pct = e.totalColaboradores ? Math.min(100, Math.round((media / e.totalColaboradores) * 100)) : 0;
                const sel = equipeSel === String(e.id);
                return (
                  <button key={e.id} onClick={() => { setEquipeSel(String(e.id)); setOperarioSel(""); }}
                    className={`text-left rounded-xl border bg-card p-3 transition-all hover:shadow-sm ${sel ? "ring-2 ring-primary border-primary/40" : ""}`}>
                    <p className="font-medium text-xs truncate" title={e.nome}>{e.nome}</p>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="text-lg font-bold tracking-tight">{media.toFixed(1).replace(".0", "")}</span>
                      <span className="text-xs text-muted-foreground">/ {e.totalColaboradores}</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: pct + "%" }} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Filtros */}
            <Card><CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Equipe</label>
                  <Select value={equipeSel} onValueChange={(v) => { setEquipeSel(v); setOperarioSel(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma equipe" /></SelectTrigger>
                    <SelectContent>
                      {equipes.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Funcionário (opcional)</label>
                  <Select value={operarioSel || "__all"} onValueChange={(v) => setOperarioSel(v === "__all" ? "" : v)} disabled={!equipeSel}>
                    <SelectTrigger><SelectValue placeholder="Toda a equipe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Toda a equipe</SelectItem>
                      {operarios.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent></Card>

            {/* Calendário */}
            <Card><CardContent className="py-4">
              {!equipeSel ? (
                <p className="text-sm text-muted-foreground text-center py-8">Selecione uma equipe (acima ou nos cartões) para ver os dias de presença.</p>
              ) : (
                <>
                  <div className="max-w-md">
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {DIAS_SEMANA.map((d, i) => <div key={d} className={`text-center text-[10px] font-semibold uppercase tracking-wide ${i === 0 || i === 6 ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {celulas.map((dia, i) => {
                      if (dia === null) return <div key={i} />;
                      const { presente, qtd } = diaPresente(dia);
                      const dataStr = `${ano}-${z2(mes)}-${z2(dia)}`;
                      const ehHoje = dataStr === hojeStr;
                      const dow = (primeiroDia + (dia - 1)) % 7;
                      const fds = dow === 0 || dow === 6;
                      return (
                        <div key={i}
                          className={`relative aspect-square rounded-lg border flex items-center justify-center text-xs transition-all
                            ${presente ? shadeDia(qtd) + " font-semibold" : fds ? "bg-muted/40 text-muted-foreground/50 border-transparent" : "bg-background text-muted-foreground/80 border-border/60"}
                            ${ehHoje ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}>
                          <span>{dia}</span>
                          {presente && !operarioSel && (
                            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[15px] px-1 h-[15px] rounded-full bg-foreground text-background text-[9px] font-bold leading-none shadow">{qtd}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground flex-wrap">
                    {operarioSel ? (
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 rounded bg-emerald-500" /> Operário presente</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        Presença:
                        <span className="inline-block w-3.5 h-3.5 rounded bg-emerald-200" />
                        <span className="inline-block w-3.5 h-3.5 rounded bg-emerald-400" />
                        <span className="inline-block w-3.5 h-3.5 rounded bg-emerald-500" />
                        <span className="inline-block w-3.5 h-3.5 rounded bg-emerald-600" />
                        baixa → alta (nº = presentes)
                      </span>
                    )}
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 rounded border bg-background" /> Sem registro</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-3.5 rounded ring-2 ring-primary" /> Hoje</span>
                  </div>
                </>
              )}
            </CardContent></Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
