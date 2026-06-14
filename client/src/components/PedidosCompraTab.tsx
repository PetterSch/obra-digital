import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ShoppingCart, X, FileDown, FileSpreadsheet, Search } from "lucide-react";
import { fmtDataBR } from "@/lib/data";
import { getPDFConfig } from "@/lib/pdfExport";
import * as XLSX from "xlsx-js-style";

type Item = { descricao: string; unidade: string; quantidade: string; observacao: string };
const itemVazio = (): Item => ({ descricao: "", unidade: "", quantidade: "", observacao: "" });
const STATUS_LABEL: Record<string, string> = { aberto: "Aberto", enviado: "Enviado", parcial: "Recebido parcial", recebido: "Recebido", cancelado: "Cancelado" };
// Unidades comuns de compra (sugestões — campo continua de digitação livre)
const UNIDADES = [
  "UND", "PÇ", "CX", "SC 50kg", "SC 25kg", "SC 20kg", "SC 15kg", "KG", "T",
  "M", "M²", "M³", "L", "GL", "BARRA", "RL", "PAR", "JG", "MILHEIRO",
  "VB", "LATA 18L", "BALDE", "TB", "FD", "DZ", "PALETE", "VIAGEM", "CAÇAMBA",
];
const STATUS_COR: Record<string, string> = { aberto: "bg-amber-100 text-amber-700", enviado: "bg-blue-100 text-blue-700", parcial: "bg-violet-100 text-violet-700", recebido: "bg-green-100 text-green-700", cancelado: "bg-gray-100 text-gray-600" };

