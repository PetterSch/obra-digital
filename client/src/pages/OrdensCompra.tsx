import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ShoppingBag, Building2, ChevronDown, ChevronRight, FileText, CheckCircle2,
  Trophy, Truck, User, Calendar, X, FileDown, PackageCheck, Receipt, Ban, Trash2,
} from "lucide-react";
import { totalItensOC, formatNumeroOC } from "@shared/ordensCompra";
import { exportOrdemCompraPDF } from "@/lib/pdfExport";

const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Tipos auxiliares (espelham o retorno da API) ──────────────────────────

type FornecedorCotado = { mapaFornecedorId: number; nome: string; valorUnitario: number; frete: number; melhor: boolean };
type ItemPronto = { mapaItemId: number; descricao: string; unidade?: string | null; quantidade: number; fornecedores: FornecedorCotado[] };
type MapaPronto = { mapaId: number; numero: string; titulo?: string | null; itens: ItemPronto[] };
type Selecao = Record<number, { mapaFornecedorId: number }>; // mapaItemId -> fornecedor escolhido

// ─── Aba: PEDIDOS PRONTOS ──────────────────────────────────────────────────

function PedidosProntos({ obraId, onGerou }: { obraId: number; onGerou: (ocs: any[]) => void }) {
  const { data: mapas = [], isLoading } = trpc.ordensCompra.pedidosProntos.useQuery({ obraId });
  const [selecao, setSelecao] = useState<Selecao>({});
  const utils = trpc.useUtils();

  const gerarMut = trpc.ordensCompra.gerar.useMutation({
    onSuccess: (ocs) => {
      setSelecao({});
      utils.ordensCompra.pedidosProntos.invalidate();
      onGerou(ocs as any[]);
    },
    onError: (e) => toast.error(e.message || "Erro ao gerar OC"),
  });

  // Índice rápido: mapaItemId -> item (para resumo do rodapé)
  const itensIndex = useMemo(() => {
    const idx = new Map<number, ItemPronto>();
    (mapas as MapaPronto[]).forEach(m => m.itens.forEach(it => idx.set(it.mapaItemId, it)));
    return idx;
  }, [mapas]);

  const itensSelecionados = Object.entries(selecao);
  const totalEstimado = useMemo(() => {
    const linhas = itensSelecionados.map(([mapaItemId, sel]) => {
      const item = itensIndex.get(Number(mapaItemId));
      const forn = item?.fornecedores.find(f => f.mapaFornecedorId === sel.mapaFornecedorId);
      return { quantidade: item?.quantidade ?? 0, valorUnitario: forn?.valorUnitario ?? 0 };
    });
    return totalItensOC(linhas);
  }, [itensSelecionados, itensIndex]);

  const toggleItem = (item: ItemPronto, checked: boolean) => {
    setSelecao(prev => {
      const next = { ...prev };
      if (checked) {
        // Default: fornecedor de melhor preço
        const melhor = item.fornecedores.find(f => f.melhor) ?? item.fornecedores[0];
        next[item.mapaItemId] = { mapaFornecedorId: melhor.mapaFornecedorId };
      } else {
        delete next[item.mapaItemId];
      }
      return next;
    });
  };

  const escolherFornecedor = (mapaItemId: number, mapaFornecedorId: number) => {
    setSelecao(prev => ({ ...prev, [mapaItemId]: { mapaFornecedorId } }));
  };

  const gerar = () => {
    const itens = itensSelecionados.map(([mapaItemId, sel]) => ({
      mapaItemId: Number(mapaItemId),
      mapaFornecedorId: sel.mapaFornecedorId,
    }));
    gerarMut.mutate({ obraId, itens });
  };

  if (isLoading) return <div className="flex justify-center py-14"><Spinner /></div>;

  if (!mapas.length) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <PackageCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhum mapa de cotação concluído com itens pendentes nesta obra.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {(mapas as MapaPronto[]).map(mapa => (
        <MapaCard
          key={mapa.mapaId}
          mapa={mapa}
          selecao={selecao}
          onToggle={toggleItem}
          onEscolher={escolherFornecedor}
        />
      ))}

      {/* Rodapé fixo com resumo */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t shadow-lg z-20">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            <span className="font-semibold">{itensSelecionados.length}</span> item(ns) selecionado(s)
            <span className="mx-2 text-muted-foreground">·</span>
            Total estimado: <span className="font-bold text-primary">{brl(totalEstimado)}</span>
          </div>
          <Button
            onClick={gerar}
            disabled={itensSelecionados.length === 0 || gerarMut.isPending}
            className="gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            {gerarMut.isPending ? "Gerando..." : "Gerar Ordem de Compra"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de um mapa (seção) ───────────────────────────────────────────────

function MapaCard({
  mapa, selecao, onToggle, onEscolher,
}: {
  mapa: MapaPronto;
  selecao: Selecao;
  onToggle: (item: ItemPronto, checked: boolean) => void;
  onEscolher: (mapaItemId: number, mapaFornecedorId: number) => void;
}) {
  const [aberto, setAberto] = useState(true);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 bg-muted/20 border-b">
        <button className="flex items-center gap-2 text-left w-full" onClick={() => setAberto(v => !v)}>
          {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Mapa #{mapa.numero}</span>
          {mapa.titulo && <span className="text-sm text-muted-foreground">— {mapa.titulo}</span>}
          <span className="ml-auto text-xs text-muted-foreground">{mapa.itens.length} item(ns)</span>
        </button>
      </CardHeader>

      {aberto && (
        <CardContent className="p-0 divide-y">
          {mapa.itens.map(item => {
            const sel = selecao[item.mapaItemId];
            const selecionado = !!sel;
            const fornEscolhido = item.fornecedores.find(f => f.mapaFornecedorId === sel?.mapaFornecedorId);
            const melhor = item.fornecedores.find(f => f.melhor);
            return (
              <div key={item.mapaItemId} className={selecionado ? "bg-primary/5" : ""}>
                <div className="flex items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary cursor-pointer"
                    checked={selecionado}
                    onChange={e => onToggle(item, e.target.checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.descricao}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.quantidade.toLocaleString("pt-BR")} {item.unidade ?? ""}
                      </span>
                      {melhor && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          <Trophy className="w-3 h-3" /> {melhor.nome} — melhor preço ({brl(melhor.valorUnitario)})
                        </span>
                      )}
                    </div>

                    {/* Seletor de fornecedor (inline, ao selecionar) */}
                    {selecionado && (
                      <div className="mt-2 rounded-lg border bg-background p-2 space-y-1">
                        <p className="text-[11px] uppercase text-muted-foreground font-semibold px-1">Escolha o fornecedor</p>
                        <div className="grid gap-1">
                          {item.fornecedores.map(f => {
                            const ativo = f.mapaFornecedorId === sel?.mapaFornecedorId;
                            return (
                              <button
                                key={f.mapaFornecedorId}
                                onClick={() => onEscolher(item.mapaItemId, f.mapaFornecedorId)}
                                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors text-left ${
                                  ativo ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  {ativo && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                                  {f.nome}
                                  {f.melhor && <Trophy className="w-3 h-3 text-green-600" />}
                                </span>
                                <span className="tabular-nums font-medium">{brl(f.valorUnitario)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Valor do item conforme fornecedor escolhido */}
                  {selecionado && fornEscolhido && (
                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-muted-foreground">Subtotal</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {brl(item.quantidade * fornEscolhido.valorUnitario)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Revisão das prévias geradas ───────────────────────────────────────────

function RevisaoPrevias({ ocs, obraId, obraCliente, onFechar }: { ocs: any[]; obraId: number; obraCliente?: string; onFechar: () => void }) {
  const utils = trpc.useUtils();
  const { data: faturamentos = [] } = trpc.obras.faturamentoList.useQuery({ obraId });
  const [tratadas, setTratadas] = useState<Record<number, "confirmada" | "cancelada">>({});
  // Faturamento escolhido para todas as prévias ("" = usar o cadastro da obra).
  const [faturamentoId, setFaturamentoId] = useState<number | "">(() => (ocs[0]?.faturamentoFornecedorId ?? "") as number | "");
  // Estado editável local de frete/desconto/obs por OC
  const [edits, setEdits] = useState<Record<number, { frete: string; desconto: string; observacao: string }>>(() =>
    Object.fromEntries(ocs.map(oc => [oc.id, { frete: String(oc.frete ?? 0), desconto: String((oc as any).desconto ?? 0), observacao: oc.observacao ?? "" }]))
  );

  const invalidar = () => {
    utils.ordensCompra.pedidosProntos.invalidate();
    utils.ordensCompra.listGeradas.invalidate();
  };

  const updateMut = trpc.ordensCompra.update.useMutation();

  // Troca o faturamento de todas as prévias ainda não tratadas.
  const trocarFaturamento = async (val: number | "") => {
    setFaturamentoId(val);
    const pendentes = ocs.filter(oc => !tratadas[oc.id]);
    await Promise.all(pendentes.map(oc =>
      updateMut.mutateAsync({ id: oc.id, faturamentoFornecedorId: val === "" ? null : val }).catch(() => {})
    ));
  };
  const confirmarMut = trpc.ordensCompra.confirmar.useMutation({
    onError: e => toast.error(e.message),
  });
  const cancelarMut = trpc.ordensCompra.cancelar.useMutation({
    onError: e => toast.error(e.message),
  });

  const confirmar = async (oc: any) => {
    const ed = edits[oc.id];
    await updateMut.mutateAsync({
      id: oc.id,
      frete: parseFloat(ed.frete) || 0,
      desconto: parseFloat(ed.desconto) || 0,
      observacao: ed.observacao,
      faturamentoFornecedorId: faturamentoId === "" ? null : faturamentoId,
    });
    // O número sequencial só é atribuído agora, na confirmação (volta na resposta).
    const res = await confirmarMut.mutateAsync({ id: oc.id });
    setTratadas(p => ({ ...p, [oc.id]: "confirmada" }));
    invalidar();
    const numero = (res as any)?.numero ?? oc.numero;
    toast.success(`OC nº ${formatNumeroOC(numero)} confirmada!`);
  };

  const cancelar = async (oc: any) => {
    await cancelarMut.mutateAsync({ id: oc.id });
    setTratadas(p => ({ ...p, [oc.id]: "cancelada" }));
    invalidar();
    toast.info(`Prévia de ${oc.fornecedorNome} cancelada. Itens voltaram para Pedidos Prontos.`);
  };

  const todasTratadas = ocs.every(oc => tratadas[oc.id]);

  // Ao fechar sem confirmar, cancela as prévias pendentes (itens voltam ao pool).
  // Evita prévias órfãs que "somem" da tela sem virar OC gerada.
  const fecharComLimpeza = async () => {
    const pendentes = ocs.filter(oc => !tratadas[oc.id]);
    if (pendentes.length) {
      for (const oc of pendentes) {
        try { await cancelarMut.mutateAsync({ id: oc.id }); } catch { /* ignore */ }
      }
      invalidar();
      toast.info(
        pendentes.length === 1
          ? "Prévia não confirmada foi descartada. Os itens voltaram para Pedidos Prontos."
          : `${pendentes.length} prévias não confirmadas foram descartadas. Os itens voltaram para Pedidos Prontos.`
      );
    }
    onFechar();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) fecharComLimpeza(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Revisar {ocs.length > 1 ? `${ocs.length} prévias` : "prévia"} de Ordem de Compra
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          {ocs.length > 1
            ? "Foram geradas OCs separadas por fornecedor. Revise e confirme cada uma."
            : "Revise o frete e as observações antes de confirmar."}
        </p>

        {/* Faturar em nome de — pré-definido com o cadastro da obra */}
        <div className="rounded-lg border bg-muted/20 p-3 mt-2">
          <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
            <Receipt className="w-3.5 h-3.5" /> Faturar em nome de
          </label>
          <select
            className="w-full h-9 px-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={faturamentoId}
            onChange={e => trocarFaturamento(e.target.value ? Number(e.target.value) : "")}
            disabled={updateMut.isPending}
          >
            <option value="">Cadastro da obra — {obraCliente || "cliente da obra"}</option>
            {(faturamentos as any[]).map((e: any) => (
              <option key={e.fornecedorId} value={e.fornecedorId}>{e.nome}{e.cpfCnpj ? ` — ${e.cpfCnpj}` : ""}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Aplica-se a {ocs.length > 1 ? "todas as prévias" : "esta prévia"}. Habilite entidades na aba <strong>Faturamento</strong> da obra.
          </p>
        </div>

        <div className="space-y-4 mt-2">
          {ocs.map(oc => {
            const estado = tratadas[oc.id];
            const ed = edits[oc.id];
            const totalItens = totalItensOC(oc.itens ?? []);
            const total = totalItens + (parseFloat(ed?.frete) || 0) - (parseFloat(ed?.desconto) || 0);
            return (
              <Card key={oc.id} className={estado ? "opacity-60" : ""}>
                <CardHeader className="p-3 border-b bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary" />
                      Prévia de OC — {oc.fornecedorNome}
                    </div>
                    {estado === "confirmada" && <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmada</span>}
                    {estado === "cancelada" && <span className="text-xs text-red-600 font-medium flex items-center gap-1"><X className="w-3.5 h-3.5" /> Cancelada</span>}
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase text-muted-foreground text-left">
                        <th className="pb-1">Item</th>
                        <th className="pb-1 text-right">Qtd</th>
                        <th className="pb-1 text-right">Vl. Unit.</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(oc.itens ?? []).map((it: any) => (
                        <tr key={it.id} className="border-t">
                          <td className="py-1">{it.descricao}</td>
                          <td className="py-1 text-right tabular-nums">{Number(it.quantidade).toLocaleString("pt-BR")} {it.unidade ?? ""}</td>
                          <td className="py-1 text-right tabular-nums">{brl(it.valorUnitario)}</td>
                          <td className="py-1 text-right tabular-nums font-medium">{brl(it.quantidade * it.valorUnitario)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!estado && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Frete (do mapa, editável)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={ed?.frete ?? ""}
                          onChange={e => setEdits(p => ({ ...p, [oc.id]: { ...p[oc.id], frete: e.target.value } }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Desconto (do mapa, editável)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={ed?.desconto ?? ""}
                          onChange={e => setEdits(p => ({ ...p, [oc.id]: { ...p[oc.id], desconto: e.target.value } }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Observações (opcional)</label>
                        <input
                          type="text"
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={ed?.observacao ?? ""}
                          onChange={e => setEdits(p => ({ ...p, [oc.id]: { ...p[oc.id], observacao: e.target.value } }))}
                          placeholder="Ex: entregar no canteiro"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="text-sm">Total da OC: <span className="font-bold text-primary">{brl(total)}</span></span>
                    {!estado && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelar(oc)} disabled={cancelarMut.isPending}>
                          Cancelar prévia
                        </Button>
                        <Button size="sm" className="gap-1" onClick={() => confirmar(oc)} disabled={confirmarMut.isPending || updateMut.isPending}>
                          <CheckCircle2 className="w-4 h-4" /> Confirmar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant={todasTratadas ? "default" : "outline"} onClick={fecharComLimpeza}>
            {todasTratadas ? "Concluir" : "Fechar e descartar pendentes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Aba: ORDENS DE COMPRAS GERADAS ────────────────────────────────────────

function OrdensGeradas({ obraId }: { obraId: number }) {
  const { data: ocs = [], isLoading } = trpc.ordensCompra.listGeradas.useQuery({ obraId });
  const [verId, setVerId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const invalidar = () => {
    utils.ordensCompra.listGeradas.invalidate();
    utils.ordensCompra.pedidosProntos.invalidate();
  };

  const cancelarGeradaMut = trpc.ordensCompra.cancelarGerada.useMutation({
    onSuccess: () => { invalidar(); toast.info("OC cancelada. Os itens voltaram para Pedidos Prontos."); },
    onError: e => toast.error(e.message || "Erro ao cancelar OC"),
  });
  const excluirMut = trpc.ordensCompra.excluir.useMutation({
    onSuccess: () => { invalidar(); toast.success("OC excluída. Os itens voltaram para Pedidos Prontos."); },
    onError: e => toast.error(e.message || "Erro ao excluir OC"),
  });

  const cancelar = (oc: any) => {
    if (!window.confirm(`Cancelar a OC nº ${formatNumeroOC(oc.numero)} (${oc.fornecedorNome})?\n\nEla continuará na lista marcada como CANCELADA e os itens voltarão para Pedidos Prontos.`)) return;
    cancelarGeradaMut.mutate({ id: oc.id });
  };
  const excluir = (oc: any) => {
    const label = oc.status === "cancelada" ? "cancelada" : `nº ${formatNumeroOC(oc.numero)}`;
    if (!window.confirm(`Excluir definitivamente a OC ${label} (${oc.fornecedorNome})?\n\nO registro será apagado e os itens voltarão para Pedidos Prontos.`)) return;
    excluirMut.mutate({ id: oc.id });
  };

  if (isLoading) return <div className="flex justify-center py-14"><Spinner /></div>;

  if (!ocs.length) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhuma ordem de compra gerada nesta obra ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const busy = cancelarGeradaMut.isPending || excluirMut.isPending;

  return (
    <div className="space-y-2">
      {(ocs as any[]).map(oc => {
        const cancelada = oc.status === "cancelada";
        return (
          <div
            key={oc.id}
            className={`flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer ${cancelada ? "opacity-70" : ""}`}
            onClick={() => setVerId(oc.id)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${cancelada ? "line-through text-muted-foreground" : ""}`}>
                  OC nº {formatNumeroOC(oc.numero)}
                </span>
                <span className="text-sm text-muted-foreground truncate">— {oc.fornecedorNome}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(oc.criadoEm).toLocaleDateString("pt-BR")}</span>
                {oc.geradoPor && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {oc.geradoPor}</span>}
                {cancelada ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Cancelada</span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Gerada</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className={`font-bold tabular-nums ${cancelada ? "text-muted-foreground" : "text-primary"}`}>{brl(oc.valorTotal)}</div>
                <div className="text-[11px] text-muted-foreground">{oc.qtdItens} item(ns)</div>
              </div>
              {/* Ações — não abrem a visualização (stopPropagation) */}
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {!cancelada && (
                  <Button
                    size="sm" variant="ghost" title="Cancelar (mantém na lista)"
                    className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={() => cancelar(oc)} disabled={busy}
                  >
                    <Ban className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost" title="Excluir (apaga o registro)"
                  className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => excluir(oc)} disabled={busy}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {verId != null && <VisualizarOC id={verId} onFechar={() => setVerId(null)} />}
    </div>
  );
}

// ─── Visualização (somente leitura) + Exportar PDF ─────────────────────────

function VisualizarOC({ id, onFechar }: { id: number; onFechar: () => void }) {
  const { data: oc, isLoading } = trpc.ordensCompra.getById.useQuery({ id });

  const exportar = () => {
    if (!oc) return;
    exportOrdemCompraPDF({
      numero: oc.numero,
      dataEmissao: oc.criadoEm,
      obraNome: oc.obraNome,
      obraCodigo: oc.obraCodigo,
      obraEndereco: oc.obraEndereco ?? "",
      obraCno: oc.obraCno,
      pedidoNumeros: (oc as any).pedidoNumeros,
      condicaoPagamento: (oc as any).condicaoPagamento,
      fornecedorNome: oc.fornecedorNome,
      geradoPor: oc.geradoPor ?? "",
      fornecedor: (oc as any).fornecedor ? {
        cpfCnpj: (oc as any).fornecedor.cpfCnpj,
        inscEstadual: (oc as any).fornecedor.inscEstadual,
        inscMunicipal: (oc as any).fornecedor.inscMunicipal,
        endereco: (oc as any).fornecedor.endereco,
        numero: (oc as any).fornecedor.numero,
        bairro: (oc as any).fornecedor.bairro,
        cidade: (oc as any).fornecedor.cidade,
        uf: (oc as any).fornecedor.uf,
        cep: (oc as any).fornecedor.cep,
        telefone: (oc as any).fornecedor.telefone,
        contato: (oc as any).fornecedor.nomeContato,
        email: (oc as any).fornecedor.email,
      } : null,
      // Se houver entidade de faturamento escolhida, ela é o destinatário da nota;
      // senão, cai no cliente da obra.
      faturarPara: (oc as any).faturamento ? {
        nome: (oc as any).faturamento.nome,
        endereco: [(oc as any).faturamento.endereco, (oc as any).faturamento.numero].filter(Boolean).join(", "),
        cidade: (oc as any).faturamento.cidade,
        estado: (oc as any).faturamento.uf,
        cep: (oc as any).faturamento.cep,
      } : {
        nome: oc.obraCliente,
        endereco: oc.obraEndereco,
        cidade: oc.obraCidade,
        estado: oc.obraEstado,
        cep: oc.obraCep,
      },
      faturarCnpj: (oc as any).faturamento?.cpfCnpj ?? null,
      entrega: {
        endereco: oc.obraEnderecoEntrega,
        cidade: oc.obraCidadeEntrega,
        estado: oc.obraEstadoEntrega,
        cep: oc.obraCepEntrega,
      },
      itens: (oc.itens ?? []).map((it: any) => ({
        descricao: it.descricao, unidade: it.unidade, quantidade: it.quantidade, valorUnitario: it.valorUnitario,
      })),
      frete: oc.frete ?? 0,
      desconto: (oc as any).desconto ?? 0,
      observacao: oc.observacao,
    });
  };

  const totalItens = oc ? totalItensOC(oc.itens ?? []) : 0;
  const descontoOC = (oc as any)?.desconto ?? 0;
  const total = totalItens + (oc?.frete ?? 0) - descontoOC;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading || !oc ? (
          <div className="flex justify-center py-14"><Spinner /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                Ordem de Compra nº {formatNumeroOC(oc.numero)}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground text-xs block">Data de emissão</span>{new Date(oc.criadoEm).toLocaleString("pt-BR")}</div>
              <div><span className="text-muted-foreground text-xs block">Gerado por</span>{oc.geradoPor ?? "—"}</div>
              <div><span className="text-muted-foreground text-xs block">Obra</span>{oc.obraNome} ({oc.obraCodigo})</div>
              {oc.obraCno && <div><span className="text-muted-foreground text-xs block">CNO</span>{oc.obraCno}</div>}
              <div><span className="text-muted-foreground text-xs block">Fornecedor</span>{oc.fornecedorNome}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <div className="rounded-lg border p-3">
                <div className="text-[11px] uppercase text-muted-foreground font-semibold">Faturar para</div>
                {(oc as any).faturamento ? (
                  <>
                    <div className="text-sm font-semibold text-primary">{(oc as any).faturamento.nome}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {(oc as any).faturamento.cpfCnpj ? `CNPJ/CPF: ${(oc as any).faturamento.cpfCnpj}` : ""}
                      {[[(oc as any).faturamento.endereco, (oc as any).faturamento.numero].filter(Boolean).join(", "), [(oc as any).faturamento.cidade, (oc as any).faturamento.uf].filter(Boolean).join("/"), (oc as any).faturamento.cep].filter(Boolean).join(" – ")}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-primary">{oc.obraCliente || "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[oc.obraEndereco, [oc.obraCidade, oc.obraEstado].filter(Boolean).join("/"), oc.obraCep].filter(Boolean).join(" – ") || "—"}
                    </div>
                  </>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-[11px] uppercase text-muted-foreground font-semibold">Endereço de entrega</div>
                <div className="text-sm font-semibold text-primary">{oc.obraNome}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[oc.obraEnderecoEntrega, [oc.obraCidadeEntrega, oc.obraEstadoEntrega].filter(Boolean).join("/"), oc.obraCepEntrega].filter(Boolean).join(" – ") || oc.obraEndereco || "—"}
                </div>
              </div>
            </div>

            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-[11px] uppercase text-muted-foreground text-left border-b">
                  <th className="pb-1">Insumo</th>
                  <th className="pb-1 text-right">Qtd</th>
                  <th className="pb-1 text-right">Vl. Unit.</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(oc.itens ?? []).map((it: any) => (
                  <tr key={it.id} className="border-b">
                    <td className="py-1.5">{it.descricao}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(it.quantidade).toLocaleString("pt-BR")} {it.unidade ?? ""}</td>
                    <td className="py-1.5 text-right tabular-nums">{brl(it.valorUnitario)}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{brl(it.quantidade * it.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto w-full sm:w-1/2 text-sm space-y-1 mt-2">
              <div className="flex justify-between"><span>Subtotal dos itens</span><span className="tabular-nums">{brl(totalItens)}</span></div>
              <div className="flex justify-between"><span>Frete</span><span className="tabular-nums">{brl(oc.frete ?? 0)}</span></div>
              {descontoOC > 0 && <div className="flex justify-between text-red-600"><span>Desconto</span><span className="tabular-nums">− {brl(descontoOC)}</span></div>}
              <div className="flex justify-between font-bold text-primary border-t pt-1"><span>Total geral</span><span className="tabular-nums">{brl(total)}</span></div>
            </div>

            {oc.observacao && (
              <div className="mt-2 p-2 bg-muted/40 rounded text-sm border-l-2 border-primary">
                <span className="font-medium">Observações:</span> {oc.observacao}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onFechar}>Fechar</Button>
              <Button className="gap-2" onClick={exportar}><FileDown className="w-4 h-4" /> Exportar PDF</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────

export default function OrdensCompra() {
  const [obraId, setObraId] = useState<number | null>(null);
  const [aba, setAba] = useState<"prontos" | "geradas">("prontos");
  const [previas, setPrevias] = useState<any[] | null>(null);
  const { data: obras = [], isLoading: carregandoObras } = trpc.obras.list.useQuery();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Ordens de Compra</h1>
            <p className="text-sm text-muted-foreground">Gere ordens de compra a partir dos mapas de cotação concluídos</p>
          </div>
        </div>

        {/* Seletor de obra */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <label className="text-sm font-medium shrink-0">Selecionar obra:</label>
              {carregandoObras ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <select
                  className="flex-1 min-w-[220px] h-9 px-3 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={obraId ?? ""}
                  onChange={e => setObraId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— Selecione uma obra —</option>
                  {(obras as any[]).map(o => (
                    <option key={o.id} value={o.id}>{o.nome}{o.codigo ? ` (${o.codigo})` : ""}</option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo */}
        {!obraId ? (
          <Card>
            <CardContent className="py-14 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Selecione uma obra para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Abas */}
            <div className="flex items-center gap-1 border-b">
              {([
                { id: "prontos", label: "Pedidos Prontos" },
                { id: "geradas", label: "Ordens de Compras Geradas" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    aba === t.id ? "text-primary border-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {aba === "prontos"
              ? <PedidosProntos obraId={obraId} onGerou={(ocs) => { setPrevias(ocs); }} />
              : <OrdensGeradas obraId={obraId} />}
          </div>
        )}
      </div>

      {/* Revisão das prévias recém-geradas */}
      {previas && previas.length > 0 && obraId && (
        <RevisaoPrevias
          ocs={previas}
          obraId={obraId}
          obraCliente={(obras as any[]).find(o => o.id === obraId)?.cliente}
          onFechar={() => { setPrevias(null); setAba("geradas"); }}
        />
      )}
    </DashboardLayout>
  );
}
