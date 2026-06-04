import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, FileText, X, FileDown, FileSpreadsheet } from "lucide-react";
import { fmtDataBR } from "@/lib/data";
import { getPDFConfig } from "@/lib/pdfExport";
import * as XLSX from "xlsx-js-style";

type Nota = { fornecedor: string; ordemCompra: string; pedido: string; nf: string; dataEnvio: string; venc1: string; venc2: string; venc3: string; status: string };
const notaVazia = (): Nota => ({ fornecedor: "", ordemCompra: "", pedido: "", nf: "", dataEnvio: "", venc1: "", venc2: "", venc3: "", status: "enviado" });

function addDiasISO(iso: string, dias: number): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function ProtocolosTab({ obraId, obraNome }: { obraId: number; obraNome?: string }) {
  const utils = trpc.useUtils();
  const { data: lista = [], isLoading } = trpc.protocolos.listByObra.useQuery({ obraId });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [numero, setNumero] = useState("");
  const [observacao, setObservacao] = useState("");
  const [notas, setNotas] = useState<Nota[]>([notaVazia()]);
  const [delId, setDelId] = useState<number | null>(null);
  const [statusFiltro, setStatusFiltro] = useState("todos");

  const inval = () => utils.protocolos.listByObra.invalidate({ obraId });
  const createMut = trpc.protocolos.create.useMutation({ onSuccess: () => { toast.success("Protocolo salvo!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.protocolos.update.useMutation({ onSuccess: () => { toast.success("Protocolo atualizado!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.protocolos.delete.useMutation({ onSuccess: () => { toast.success("Protocolo excluído"); setDelId(null); inval(); }, onError: (e) => toast.error(e.message) });

  const proximoNumero = () => {
    const nums = (lista as any[]).map((p) => parseInt(String(p.numero ?? "").replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1).padStart(2, "0");
  };
  const abrirNovo = () => { setEditId(null); setNumero(proximoNumero()); setObservacao(""); setNotas([notaVazia()]); setOpen(true); };
  const abrirEdicao = async (id: number) => {
    const p: any = await utils.protocolos.getById.fetch({ id });
    if (!p) return;
    setEditId(id); setNumero(p.numero || ""); setObservacao(p.observacao || "");
    setNotas((p.notas || []).length ? (p.notas as any[]).map((n) => ({
      fornecedor: n.fornecedor || "", ordemCompra: n.ordemCompra || "", pedido: n.pedido || "", nf: n.nf || "",
      dataEnvio: n.dataEnvio ? String(n.dataEnvio).slice(0, 10) : "",
      venc1: n.venc1 ? String(n.venc1).slice(0, 10) : "", venc2: n.venc2 ? String(n.venc2).slice(0, 10) : "", venc3: n.venc3 ? String(n.venc3).slice(0, 10) : "",
      status: n.status || "enviado",
    })) : [notaVazia()]);
    setOpen(true);
  };

  const setNota = (i: number, campo: keyof Nota, v: string) => setNotas((arr) => arr.map((n, idx) => {
    if (idx !== i) return n;
    const upd = { ...n, [campo]: v };
    // ao definir a data de envio, sugere vencimentos 28/56/72 se ainda vazios
    if (campo === "dataEnvio" && v) {
      if (!upd.venc1) upd.venc1 = addDiasISO(v, 28);
      if (!upd.venc2) upd.venc2 = addDiasISO(v, 56);
      if (!upd.venc3) upd.venc3 = addDiasISO(v, 72);
    }
    return upd;
  }));

  const salvar = () => {
    const notasLimpas = notas.filter((n) => n.fornecedor || n.nf || n.ordemCompra || n.pedido);
    const payload = { numero: numero || undefined, observacao: observacao || undefined, notas: notasLimpas };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate({ obraId, ...payload });
  };

  const cellCls = "h-9 text-sm";
  const STATUS_LABEL: Record<string, string> = { enviado: "Enviado", em_analise: "Em análise", pago: "Pago", recusado: "Recusado" };
  const linhaNota = (n: any) => [n.fornecedor || "—", n.ordemCompra || "—", n.pedido || "—", n.nf || "—",
    n.dataEnvio ? fmtDataBR(n.dataEnvio) : "—", n.venc1 ? fmtDataBR(n.venc1) : "—", n.venc2 ? fmtDataBR(n.venc2) : "—", n.venc3 ? fmtDataBR(n.venc3) : "—",
    STATUS_LABEL[n.status] || n.status || "—"];
  const COLS = ["Fornecedor", "Nº OC", "Nº Pedido", "Nº NF", "Data envio", "Venc. 28d", "Venc. 56d", "Venc. 72d", "Status"];

  const exportarPDF = async (p: any) => {
    const full: any = await utils.protocolos.getById.fetch({ id: p.id });
    const cfg = getPDFConfig(); const empresa = cfg.empresaNome || "Obra Digital";
    const rows = (full?.notas || []).map(linhaNota);
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Protocolo</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,sans-serif;padding:28px;color:#1a1a1a}@page{margin:1.2cm}</style></head><body>
      <div style="border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:16px">
        <div style="font-size:11px;color:#B45309;font-weight:700">${empresa}</div>
        <h1 style="color:#1e3a5f;font-size:19px">Protocolo de Envio ${full?.numero ? "nº " + full.numero : "#" + p.id}</h1>
        <div style="color:#666;font-size:12px">${obraNome || ""}${full?.observacao ? " · " + full.observacao : ""}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead><tr>${COLS.map(c => `<th style="background:#1e3a5f;color:#fff;padding:5px;text-align:left">${c}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r: any[]) => `<tr>${r.map((c) => `<td style="padding:5px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <p style="font-size:10px;color:#888;margin-top:10px">${rows.length} nota(s) · gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
      <script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para exportar PDF"); return; }
    w.document.write(html); w.document.close();
  };

  const listaFiltrada = statusFiltro === "todos"
    ? (lista as any[])
    : (lista as any[]).filter((p) => String(p.statuses || "").split(",").includes(statusFiltro));

  const exportarTudo = async () => {
    const alvo = listaFiltrada;
    if (alvo.length === 0) { toast.error("Nenhum protocolo para exportar"); return; }
    const rows: any[][] = [];
    for (const p of alvo) {
      const full: any = await utils.protocolos.getById.fetch({ id: p.id });
      for (const n of (full?.notas || [])) {
        if (statusFiltro !== "todos" && n.status !== statusFiltro) continue;
        rows.push([`${full?.numero || "#" + p.id}`, ...linhaNota(n)]);
      }
    }
    const aoa = [["Protocolo", ...COLS], ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    for (let c = 0; c < COLS.length + 1; c++) {
      const a = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" } } };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
    XLSX.writeFile(wb, `Protocolos_${(obraNome || "obra").replace(/[^a-z0-9]/gi, "_")}${statusFiltro !== "todos" ? "_" + statusFiltro : ""}.xlsx`);
    toast.success(`${rows.length} nota(s) exportada(s)!`);
  };

  const exportarExcel = async (p: any) => {
    const full: any = await utils.protocolos.getById.fetch({ id: p.id });
    const aoa = [COLS, ...(full?.notas || []).map(linhaNota)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    for (let c = 0; c < COLS.length; c++) {
      const a = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" } } };
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Protocolo");
    XLSX.writeFile(wb, `Protocolo_${full?.numero || p.id}_${(obraNome || "obra").replace(/[^a-z0-9]/gi, "_")}.xlsx`);
    toast.success("Excel gerado!");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Protocolos de Envio</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="h-9 px-3 border border-input rounded-md bg-background text-sm">
            <option value="todos">Todos os status</option>
            <option value="enviado">Enviado</option>
            <option value="em_analise">Em análise</option>
            <option value="pago">Pago</option>
            <option value="recusado">Recusado</option>
          </select>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={listaFiltrada.length === 0} onClick={exportarTudo}><FileSpreadsheet className="w-4 h-4" /> Exportar tudo</Button>
          <Button size="sm" className="gap-1.5" onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Protocolo</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : listaFiltrada.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {(lista as any[]).length === 0 ? <>Nenhum protocolo de envio. Clique em <b>Novo Protocolo</b>.</> : "Nenhum protocolo com esse status."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {listaFiltrada.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-tight">Protocolo {p.numero ? `nº ${p.numero}` : `#${p.id}`}</p>
                  <p className="text-xs text-muted-foreground">{p.totalNotas} nota(s) · {fmtDataBR(p.criadoEm)}{p.observacao ? ` · ${p.observacao}` : ""}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Exportar PDF" onClick={() => exportarPDF(p)}><FileDown className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Exportar Excel" onClick={() => exportarExcel(p)}><FileSpreadsheet className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => abrirEdicao(p.id)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setDelId(p.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>{editId ? "Editar protocolo" : "Novo protocolo de envio"}</DialogTitle></DialogHeader>
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nº do protocolo (opcional)</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 001/2026" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: Envio ao financeiro" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Notas do protocolo</p>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setNotas((a) => [...a, notaVazia()])}><Plus className="w-4 h-4" /> Adicionar nota</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 900 }}>
                  <thead>
                    <tr className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                      <th className="text-left p-1.5">Fornecedor</th>
                      <th className="text-left p-1.5 w-24">Nº OC</th>
                      <th className="text-left p-1.5 w-24">Nº Pedido</th>
                      <th className="text-left p-1.5 w-24">Nº NF</th>
                      <th className="text-left p-1.5 w-36">Data envio</th>
                      <th className="text-left p-1.5 w-36">Venc. 28d</th>
                      <th className="text-left p-1.5 w-36">Venc. 56d</th>
                      <th className="text-left p-1.5 w-36">Venc. 72d</th>
                      <th className="text-left p-1.5 w-28">Status</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {notas.map((n, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-1"><Input className={cellCls} value={n.fornecedor} onChange={(e) => setNota(i, "fornecedor", e.target.value)} /></td>
                        <td className="p-1"><Input className={cellCls} value={n.ordemCompra} onChange={(e) => setNota(i, "ordemCompra", e.target.value)} /></td>
                        <td className="p-1"><Input className={cellCls} value={n.pedido} onChange={(e) => setNota(i, "pedido", e.target.value)} /></td>
                        <td className="p-1"><Input className={cellCls} value={n.nf} onChange={(e) => setNota(i, "nf", e.target.value)} /></td>
                        <td className="p-1"><Input type="date" className={cellCls} value={n.dataEnvio} onChange={(e) => setNota(i, "dataEnvio", e.target.value)} /></td>
                        <td className="p-1"><Input type="date" className={cellCls} value={n.venc1} onChange={(e) => setNota(i, "venc1", e.target.value)} /></td>
                        <td className="p-1"><Input type="date" className={cellCls} value={n.venc2} onChange={(e) => setNota(i, "venc2", e.target.value)} /></td>
                        <td className="p-1"><Input type="date" className={cellCls} value={n.venc3} onChange={(e) => setNota(i, "venc3", e.target.value)} /></td>
                        <td className="p-1">
                          <select className="w-full h-9 px-2 border border-input rounded-md bg-background text-sm" value={n.status} onChange={(e) => setNota(i, "status", e.target.value)}>
                            <option value="enviado">Enviado</option>
                            <option value="em_analise">Em análise</option>
                            <option value="pago">Pago</option>
                            <option value="recusado">Recusado</option>
                          </select>
                        </td>
                        <td className="p-1 text-center">
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={notas.length === 1} onClick={() => setNotas((a) => a.filter((_, idx) => idx !== i))}><X className="w-4 h-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Ao preencher a <b>data de envio</b>, os vencimentos 28/56/72 dias são sugeridos automaticamente (você pode ajustar).</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar protocolo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir protocolo?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita e remove todas as notas do protocolo.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMut.isPending} onClick={() => delId && deleteMut.mutate({ id: delId })}>
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