export function PedidosCompraTab({ obraId, obraNome }: { obraId: number; obraNome?: string }) {
  const utils = trpc.useUtils();
  const { data: lista = [], isLoading } = trpc.pedidos.listByObra.useQuery({ obraId });
  const { data: insumos = [] } = trpc.insumos.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [numero, setNumero] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [observacao, setObservacao] = useState("");
  const [status, setStatus] = useState("aberto");
  const [itens, setItens] = useState<Item[]>([itemVazio()]);
  const [buscasInsumo, setBuscasInsumo] = useState<string[]>([""]);
  const [dropdownAberto, setDropdownAberto] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const DROPDOWN_H = 320; // altura máxima do dropdown em px
  const abrirDropdown = useCallback((i: number) => {
    const el = inputRefs.current[i];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minW = 400;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < DROPDOWN_H + 8 && rect.top > DROPDOWN_H + 8;
    setDropdownPos({
      top: openUp ? rect.top - 2 : rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, minW),
      openUp,
    });
    setDropdownAberto(i);
  }, []);
  const [delId, setDelId] = useState<number | null>(null);
  const [verData, setVerData] = useState<any | null>(null);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const buscando = busca.trim().length >= 2;
  const { data: resultados = [] } = trpc.pedidos.buscar.useQuery({ obraId, termo: busca.trim() }, { enabled: buscando });

  const inval = () => utils.pedidos.listByObra.invalidate({ obraId });
  const createMut = trpc.pedidos.create.useMutation({ onSuccess: () => { toast.success("Pedido salvo!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.pedidos.update.useMutation({ onSuccess: () => { toast.success("Pedido atualizado!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.pedidos.delete.useMutation({ onSuccess: () => { toast.success("Pedido excluído"); setDelId(null); inval(); }, onError: (e) => toast.error(e.message) });

  const proximoNumero = () => {
    const nums = (lista as any[]).map((p) => parseInt(String(p.numero ?? "").replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0");
  };
  const abrirNovo = () => { setEditId(null); setNumero(proximoNumero()); setSolicitante(""); setObservacao(""); setStatus("aberto"); setItens([itemVazio()]); setBuscasInsumo([""]); setDropdownAberto(null); setOpen(true); };
  const abrirEdicao = async (id: number) => {
    const p: any = await utils.pedidos.getById.fetch({ id });
    if (!p) return;
    setEditId(id); setNumero(p.numero || ""); setSolicitante(p.solicitante || ""); setObservacao(p.observacao || ""); setStatus(p.status || "aberto");
    const itensCarregados = (p.itens || []).length ? (p.itens as any[]).map((i) => ({ descricao: i.descricao || "", unidade: i.unidade || "", quantidade: i.quantidade != null ? String(i.quantidade) : "", observacao: i.observacao || "" })) : [itemVazio()];
    setItens(itensCarregados);
    setBuscasInsumo(itensCarregados.map((i: Item) => i.descricao));
    setDropdownAberto(null);
    setOpen(true);
  };
  const verPedido = async (id: number) => { const p: any = await utils.pedidos.getById.fetch({ id }); if (p) setVerData(p); };

  const setItem = (i: number, campo: keyof Item, v: string) => setItens((arr) => arr.map((it, idx) => idx === i ? { ...it, [campo]: v } : it));

  const salvar = () => {
    const itensLimpos = itens.filter((i) => i.descricao.trim()).map((i) => ({ descricao: i.descricao.trim(), unidade: i.unidade || undefined, quantidade: i.quantidade ? parseFloat(i.quantidade) : undefined, observacao: i.observacao || undefined }));
    const payload = { numero: numero || undefined, solicitante: solicitante || undefined, observacao: observacao || undefined, status, itens: itensLimpos };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate({ obraId, ...payload });
  };

  const cellCls = "h-9 text-sm";
  const COLS = ["Material / Descrição", "Unid.", "Qtd.", "Observação"];
  const linhaItem = (it: any) => [it.descricao || "—", it.unidade || "—", it.quantidade != null ? Number(it.quantidade).toLocaleString("pt-BR") : "—", it.observacao || "—"];

  const listaFiltrada = statusFiltro === "todos" ? (lista as any[]) : (lista as any[]).filter((p) => (p.status || "aberto") === statusFiltro);

  const exportarPDF = async (p: any) => {
    const full: any = p.itens ? p : await utils.pedidos.getById.fetch({ id: p.id });
    const cfg = getPDFConfig(); const empresa = cfg.empresaNome || "Obra Digital";
    const rows = (full?.itens || []).map(linhaItem);
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Pedido</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      body{font-family:Arial,sans-serif;padding:28px;color:#1a1a1a}@page{margin:1.2cm}</style></head><body>
      <div style="border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:16px">
        <div style="font-size:11px;color:#B45309;font-weight:700">${empresa}</div>
        <h1 style="color:#1e3a5f;font-size:19px">Pedido de Compra ${full?.numero ? "nº " + full.numero : "#" + p.id}</h1>
        <div style="color:#666;font-size:12px">${obraNome || ""}${full?.solicitante ? " · Solicitante: " + full.solicitante : ""} · Status: ${STATUS_LABEL[full?.status] || full?.status || "—"}${full?.observacao ? " · " + full.observacao : ""}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>${COLS.map((c) => `<th style="background:#1e3a5f;color:#fff;padding:5px;text-align:left">${c}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r: any[]) => `<tr>${r.map((c) => `<td style="padding:5px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <p style="font-size:10px;color:#888;margin-top:10px">${rows.length} item(ns) · gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
      <script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para exportar PDF"); return; }
    w.document.write(html); w.document.close();
  };

  const exportarExcel = async (p: any) => {
    const full: any = p.itens ? p : await utils.pedidos.getById.fetch({ id: p.id });
    const aoa = [COLS, ...(full?.itens || []).map(linhaItem)];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 40 }, { wch: 8 }, { wch: 10 }, { wch: 30 }];
    for (let c = 0; c < COLS.length; c++) { const a = XLSX.utils.encode_cell({ r: 0, c }); if (ws[a]) ws[a].s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1E3A5F" } } }; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");
    XLSX.writeFile(wb, `Pedido_${full?.numero || p.id}_${(obraNome || "obra").replace(/[^a-z0-9]/gi, "_")}.xlsx`);
    toast.success("Excel gerado!");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Pedidos de Compra</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="h-9 px-3 border border-input rounded-md bg-background text-sm">
            <option value="todos">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="enviado">Enviado</option>
            <option value="parcial">Recebido parcial</option>
            <option value="recebido">Recebido</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <Button size="sm" className="gap-1.5" onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Pedido</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Pesquisar por material, observação, nº do pedido ou solicitante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
      </div>

      {buscando ? (
        <Card><CardContent className="py-3">
          <p className="text-xs text-muted-foreground mb-2">{(resultados as any[]).length} resultado(s) para "{busca.trim()}"</p>
          {(resultados as any[]).length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item encontrado.</p> : (
            <div className="space-y-1.5">
              {(resultados as any[]).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                  <div className="min-w-0 text-sm flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.descricao || "—"}</span>
                    {r.quantidade != null && <span className="text-xs text-muted-foreground">{Number(r.quantidade).toLocaleString("pt-BR")} {r.unidade || ""}</span>}
                    <span className="text-xs text-primary font-medium">Pedido {r.pedidoNumero ? `nº ${r.pedidoNumero}` : `#${r.pedidoId}`}</span>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 shrink-0 h-8" onClick={() => verPedido(r.pedidoId)}><ShoppingCart className="w-3.5 h-3.5" /> Ver pedido</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      ) : isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : listaFiltrada.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
          {(lista as any[]).length === 0 ? <>Nenhum pedido de compra. Clique em <b>Novo Pedido</b>.</> : "Nenhum pedido com esse status."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {listaFiltrada.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5">
              <button className="flex items-center gap-3 min-w-0 text-left group" onClick={() => verPedido(p.id)} title="Clique para visualizar">
                <ShoppingCart className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-tight group-hover:text-primary group-hover:underline transition-colors">Pedido {p.numero ? `nº ${p.numero}` : `#${p.id}`}</p>
                  <p className="text-xs text-muted-foreground">{p.totalItens} item(ns) · {fmtDataBR(p.criadoEm)}{p.solicitante ? ` · ${p.solicitante}` : ""}</p>
                </div>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold mr-1 ${STATUS_COR[p.status || "aberto"] || ""}`}>{STATUS_LABEL[p.status || "aberto"] || p.status}</span>
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
        <DialogContent className="!max-w-[95vw] w-[95vw] h-[95vh] flex flex-col overflow-hidden p-0">
          <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0"><DialogTitle className="text-lg">{editId ? "Editar pedido" : "Novo pedido de compra"}</DialogTitle></DialogHeader>
          <datalist id="unidades-compra">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist>
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-6 py-4 gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Nº do pedido</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 001/2026" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs">Solicitante</Label><Input value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Quem está solicitando" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm">
                  <option value="aberto">Aberto</option><option value="enviado">Enviado</option><option value="parcial">Recebido parcial</option><option value="recebido">Recebido</option><option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-4"><Label className="text-xs">Observação (opcional)</Label><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex: entrega urgente, fornecedor preferencial..." /></div>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Itens do pedido <span className="text-muted-foreground font-normal">({itens.length})</span></p>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => { setItens((a) => [...a, itemVazio()]); setBuscasInsumo((a) => [...a, ""]); }}><Plus className="w-4 h-4" /> Adicionar item</Button>
              </div>
              <div className="overflow-auto flex-1 border rounded-lg" style={{ minHeight: 200 }}>
                <table className="w-full text-sm" style={{ minWidth: 780 }}>
                  <thead><tr className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                    <th className="text-left p-1.5">Material / Descrição</th><th className="text-left p-1.5 w-24">Unidade</th><th className="text-left p-1.5 w-24">Quantidade</th><th className="text-left p-1.5 w-56">Observação</th><th className="w-8"></th>
                  </tr></thead>
                  <tbody>
                    {itens.map((it, i) => {
                      const busca = buscasInsumo[i] ?? "";
                      const termoFiltro = busca.toLowerCase();
                      const insumosFiltrados = termoFiltro.length >= 2
                        ? (insumos as any[]).filter((ins) =>
                            ins.nome.toLowerCase().includes(termoFiltro) ||
                            (ins.codigo || "").toLowerCase().includes(termoFiltro) ||
                            (ins.categoriaNome || "").toLowerCase().includes(termoFiltro)
                          ).slice(0, 50)
                        : [];
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="p-1">
                            <div className="relative">
                              <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  ref={(el) => { inputRefs.current[i] = el; }}
                                  className="h-9 text-sm pl-7 pr-6"
                                  placeholder="Buscar insumo por código ou nome..."
                                  value={busca}
                                  onFocus={() => abrirDropdown(i)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBuscasInsumo((a) => a.map((v, idx) => idx === i ? val : v));
                                    if (!val) setItem(i, "descricao", "");
                                    abrirDropdown(i);
                                  }}
                                  onKeyDown={(e) => { if (e.key === "Escape") setDropdownAberto(null); }}
                                  onBlur={() => setTimeout(() => setDropdownAberto(null), 150)}
                                />
                                {busca && (
                                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setBuscasInsumo((a) => a.map((v, idx) => idx === i ? "" : v)); setItem(i, "descricao", ""); setDropdownAberto(null); }}>
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {dropdownAberto === i && dropdownPos && (insumosFiltrados.length > 0 || termoFiltro.length >= 2) && createPortal(
                                <div
                                  style={{
                                    position: "fixed",
                                    ...(dropdownPos.openUp
                                      ? { bottom: window.innerHeight - dropdownPos.top, top: "auto" }
                                      : { top: dropdownPos.top }),
                                    left: dropdownPos.left,
                                    width: dropdownPos.width,
                                    maxHeight: DROPDOWN_H,
                                    zIndex: 9999,
                                  }}
                                  className="bg-background border rounded-md shadow-xl overflow-y-auto"
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  {insumosFiltrados.length > 0 ? insumosFiltrados.map((ins: any) => (
                                    <button key={ins.id} type="button"
                                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
                                      onMouseDown={() => {
                                        setBuscasInsumo((a) => a.map((v, idx) => idx === i ? ins.nome : v));
                                        setItens((arr) => arr.map((x, idx) => idx === i ? { ...x, descricao: ins.nome, unidade: ins.unidade || x.unidade } : x));
                                        setDropdownAberto(null);
                                      }}>
                                      {ins.codigo && <span className="text-xs font-mono text-primary shrink-0">{ins.codigo}</span>}
                                      <span className="truncate">{ins.nome}</span>
                                      {ins.categoriaNome && <span className="text-xs text-muted-foreground ml-auto shrink-0">{ins.categoriaNome}</span>}
                                    </button>
                                  )) : (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum insumo encontrado.</div>
                                  )}
                                </div>,
                                document.body
                              )}
                            </div>
                          </td>
                          <td className="p-1"><Input list="unidades-compra" className={cellCls} value={it.unidade} onChange={(e) => setItem(i, "unidade", e.target.value)} placeholder="UND, SC 50kg..." /></td>
                          <td className="p-1"><Input type="number" step="0.01" className={cellCls} value={it.quantidade} onChange={(e) => setItem(i, "quantidade", e.target.value)} placeholder="0" /></td>
                          <td className="p-1"><Input className={cellCls} value={it.observacao} onChange={(e) => setItem(i, "observacao", e.target.value)} placeholder="marca, especificação..." /></td>
                          <td className="p-1 text-center"><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={itens.length === 1} onClick={() => { setItens((a) => a.filter((_, idx) => idx !== i)); setBuscasInsumo((a) => a.filter((_, idx) => idx !== i)); }}><X className="w-4 h-4" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={createMut.isPending || updateMut.isPending}>{createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar pedido"}</Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visualização */}
      <Dialog open={!!verData} onOpenChange={(o) => { if (!o) setVerData(null); }}>
        <DialogContent className="!max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>Pedido {verData?.numero ? `nº ${verData.numero}` : `#${verData?.id}`}</DialogTitle></DialogHeader>
          {verData && (
            <div className="space-y-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[verData.status || "aberto"] || ""}`}>{STATUS_LABEL[verData.status || "aberto"] || verData.status}</span>
                <span>{(verData.itens || []).length} item(ns)</span>
                {verData.solicitante && <span>· {verData.solicitante}</span>}
                <span>· {fmtDataBR(verData.criadoEm)}</span>
                {verData.observacao && <span>· {verData.observacao}</span>}
                <span className="ml-auto flex gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => exportarPDF(verData)}><FileDown className="w-3.5 h-3.5" /> PDF</Button>
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => exportarExcel(verData)}><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</Button>
                  <Button size="sm" className="gap-1.5 h-8" onClick={() => { const id = verData.id; setVerData(null); abrirEdicao(id); }}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/40 text-[11px] uppercase text-muted-foreground">{COLS.map((c) => <th key={c} className="text-left p-2">{c}</th>)}</tr></thead>
                  <tbody>
                    {(verData.itens || []).map((it: any) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2">{it.descricao || "—"}</td>
                        <td className="p-2">{it.unidade || "—"}</td>
                        <td className="p-2">{it.quantidade != null ? Number(it.quantidade).toLocaleString("pt-BR") : "—"}</td>
                        <td className="p-2 text-muted-foreground">{it.observacao || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end"><Button variant="outline" onClick={() => setVerData(null)}>Fechar</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Exclusão */}
      <Dialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir pedido?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita e remove todos os itens do pedido.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMut.isPending} onClick={() => delId && deleteMut.mutate({ id: delId })}>{deleteMut.isPending ? "Excluindo..." : "Excluir"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
