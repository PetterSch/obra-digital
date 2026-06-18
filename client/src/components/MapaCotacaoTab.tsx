import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, ClipboardList, CheckCircle2, ChevronLeft, Trash2, FileDown, Pencil } from "lucide-react";

interface Props { obraId: number; obraNome: string; openMapaId?: number; }

type View = "landing" | "selecionar" | "editor";

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  rascunho: "Rascunho",
};
const STATUS_COR: Record<string, string> = {
  em_andamento: "bg-blue-100 text-blue-700",
  concluido: "bg-green-100 text-green-700",
  rascunho: "bg-gray-100 text-gray-600",
};

export function MapaCotacaoTab({ obraId, obraNome, openMapaId }: Props) {
  const [view, setView] = useState<View>(() => openMapaId != null ? "editor" : "landing");
  const [mapaEditId, setMapaEditId] = useState<number | null>(() => openMapaId ?? null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: mapas = [], refetch: refetchMapas } = trpc.mapaCotacao.listByObra.useQuery({ obraId });
  const { data: itensAprovados = [] } = trpc.mapaCotacao.getItensAprovados.useQuery(
    { obraId },
    { enabled: view === "selecionar" }
  );
  const { data: mapaAtual, refetch: refetchMapa } = trpc.mapaCotacao.getById.useQuery(
    { id: mapaEditId! },
    { enabled: mapaEditId !== null }
  );

  const createMut = trpc.mapaCotacao.create.useMutation({
    onSuccess: async (res) => {
      await refetchMapas();
      setMapaEditId(res.id);
      setView("editor");
      toast.success("Mapa criado!");
    },
    onError: () => toast.error("Erro ao criar mapa"),
  });
  const deleteMut = trpc.mapaCotacao.delete.useMutation({
    onSuccess: () => { refetchMapas(); setDeleteId(null); toast.success("Mapa excluído"); },
  });

  const emAndamento = mapas.filter((m: any) => m.status !== "concluido");
  const concluidos = mapas.filter((m: any) => m.status === "concluido");

  // Item selection grouped by pedido
  const itensPorPedido = useMemo(() => {
    const map = new Map<number, { pedidoNumero: string; itens: any[] }>();
    for (const item of itensAprovados) {
      if (!map.has(item.pedidoId)) map.set(item.pedidoId, { pedidoNumero: item.pedidoNumero, itens: [] });
      map.get(item.pedidoId)!.itens.push(item);
    }
    return Array.from(map.entries()).map(([pedidoId, v]) => ({ pedidoId, ...v }));
  }, [itensAprovados]);

  function toggleItem(id: number) {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function togglePedido(itens: any[]) {
    const ids = itens.map((i: any) => i.id);
    const allSelected = ids.every(id => selectedItemIds.has(id));
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id)); else ids.forEach(id => next.add(id));
      return next;
    });
  }

  function montarMapa() {
    const itens = itensAprovados
      .filter((i: any) => selectedItemIds.has(i.id))
      .map((i: any) => ({
        pedidoItemId: i.id != null ? Number(i.id) : undefined,
        descricao: String(i.descricao ?? ""),
        unidade: i.unidade ?? undefined,
        quantidade: Number(i.quantidade),
        observacao: i.observacao ?? undefined,
      }));
    createMut.mutate({ obraId, itens });
  }

  function abrirMapa(id: number) {
    setMapaEditId(id);
    setView("editor");
  }

  if (view === "selecionar") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("landing")}><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Button>
          <h3 className="font-semibold text-lg">Selecionar Itens Aprovados</h3>
        </div>
        {itensAprovados.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Nenhum item aprovado nos pedidos desta obra. Aprove itens em "Pedido de Compra" primeiro.
          </CardContent></Card>
        ) : (
          <>
            <div className="space-y-3">
              {itensPorPedido.map(({ pedidoId, pedidoNumero, itens }) => {
                const allSel = itens.every(i => selectedItemIds.has(i.id));
                return (
                  <Card key={pedidoId}>
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={allSel} onChange={() => togglePedido(itens)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer" />
                        <span className="font-semibold text-sm">Pedido #{pedidoNumero || pedidoId}</span>
                        <span className="text-xs text-muted-foreground">({itens.length} {itens.length === 1 ? "item" : "itens"})</span>
                      </div>
                      <div className="space-y-1 pl-6">
                        {itens.map((item: any) => (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                            <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleItem(item.id)}
                              className="w-4 h-4 accent-blue-600 cursor-pointer" />
                            <span className="text-sm flex-1">{item.descricao}</span>
                            <span className="text-xs text-muted-foreground">{Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setView("landing")}>Cancelar</Button>
              <Button disabled={selectedItemIds.size === 0 || createMut.isPending} onClick={montarMapa}>
                {createMut.isPending ? "Criando..." : `Montar Mapa (${selectedItemIds.size} itens)`}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (view === "editor" && mapaEditId !== null) {
    return (
      <MapaEditor
        mapa={mapaAtual ?? null}
        obraNome={obraNome}
        onBack={() => { setView("landing"); setMapaEditId(null); refetchMapas(); }}
        onSaved={refetchMapa}
      />
    );
  }

  // Landing
  return (
    <div className="space-y-6">
      {/* 3 opções centrais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="cursor-pointer border-dashed border-2 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
          onClick={() => { setSelectedItemIds(new Set()); setView("selecionar"); }}>
          <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <p className="font-semibold text-center">Montar Novo Mapa</p>
            <p className="text-xs text-muted-foreground text-center">Selecione itens aprovados e crie um mapa de cotação</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-amber-600" />
            </div>
            <p className="font-semibold text-center">Mapas em Andamento</p>
            <Badge variant="secondary" className="text-base px-3">{emAndamento.length}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold text-center">Mapas Concluídos</p>
            <Badge variant="secondary" className="text-base px-3">{concluidos.length}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Lista de mapas */}
      {mapas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum mapa criado ainda.</CardContent></Card>
      ) : (
        <>
          {emAndamento.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Em Andamento</h4>
              <div className="space-y-2">
                {emAndamento.map((m: any) => <MapaCard key={m.id} mapa={m} onOpen={() => abrirMapa(m.id)} onDelete={() => setDeleteId(m.id)} />)}
              </div>
            </div>
          )}
          {concluidos.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Concluídos</h4>
              <div className="space-y-2">
                {concluidos.map((m: any) => <MapaCard key={m.id} mapa={m} onOpen={() => abrirMapa(m.id)} onDelete={() => setDeleteId(m.id)} />)}
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mapa de Cotação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os preços inseridos serão perdidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMut.mutate({ id: deleteId })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MapaCard({ mapa, onOpen, onDelete }: { mapa: any; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Mapa #{mapa.numero}</span>
            {mapa.titulo && <span className="text-sm text-muted-foreground">— {mapa.titulo}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[mapa.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL[mapa.status] ?? mapa.status}
            </span>
            <span className="text-xs text-muted-foreground">{mapa.totalItens} itens</span>
            {mapa.totalFornecedores > 0 && <span className="text-xs text-muted-foreground">{mapa.totalFornecedores} fornecedores</span>}
            {mapa.criadoPor && <span className="text-xs text-muted-foreground">por {mapa.criadoPor}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={onOpen}>
          <Pencil className="w-3.5 h-3.5" /> Abrir
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ==================== EDITOR ====================

interface EditorProps {
  mapa: any;
  obraNome: string;
  onBack: () => void;
  onSaved: () => void;
}

function MapaEditor({ mapa, obraNome, onBack, onSaved }: EditorProps) {
  const [titulo, setTitulo] = useState(mapa?.titulo ?? "");
  const [localAplicacao, setLocalAplicacao] = useState(mapa?.localAplicacao ?? "");
  const [dataAplicacao, setDataAplicacao] = useState(mapa?.dataAplicacao ? String(mapa.dataAplicacao).slice(0, 10) : "");
  const [observacao, setObservacao] = useState(mapa?.observacao ?? "");

  // Fornecedores local state (dinâmico)
  const [fornecedores, setFornecedores] = useState<any[]>(() => {
    if (!mapa?.fornecedores?.length) return [];
    return mapa.fornecedores.map((f: any) => ({
      id: f.id, ordem: f.ordem,
      nome: f.nome ?? "", contato: f.contato ?? "", telefone: f.telefone ?? "",
      desconto: Number(f.desconto ?? 0), frete: Number(f.frete ?? 0),
      condicaoPagamento: f.condicaoPagamento ?? "",
    }));
  });

  const addFornecedorMut = trpc.mapaCotacao.addFornecedor.useMutation({
    onSuccess: (res) => {
      setFornecedores(prev => [...prev, {
        id: res.id, ordem: res.ordem,
        nome: "", contato: "", telefone: "",
        desconto: 0, frete: 0, condicaoPagamento: "",
      }]);
    },
    onError: () => toast.error("Erro ao adicionar fornecedor"),
  });

  function adicionarFornecedor() {
    if (!mapa) return;
    addFornecedorMut.mutate({ mapaId: mapa.id });
  }

  // Itens local state
  const [itens, setItens] = useState<any[]>(() =>
    (mapa?.itens ?? []).map((i: any) => ({ ...i, quantidade: Number(i.quantidade) }))
  );

  // Cotacoes: key = `${itemIndex}-${fornecedorIndex}` → valor (string for input)
  const [cotacoes, setCotacoes] = useState<Record<string, string>>(() => {
    if (!mapa?.cotacoes?.length || !mapa?.itens?.length || !mapa?.fornecedores?.length) return {};
    const result: Record<string, string> = {};
    for (const c of mapa.cotacoes) {
      const iIdx = mapa.itens.findIndex((i: any) => i.id === c.mapaItemId);
      const fIdx = mapa.fornecedores.findIndex((f: any) => f.id === c.mapaFornecedorId);
      if (iIdx >= 0 && fIdx >= 0 && Number(c.valorUnitario) > 0) {
        result[`${iIdx}-${fIdx}`] = String(Number(c.valorUnitario));
      }
    }
    return result;
  });

  // Sync state when mapa loads or changes (keyed by mapa.id)
  useEffect(() => {
    if (!mapa) return;
    setTitulo(mapa.titulo ?? "");
    setLocalAplicacao(mapa.localAplicacao ?? "");
    setDataAplicacao(mapa.dataAplicacao ? String(mapa.dataAplicacao).slice(0, 10) : "");
    setObservacao(mapa.observacao ?? "");
    setFornecedores((mapa.fornecedores ?? []).map((f: any) => ({
      id: f.id, ordem: f.ordem,
      nome: f.nome ?? "", contato: f.contato ?? "", telefone: f.telefone ?? "",
      desconto: Number(f.desconto ?? 0), frete: Number(f.frete ?? 0),
      condicaoPagamento: f.condicaoPagamento ?? "",
    })));

    setItens((mapa.itens ?? []).map((i: any) => ({ ...i, quantidade: Number(i.quantidade) })));
    const nc: Record<string, string> = {};
    for (const c of mapa.cotacoes ?? []) {
      const iIdx = (mapa.itens ?? []).findIndex((i: any) => i.id === c.mapaItemId);
      const fIdx = (mapa.fornecedores ?? []).findIndex((f: any) => f.id === c.mapaFornecedorId);
      if (iIdx >= 0 && fIdx >= 0 && Number(c.valorUnitario) > 0) {
        nc[`${iIdx}-${fIdx}`] = String(Number(c.valorUnitario));
      }
    }
    setCotacoes(nc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa?.id]);

  const updateMut = trpc.mapaCotacao.update.useMutation({
    onSuccess: () => { onSaved(); toast.success("Mapa salvo!"); },
    onError: () => toast.error("Erro ao salvar mapa"),
  });

  function getPreco(iIdx: number, fIdx: number): number {
    const v = parseFloat(cotacoes[`${iIdx}-${fIdx}`] ?? "");
    return isNaN(v) || v <= 0 ? 0 : v;
  }

  function getIdealUnit(iIdx: number): number {
    const precos = fornecedores.map((_, fIdx) => getPreco(iIdx, fIdx)).filter(p => p > 0);
    return precos.length > 0 ? Math.min(...precos) : 0;
  }

  function getIdealFornIdx(iIdx: number): number {
    const ideal = getIdealUnit(iIdx);
    if (ideal <= 0) return -1;
    return fornecedores.findIndex((_, fIdx) => getPreco(iIdx, fIdx) === ideal);
  }

  // Subtotal por fornecedor (antes de desconto/frete)
  function getSubtotal(fIdx: number): number {
    return itens.reduce((sum, _, iIdx) => {
      return sum + getPreco(iIdx, fIdx) * (itens[iIdx]?.quantidade ?? 0);
    }, 0);
  }
  function getIdealSubtotal(): number {
    return itens.reduce((sum, item, iIdx) => {
      return sum + getIdealUnit(iIdx) * (item.quantidade ?? 0);
    }, 0);
  }
  function getTotal(fIdx: number): number {
    return getSubtotal(fIdx) - (fornecedores[fIdx]?.desconto ?? 0) + (fornecedores[fIdx]?.frete ?? 0);
  }
  function getIdealTotal(): number {
    const descIdeal = Math.min(...fornecedores.map(f => f.desconto ?? 0).filter(d => d > 0), 0);
    const freteIdeal = Math.min(...fornecedores.map(f => f.frete ?? 0).filter(f => f > 0), 0);
    return getIdealSubtotal() - descIdeal + freteIdeal;
  }

  function salvar(status?: string) {
    if (!mapa) return;
    const cotacoesArray: { itemIndex: number; fornecedorId: number; valorUnitario: number }[] = [];
    for (const [key, val] of Object.entries(cotacoes)) {
      const [iIdxStr, fIdxStr] = key.split("-");
      const iIdx = Number(iIdxStr);
      const fIdx = Number(fIdxStr);
      const valor = parseFloat(val);
      const forn = fornecedores[fIdx];
      if (forn && !isNaN(valor) && valor > 0) {
        cotacoesArray.push({ itemIndex: iIdx, fornecedorId: forn.id, valorUnitario: valor });
      }
    }
    updateMut.mutate({
      id: mapa.id,
      titulo: titulo || undefined,
      localAplicacao: localAplicacao || undefined,
      dataAplicacao: dataAplicacao || undefined,
      observacao: observacao || undefined,
      status: status ?? mapa.status,
      fornecedores: fornecedores.map(f => ({
        id: f.id,
        nome: f.nome || undefined,
        contato: f.contato || undefined,
        telefone: f.telefone || undefined,
        desconto: f.desconto,
        frete: f.frete,
        condicaoPagamento: f.condicaoPagamento || undefined,
      })),
      itens: itens.map(i => ({
        pedidoItemId: i.pedidoItemId ?? undefined,
        descricao: i.descricao,
        unidade: i.unidade ?? undefined,
        quantidade: i.quantidade,
        observacao: i.observacao ?? undefined,
      })),
      cotacoes: cotacoesArray,
    });
  }

  function exportarExcel() {
    // Monta HTML para print/export visual
    const fornAtivos = fornecedores.filter(f => f.nome);
    let html = `<html><head><meta charset="utf-8"><title>Mapa de Cotação #${mapa?.numero}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #aaa;padding:3px 6px;text-align:center}
    th{background:#1E3A5F;color:#fff;font-weight:bold}
    .left{text-align:left}.ideal{background:#e8f5e9;color:#1b5e20;font-weight:bold}
    .forn-header{background:#2a5090;color:#fff}
    .subtotal{background:#f5f5f5;font-weight:bold}
    </style></head><body>
    <h2 style="text-align:center">REQUISIÇÃO DE MATERIAIS E COLETA DE PREÇOS</h2>
    <table style="margin-bottom:8px;border:none">
      <tr><td style="border:none"><b>OBRA:</b> ${obraNome}</td><td style="border:none"><b>Mapa #</b>${mapa?.numero}</td></tr>
      <tr><td style="border:none"><b>Título:</b> ${titulo || "—"}</td><td style="border:none"><b>Data:</b> ${dataAplicacao || "—"}</td></tr>
      ${localAplicacao ? `<tr><td colspan="2" style="border:none"><b>Local de Aplicação:</b> ${localAplicacao}</td></tr>` : ""}
    </table>
    <table><thead><tr>
      <th>#</th><th class="left">Descrição</th><th>UND</th><th>Quant.</th>`;
    (fornAtivos.length > 0 ? fornAtivos : fornecedores.slice(0, 1)).forEach((f, fi) => {
      html += `<th colspan="2" class="forn-header">${f.nome || `Fornecedor ${f.ordem}`}<br><small>${f.contato || ""}</small></th>`;
    });
    html += `<th colspan="2" class="ideal">R$ IDEAL</th></tr>
    <tr><th></th><th></th><th></th><th></th>`;
    (fornAtivos.length > 0 ? fornAtivos : fornecedores.slice(0, 1)).forEach(() => {
      html += `<th>R$ Unit.</th><th>R$ Total</th>`;
    });
    html += `<th class="ideal">R$ Unit.</th><th class="ideal">R$ Total</th></tr></thead><tbody>`;

    const activeFornIdx = (fornAtivos.length > 0 ? fornAtivos : fornecedores.slice(0, 1))
      .map(f => fornecedores.findIndex(ff => ff.id === f.id));

    itens.forEach((item, iIdx) => {
      const idealUnit = getIdealUnit(iIdx);
      const idealTotal = idealUnit * item.quantidade;
      html += `<tr><td>${iIdx + 1}</td><td class="left">${item.descricao}</td><td>${item.unidade || ""}</td><td>${item.quantidade}</td>`;
      activeFornIdx.forEach(fIdx => {
        const unit = getPreco(iIdx, fIdx);
        const total = unit * item.quantidade;
        const isIdeal = fIdx === getIdealFornIdx(iIdx);
        html += `<td style="${isIdeal ? "background:#c8e6c9;" : ""}">${unit > 0 ? fmtMoeda(unit) : "—"}</td>
          <td style="${isIdeal ? "background:#c8e6c9;" : ""}">${unit > 0 ? fmtMoeda(total) : "—"}</td>`;
      });
      html += `<td class="ideal">${idealUnit > 0 ? fmtMoeda(idealUnit) : "—"}</td><td class="ideal">${idealTotal > 0 ? fmtMoeda(idealTotal) : "—"}</td></tr>`;
    });

    html += `<tr class="subtotal"><td colspan="4" class="left">SUBTOTAL</td>`;
    activeFornIdx.forEach(fIdx => {
      const st = getSubtotal(fIdx);
      html += `<td></td><td>${st > 0 ? fmtMoeda(st) : "—"}</td>`;
    });
    html += `<td></td><td class="ideal">${getIdealSubtotal() > 0 ? fmtMoeda(getIdealSubtotal()) : "—"}</td></tr>`;

    html += `<tr><td colspan="4" class="left">DESCONTO</td>`;
    activeFornIdx.forEach(fIdx => {
      html += `<td></td><td>${fornecedores[fIdx]?.desconto > 0 ? fmtMoeda(fornecedores[fIdx].desconto) : "—"}</td>`;
    });
    html += `<td></td><td>—</td></tr>`;

    html += `<tr><td colspan="4" class="left">FRETE</td>`;
    activeFornIdx.forEach(fIdx => {
      html += `<td></td><td>${fornecedores[fIdx]?.frete > 0 ? fmtMoeda(fornecedores[fIdx].frete) : "—"}</td>`;
    });
    html += `<td></td><td>—</td></tr>`;

    html += `<tr class="subtotal"><td colspan="4" class="left">TOTAL</td>`;
    activeFornIdx.forEach(fIdx => {
      const tot = getTotal(fIdx);
      html += `<td></td><td>${tot > 0 ? fmtMoeda(tot) : "—"}</td>`;
    });
    html += `<td></td><td class="ideal">${getIdealTotal() > 0 ? fmtMoeda(getIdealTotal()) : "—"}</td></tr>`;

    html += `</tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  if (!mapa) {
    return <div className="py-20 text-center text-muted-foreground">Carregando mapa...</div>;
  }

  const isConcluido = mapa.status === "concluido";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Button>
          <div>
            <h3 className="font-semibold text-lg">Mapa #{mapa.numero}</h3>
            <p className="text-xs text-muted-foreground">{obraNome}</p>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[mapa.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABEL[mapa.status] ?? mapa.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel}><FileDown className="w-4 h-4 mr-1" />Exportar</Button>
          {!isConcluido && (
            <>
              <Button variant="outline" size="sm" disabled={updateMut.isPending} onClick={() => salvar()}>
                {updateMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" onClick={() => salvar("concluido")}>
                <CheckCircle2 className="w-4 h-4 mr-1" />Concluir
              </Button>
            </>
          )}
          {isConcluido && (
            <Button variant="outline" size="sm" onClick={() => salvar("em_andamento")}>Reabrir</Button>
          )}
        </div>
      </div>

      {/* Meta */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Título</label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Estrutura 2º pavimento" disabled={isConcluido} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Local de Aplicação</label>
              <Input value={localAplicacao} onChange={e => setLocalAplicacao(e.target.value)}
                placeholder="Ex: Bloco A" disabled={isConcluido} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data de Aplicação</label>
              <Input type="date" value={dataAplicacao} onChange={e => setDataAplicacao(e.target.value)} disabled={isConcluido} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fornecedores */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fornecedores</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {fornecedores.map((f, fi) => (
              <div key={f.id} className="space-y-1.5 border rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700">Fornecedor {f.ordem}</p>
                <Input placeholder="Nome do fornecedor" value={f.nome}
                  onChange={e => setFornecedores(prev => prev.map((ff, i) => i === fi ? { ...ff, nome: e.target.value } : ff))}
                  disabled={isConcluido} className="h-8 text-sm" />
                <Input placeholder="Contato" value={f.contato}
                  onChange={e => setFornecedores(prev => prev.map((ff, i) => i === fi ? { ...ff, contato: e.target.value } : ff))}
                  disabled={isConcluido} className="h-8 text-sm" />
                <Input placeholder="Telefone" value={f.telefone}
                  onChange={e => setFornecedores(prev => prev.map((ff, i) => i === fi ? { ...ff, telefone: e.target.value } : ff))}
                  disabled={isConcluido} className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground font-medium">Desconto (R$)</label>
                    <Input type="number" min="0" step="0.01" placeholder="0,00"
                      value={f.desconto > 0 ? f.desconto : ""}
                      onChange={e => setFornecedores(prev => prev.map((ff, i) => i === fi ? { ...ff, desconto: parseFloat(e.target.value) || 0 } : ff))}
                      disabled={isConcluido} className="h-8 text-sm text-right" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground font-medium">Frete (R$)</label>
                    <Input type="number" min="0" step="0.01" placeholder="0,00"
                      value={f.frete > 0 ? f.frete : ""}
                      onChange={e => setFornecedores(prev => prev.map((ff, i) => i === fi ? { ...ff, frete: parseFloat(e.target.value) || 0 } : ff))}
                      disabled={isConcluido} className="h-8 text-sm text-right" />
                  </div>
                </div>
              </div>
            ))}
            {!isConcluido && (
              <button
                onClick={adicionarFornecedor}
                disabled={addFornecedorMut.isPending}
                className="border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/40 transition-colors min-h-[160px] disabled:opacity-50">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {addFornecedorMut.isPending ? "Adicionando..." : "Adicionar Fornecedor"}
                </span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de preços */}
      <Card>
        <CardContent className="pt-4 pb-2 px-2 overflow-x-auto">
          <table className="min-w-max w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="border bg-slate-700 text-white px-2 py-1.5 text-center w-8">#</th>
                <th className="border bg-slate-700 text-white px-2 py-1.5 text-left min-w-[200px]">Descrição</th>
                <th className="border bg-slate-700 text-white px-2 py-1.5 text-center w-14">UND</th>
                <th className="border bg-slate-700 text-white px-2 py-1.5 text-center w-16">Quant.</th>
                {fornecedores.map((f, fi) => (
                  <th key={fi} colSpan={2}
                    className="border bg-blue-800 text-white px-2 py-1.5 text-center min-w-[160px]">
                    {f.nome || `Fornecedor ${f.ordem}`}
                  </th>
                ))}
                <th colSpan={2} className="border bg-green-800 text-white px-2 py-1.5 text-center min-w-[160px]">R$ IDEAL</th>
              </tr>
              <tr>
                <th className="border bg-slate-600 text-white px-1 py-1 text-center" colSpan={4}></th>
                {fornecedores.map((_, fi) => (
                  <>
                    <th key={`u${fi}`} className="border bg-blue-700 text-white px-2 py-1 text-center w-24">R$ Unit.</th>
                    <th key={`t${fi}`} className="border bg-blue-700 text-white px-2 py-1 text-center w-24">R$ Total</th>
                  </>
                ))}
                <th className="border bg-green-700 text-white px-2 py-1 text-center w-24">R$ Unit.</th>
                <th className="border bg-green-700 text-white px-2 py-1 text-center w-24">R$ Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 && (
                <tr><td colSpan={4 + fornecedores.length * 2 + 2} className="text-center text-muted-foreground py-6">Nenhum item no mapa.</td></tr>
              )}
              {itens.map((item, iIdx) => {
                const idealUnit = getIdealUnit(iIdx);
                const idealFornIdx = getIdealFornIdx(iIdx);
                return (
                  <tr key={iIdx} className="hover:bg-muted/30">
                    <td className="border px-2 py-1 text-center text-muted-foreground">{iIdx + 1}</td>
                    <td className="border px-2 py-1">
                      <div className="font-medium">{item.descricao}</div>
                      {item.observacao && <div className="text-xs text-muted-foreground">{item.observacao}</div>}
                    </td>
                    <td className="border px-2 py-1 text-center">{item.unidade || "—"}</td>
                    <td className="border px-2 py-1 text-center">{item.quantidade}</td>
                    {fornecedores.map((_, fIdx) => {
                      const unit = getPreco(iIdx, fIdx);
                      const total = unit * item.quantidade;
                      const isIdeal = fIdx === idealFornIdx && unit > 0;
                      return (
                        <>
                          <td key={`u${fIdx}`}
                            className={`border px-1 py-0.5 ${isIdeal ? "bg-green-50" : ""}`}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={isConcluido}
                              className={`w-full text-right text-sm outline-none bg-transparent ${isIdeal ? "text-green-700 font-semibold" : ""}`}
                              value={cotacoes[`${iIdx}-${fIdx}`] ?? ""}
                              onChange={e => setCotacoes(prev => ({ ...prev, [`${iIdx}-${fIdx}`]: e.target.value }))}
                              placeholder="0,00"
                            />
                          </td>
                          <td key={`t${fIdx}`}
                            className={`border px-2 py-1 text-right text-sm ${isIdeal ? "bg-green-50 text-green-700 font-semibold" : "text-muted-foreground"}`}>
                            {total > 0 ? fmtMoeda(total) : "—"}
                          </td>
                        </>
                      );
                    })}
                    <td className="border px-2 py-1 text-right text-sm font-semibold text-green-700 bg-green-50/60">
                      {idealUnit > 0 ? fmtMoeda(idealUnit) : "—"}
                    </td>
                    <td className="border px-2 py-1 text-right text-sm font-semibold text-green-700 bg-green-50/60">
                      {idealUnit > 0 ? fmtMoeda(idealUnit * item.quantidade) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer */}
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="border px-2 py-1.5 text-right text-xs uppercase text-muted-foreground">Subtotal</td>
                {fornecedores.map((_, fIdx) => (
                  <>
                    <td key={`su${fIdx}`} className="border px-1 py-1.5"></td>
                    <td key={`st${fIdx}`} className="border px-2 py-1.5 text-right text-sm">
                      {getSubtotal(fIdx) > 0 ? fmtMoeda(getSubtotal(fIdx)) : "—"}
                    </td>
                  </>
                ))}
                <td className="border px-1 py-1.5 bg-green-50/60"></td>
                <td className="border px-2 py-1.5 text-right text-sm text-green-700 bg-green-50/60">
                  {getIdealSubtotal() > 0 ? fmtMoeda(getIdealSubtotal()) : "—"}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="border px-2 py-1.5 text-right text-xs uppercase text-muted-foreground">Desconto</td>
                {fornecedores.map((f, fIdx) => (
                  <>
                    <td key={`du${fIdx}`} className="border px-1 py-1.5"></td>
                    <td key={`dt${fIdx}`} className="border px-2 py-1.5 text-right text-sm text-muted-foreground">
                      {f.desconto > 0 ? `- ${fmtMoeda(f.desconto)}` : "—"}
                    </td>
                  </>
                ))}
                <td className="border bg-green-50/60"></td>
                <td className="border px-2 py-1.5 text-right text-sm text-muted-foreground bg-green-50/60">—</td>
              </tr>
              <tr>
                <td colSpan={4} className="border px-2 py-1.5 text-right text-xs uppercase text-muted-foreground">Frete</td>
                {fornecedores.map((f, fIdx) => (
                  <>
                    <td key={`fu${fIdx}`} className="border px-1 py-1.5"></td>
                    <td key={`ft${fIdx}`} className="border px-2 py-1.5 text-right text-sm text-muted-foreground">
                      {f.frete > 0 ? `+ ${fmtMoeda(f.frete)}` : "—"}
                    </td>
                  </>
                ))}
                <td className="border bg-green-50/60"></td>
                <td className="border px-2 py-1.5 text-right text-sm text-muted-foreground bg-green-50/60">—</td>
              </tr>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={4} className="border px-2 py-1.5 text-right text-xs uppercase">Total</td>
                {fornecedores.map((_, fIdx) => (
                  <>
                    <td key={`tu${fIdx}`} className="border px-1 py-1.5"></td>
                    <td key={`tt${fIdx}`} className="border px-2 py-1.5 text-right text-sm">
                      {getTotal(fIdx) > 0 ? fmtMoeda(getTotal(fIdx)) : "—"}
                    </td>
                  </>
                ))}
                <td className="border bg-green-100/60"></td>
                <td className="border px-2 py-1.5 text-right text-sm text-green-700 bg-green-100/60">
                  {getIdealTotal() > 0 ? fmtMoeda(getIdealTotal()) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Observação */}
      {!isConcluido && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Observações</label>
          <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Observações gerais..." />
        </div>
      )}
    </div>
  );
}
