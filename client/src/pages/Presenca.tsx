import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
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

  const mediaGeral = equipes.length ? equipes.reduce((s, e) => s + mediaEquipe(e.id), 0) / equipes.length : 0;
  const totalCadastrados = equipes.reduce((s, e) => s + (e.totalColaboradores || 0), 0);

  // Monta HTML do calendário (para o PDF)
  const calendarioHTML = (eqId: number, opId: number | null) => {
    let html = `<table style="width:100%;border-collapse:separate;border-spacing:4px;table-layout:fixed">
      <thead><tr>${DIAS_SEMANA.map(d => `<th style="font-size:10px;color:#666;padding:2px">${d}</th>`).join("")}</tr></thead><tbody><tr>`;
    let col = 0;
    for (let i = 0; i < primeiroDia; i++) { html += `<td></td>`; col++; }
    for (let d = 1; d <= totalDias; d++) {
      const dataStr = `${ano}-${z2(mes)}-${z2(d)}`;
      const reg = dias.find((x) => x.data === dataStr);
      const pe = reg?.porEquipe?.[eqId];
      const presente = pe ? (opId ? pe.operarios.includes(opId) : pe.presentes > 0) : false;
      const bg = presente ? "#10b981" : "#f1f1f1";
      const cor = presente ? "#fff" : "#999";
      const sub = presente && !opId ? `<div style="font-size:8px">${pe.presentes}</div>` : "";
      html += `<td style="background:${bg};color:${cor};text-align:center;padding:6px 2px;border-radius:6px;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact">${d}${sub}</td>`;
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
      : "";
    const calHtml = equipeAtual ? `<h2 style="font-size:14px;color:#1e3a5f;margin:18px 0 8px">${tituloCal}</h2>${calendarioHTML(Number(equipeSel), operarioSel ? Number(operarioSel) : null)}
      <p style="font-size:10px;color:#666;margin-top:6px"><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:2px"></span> Presente &nbsp; <span style="display:inline-block;width:10px;height:10px;background:#f1f1f1;border-radius:2px"></span> Sem registro</p>` : "";
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
            {/* Média geral da obra */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Média geral da obra" value={mediaGeral.toFixed(1).replace(".0", "")} icon={Activity} tone="blue" hint="Média das equipes/dia" />
              <StatCard label="Total cadastrados" value={totalCadastrados} icon={Users} tone="neutral" hint={`${equipes.length} equipe(s)`} />
              <StatCard label="Dias com registro" value={dias.length} icon={CalendarCheck} tone="green" hint={`em ${MESES[mes - 1]}`} />
            </div>

            {/* Médias por equipe */}
            <p className="text-sm font-medium text-muted-foreground">Média de presença por equipe (clique para ver no calendário)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipes.map((e) => {
                const media = mediaEquipe(e.id);
                return (
                  <StatCard
                    key={e.id}
                    label={e.nome}
                    value={`${media.toFixed(1).replace(".0", "")} de ${e.totalColaboradores}`}
                    icon={UserCheck}
                    tone={equipeSel === String(e.id) ? "green" : "neutral"}
                    hint={`Média de presença · ${e.empresa || ""}`}
                    onClick={() => { setEquipeSel(String(e.id)); setOperarioSel(""); }}
                  />
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
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {celulas.map((dia, i) => {
                      if (dia === null) return <div key={i} />;
                      const { presente, qtd } = diaPresente(dia);
                      return (
                        <div key={i} className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-sm ${presente ? "bg-emerald-500 text-white border-emerald-600 font-semibold" : "bg-muted/30 text-muted-foreground"}`}>
                          <span>{dia}</span>
                          {presente && !operarioSel && <span className="text-[10px] opacity-90">{qtd}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-500" /> {operarioSel ? "Operário presente" : "Equipe presente (nº = presentes)"}</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-muted" /> Sem registro</span>
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
