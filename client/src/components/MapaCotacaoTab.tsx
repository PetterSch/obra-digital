import { useState, useMemo, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, ClipboardList, CheckCircle2, ChevronLeft, Trash2, FileDown, Pencil } from "lucide-react";
import { getPDFConfig } from "@/lib/pdfExport";

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
    const selecionados = itensAprovados.filter((i: any) => selectedItemIds.has(i.id));
    const itens = selecionados.map((i: any) => ({
      pedidoItemId: i.id != null ? Number(i.id) : undefined,
      descricao: String(i.descricao ?? ""),
      unidade: i.unidade ?? undefined,
      quantidade: Number(i.quantidade),
      observacao: i.observacao ?? undefined,
    }));
    // Coleta localAplicacao únicos dos pedidos selecionados
    const locaisSet = selecionados.map((i: any) => i.pedidoLocalAplicacao as string).filter(Boolean);
    const locais = locaisSet.filter((v, idx, arr) => arr.indexOf(v) === idx).join(" | ");
    createMut.mutate({ obraId, itens, localAplicacao: locais || undefined });
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

// ==================== FORNECEDOR CARD COM BUSCA ====================

interface FornecedorCardProps {
  forn: { id: number; ordem: number; nome: string; contato: string; telefone: string; desconto: number; frete: number; condicaoPagamento: string };
  index: number;
  isConcluido: boolean;
  canRemove: boolean;
  onRemove: () => void;
  onUpdate: (patch: Partial<{ nome: string; contato: string; telefone: string }>) => void;
}

function FornecedorCard({ forn, isConcluido, canRemove, onRemove, onUpdate }: FornecedorCardProps) {
  const { data: baseFornecedores = [] } = trpc.fornecedores.list.useQuery();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return (baseFornecedores as any[]).slice(0, 8);
    return (baseFornecedores as any[]).filter((f: any) =>
      f.nome.toLowerCase().includes(q) ||
      (f.nomeFantasia ?? "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [baseFornecedores, busca]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selecionar(f: any) {
    onUpdate({ nome: f.nome, contato: f.nomeContato ?? "", telefone: f.telefone ?? "" });
    setBusca("");
    setAberto(false);
  }

  function limpar() {
    onUpdate({ nome: "", contato: "", telefone: "" });
    setBusca("");
  }

  const temFornecedor = !!forn.nome;

  return (
    <div className="relative space-y-1.5 border rounded-lg p-3">
      {!isConcluido && canRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors"
          title="Remover fornecedor">
          <X className="w-3 h-3" />
        </button>
      )}
      <p className="text-xs font-semibold text-blue-700 pr-6">Fornecedor {forn.ordem}</p>

      {!isConcluido && (
        <div ref={ref} className="relative">
          <div className="relative">
            <Input
              className="h-8 text-sm pr-7"
              placeholder="Pesquisar fornecedor..."
              value={busca}
              onFocus={() => setAberto(true)}
              onChange={e => { setBusca(e.target.value); setAberto(true); }}
            />
            {busca && (
              <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {aberto && filtrados.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
              {filtrados.map((f: any) => (
                <button
                  key={f.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); selecionar(f); }}>
                  <p className="font-medium truncate">{f.nome}</p>
                  {f.nomeFantasia && f.nomeFantasia !== f.nome && (
                    <p className="text-xs text-muted-foreground truncate">{f.nomeFantasia}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {temFornecedor ? (
        <div className="space-y-1 pt-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Razão Social</p>
              <p className="text-sm font-medium truncate">{forn.nome}</p>
            </div>
            {!isConcluido && (
              <button onClick={limpar} className="text-xs text-muted-foreground hover:text-destructive mt-3 shrink-0" title="Limpar">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nome do Vendedor</p>
            {isConcluido
              ? <p className="text-sm">{forn.contato || "—"}</p>
              : <Input value={forn.contato} onChange={e => onUpdate({ contato: e.target.value })} placeholder="Nome do vendedor" className="h-7 text-sm mt-0.5" />
            }
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telefone</p>
            {isConcluido
              ? <p className="text-sm">{forn.telefone || "—"}</p>
              : <Input value={forn.telefone} onChange={e => onUpdate({ telefone: e.target.value })} placeholder="Telefone" className="h-7 text-sm mt-0.5" />
            }
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic pt-1">Nenhum fornecedor selecionado</p>
      )}
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

  const removeFornecedorMut = trpc.mapaCotacao.removeFornecedor.useMutation({
    onSuccess: (_, vars) => {
      const fIdx = fornecedores.findIndex(f => f.id === vars.fornecedorId);
      setFornecedores(prev =>
        prev
          .filter(f => f.id !== vars.fornecedorId)
          .map((f, i) => ({ ...f, ordem: i + 1 }))
      );
      if (fIdx >= 0) {
        setCotacoes(prev => {
          const next: Record<string, string> = {};
          for (const [key, val] of Object.entries(prev)) {
            const [iIdxStr, fIdxStr] = key.split("-");
            const fi = Number(fIdxStr);
            if (fi === fIdx) continue;
            next[`${iIdxStr}-${fi > fIdx ? fi - 1 : fi}`] = val;
          }
          return next;
        });
      }
      toast.success("Fornecedor removido");
    },
    onError: () => toast.error("Erro ao remover fornecedor"),
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
    const cfg = getPDFConfig();
    const fornAtivos = fornecedores.filter(f => f.nome);
    const activeFornIdx = (fornAtivos.length > 0 ? fornAtivos : fornecedores.slice(0, 1))
      .map(f => fornecedores.findIndex(ff => ff.id === f.id));
    const dataHoje = new Date().toLocaleDateString("pt-BR");

    // Cores base
    const COR_HEADER = "#1a3a5c";
    const COR_FORN   = "#1e4976";
    const COR_IDEAL  = "#145a32";
    const COR_IDEAL_BG = "#eafaf1";
    const COR_STRIPE = "#f4f6f9";
    const COR_FOOT   = "#2c3e50";

    const logoHTML = cfg.logoBase64
      ? `<img src="${cfg.logoBase64}" style="height:52px;max-width:160px;object-fit:contain;" />`
      : `<div style="font-size:20px;font-weight:700;color:${COR_HEADER};">${cfg.empresaNome || "Obra Digital"}</div>`;

    const empresaInfo = [
      cfg.empresaNome ? `<strong>${cfg.empresaNome}</strong>` : null,
      cfg.cnpj        ? `CNPJ: ${cfg.cnpj}` : null,
      cfg.endereco    ? cfg.endereco : null,
      cfg.telefone    ? `Tel: ${cfg.telefone}` : null,
      cfg.email       ? cfg.email : null,
    ].filter(Boolean).join(" &nbsp;|&nbsp; ");

    let html = `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8">
<title>Mapa de Cotação #${mapa?.numero} — ${obraNome}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #222; background: #fff; }

  /* ── Cabeçalho ── */
  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 8px; border-bottom: 3px solid ${COR_HEADER}; margin-bottom: 8px;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .empresa-info { font-size: 8px; color: #555; margin-top: 3px; }
  .header-right { text-align: right; }
  .doc-title { font-size: 13px; font-weight: 700; color: ${COR_HEADER}; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-sub { font-size: 8.5px; color: #666; margin-top: 2px; }

  /* ── Ficha da obra ── */
  .ficha {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 0; border: 1px solid #c8d0dc; border-radius: 5px;
    overflow: hidden; margin-bottom: 8px;
  }
  .ficha-cell {
    padding: 5px 8px; border-right: 1px solid #c8d0dc;
    background: #f8f9fb;
  }
  .ficha-cell:last-child { border-right: none; }
  .ficha-label { font-size: 7.5px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.4px; }
  .ficha-val { font-size: 9.5px; font-weight: 600; color: #1a1a1a; margin-top: 1px; }

  /* ── Tabela principal ── */
  table { border-collapse: collapse; width: 100%; font-size: 8.5px; }
  th, td { border: 1px solid #c5cdd8; padding: 3px 5px; }
  th { font-weight: 700; text-align: center; }

  /* cabeçalho fixo */
  .th-num  { background: ${COR_HEADER}; color: #fff; width: 22px; }
  .th-desc { background: ${COR_HEADER}; color: #fff; text-align: left; min-width: 160px; }
  .th-und  { background: ${COR_HEADER}; color: #fff; width: 36px; }
  .th-qtd  { background: ${COR_HEADER}; color: #fff; width: 42px; }

  /* fornecedor */
  .th-forn-name { background: ${COR_FORN}; color: #fff; }
  .th-forn-sub  { background: #2a6099; color: #e8f0fe; font-weight: 600; }
  .td-price { text-align: right; }
  .td-ideal-u { background: ${COR_IDEAL_BG}; color: ${COR_IDEAL}; font-weight: 700; text-align: right; }
  .td-ideal-t { background: ${COR_IDEAL_BG}; color: ${COR_IDEAL}; font-weight: 700; text-align: right; }
  .th-ideal { background: ${COR_IDEAL}; color: #fff; }

  /* linhas da tabela */
  .tr-odd  { background: #fff; }
  .tr-even { background: ${COR_STRIPE}; }
  .tr-best td { }
  td.best  { background: #d5f5e3; color: ${COR_IDEAL}; font-weight: 700; }

  .td-desc { text-align: left; }
  .td-obs  { font-size: 7.5px; color: #777; }
  .td-center { text-align: center; }

  /* rodapé da tabela */
  .tf-label { text-align: right; font-weight: 700; font-size: 8px; text-transform: uppercase;
              color: #555; background: #eef1f5; padding: 4px 8px; }
  .tf-val   { text-align: right; background: #eef1f5; }
  .tf-total-label { background: ${COR_FOOT}; color: #fff; font-weight: 700; text-align: right;
                    text-transform: uppercase; font-size: 8px; padding: 5px 8px; }
  .tf-total-val   { background: ${COR_FOOT}; color: #fff; font-weight: 700; text-align: right; font-size: 9px; }
  .tf-ideal-val   { background: ${COR_IDEAL}; color: #fff; font-weight: 700; text-align: right; font-size: 9px; }
  .tf-ideal-empty { background: ${COR_IDEAL_BG}; }

  /* rodapé de página */
  .page-footer {
    margin-top: 10px; padding-top: 5px; border-top: 1px solid #dde3ec;
    display: flex; justify-content: space-between; font-size: 7.5px; color: #999;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head><body>

<!-- CABEÇALHO -->
<div class="page-header">
  <div class="header-left">
    ${logoHTML}
    <div>
      <div class="doc-title">Mapa de Cotação de Preços</div>
      <div class="empresa-info">${empresaInfo}</div>
    </div>
  </div>
  <div class="header-right">
    <div style="font-size:18px;font-weight:800;color:${COR_HEADER};">Nº ${mapa?.numero ?? "—"}</div>
    <div class="doc-sub">Data: ${dataHoje}</div>
    <div class="doc-sub" style="margin-top:2px;">
      ${mapa?.status === "concluido"
        ? `<span style="background:#145a32;color:#fff;padding:1px 6px;border-radius:3px;font-size:7.5px;">✔ CONCLUÍDO</span>`
        : `<span style="background:#1a6db5;color:#fff;padding:1px 6px;border-radius:3px;font-size:7.5px;">EM ANDAMENTO</span>`}
    </div>
  </div>
</div>

<!-- FICHA DA OBRA -->
<div class="ficha">
  <div class="ficha-cell">
    <div class="ficha-label">Obra</div>
    <div class="ficha-val">${obraNome}</div>
  </div>
  <div class="ficha-cell">
    <div class="ficha-label">Título / Objeto</div>
    <div class="ficha-val">${titulo || "—"}</div>
  </div>
  <div class="ficha-cell">
    <div class="ficha-label">Local de Aplicação</div>
    <div class="ficha-val">${localAplicacao || "—"}</div>
  </div>
</div>

<!-- TABELA DE PREÇOS -->
<table>
  <thead>
    <tr>
      <th class="th-num" rowspan="2">#</th>
      <th class="th-desc" rowspan="2">Descrição</th>
      <th class="th-und" rowspan="2">UND</th>
      <th class="th-qtd" rowspan="2">Qtd.</th>
      ${activeFornIdx.map(fIdx => {
        const f = fornecedores[fIdx];
        return `<th colspan="2" class="th-forn-name">${f?.nome || `Fornecedor ${f?.ordem}`}${f?.contato ? `<br><span style="font-weight:400;font-size:7.5px;opacity:.85;">${f.contato}</span>` : ""}</th>`;
      }).join("")}
      <th colspan="2" class="th-ideal">★ Melhor Preço</th>
    </tr>
    <tr>
      ${activeFornIdx.map(() =>
        `<th class="th-forn-sub" style="width:58px;">R$ Unit.</th><th class="th-forn-sub" style="width:62px;">R$ Total</th>`
      ).join("")}
      <th class="th-ideal" style="width:58px;">R$ Unit.</th>
      <th class="th-ideal" style="width:62px;">R$ Total</th>
    </tr>
  </thead>
  <tbody>`;

    itens.forEach((item, iIdx) => {
      const idealUnit = getIdealUnit(iIdx);
      const idealFornIdx = getIdealFornIdx(iIdx);
      const rowClass = iIdx % 2 === 0 ? "tr-even" : "tr-odd";
      html += `<tr class="${rowClass}">
        <td class="td-center" style="color:#888;">${iIdx + 1}</td>
        <td class="td-desc">${item.descricao}${item.observacao ? `<div class="td-obs">${item.observacao}</div>` : ""}</td>
        <td class="td-center">${item.unidade || "—"}</td>
        <td class="td-center">${Number(item.quantidade).toLocaleString("pt-BR")}</td>`;
      activeFornIdx.forEach(fIdx => {
        const unit = getPreco(iIdx, fIdx);
        const total = unit * item.quantidade;
        const isBest = fIdx === idealFornIdx && unit > 0;
        html += `<td class="td-price${isBest ? " best" : ""}">${unit > 0 ? fmtMoeda(unit) : "<span style='color:#ccc'>—</span>"}</td>
                 <td class="td-price${isBest ? " best" : ""}">${unit > 0 ? fmtMoeda(total) : "<span style='color:#ccc'>—</span>"}</td>`;
      });
      html += `<td class="td-ideal-u">${idealUnit > 0 ? fmtMoeda(idealUnit) : "—"}</td>
               <td class="td-ideal-t">${idealUnit > 0 ? fmtMoeda(idealUnit * item.quantidade) : "—"}</td>
             </tr>`;
    });

    html += `</tbody><tfoot>
    <tr>
      <td colspan="4" class="tf-label">Subtotal</td>
      ${activeFornIdx.map(fIdx => {
        const st = getSubtotal(fIdx);
        return `<td class="tf-val"></td><td class="tf-val">${st > 0 ? fmtMoeda(st) : "—"}</td>`;
      }).join("")}
      <td class="tf-ideal-empty"></td>
      <td class="td-ideal-t" style="background:#d5f5e3;">${getIdealSubtotal() > 0 ? fmtMoeda(getIdealSubtotal()) : "—"}</td>
    </tr>
    <tr>
      <td colspan="4" class="tf-label">Desconto (R$)</td>
      ${activeFornIdx.map(fIdx => {
        const d = fornecedores[fIdx]?.desconto ?? 0;
        return `<td class="tf-val"></td><td class="tf-val" style="color:#c0392b;">${d > 0 ? `- ${fmtMoeda(d)}` : "—"}</td>`;
      }).join("")}
      <td class="tf-ideal-empty" colspan="2"></td>
    </tr>
    <tr>
      <td colspan="4" class="tf-label">Frete (R$)</td>
      ${activeFornIdx.map(fIdx => {
        const fr = fornecedores[fIdx]?.frete ?? 0;
        return `<td class="tf-val"></td><td class="tf-val">${fr > 0 ? fmtMoeda(fr) : "—"}</td>`;
      }).join("")}
      <td class="tf-ideal-empty" colspan="2"></td>
    </tr>
    <tr>
      <td colspan="4" class="tf-total-label">Total Geral</td>
      ${activeFornIdx.map(fIdx => {
        const tot = getTotal(fIdx);
        return `<td class="tf-total-val"></td><td class="tf-total-val">${tot > 0 ? fmtMoeda(tot) : "—"}</td>`;
      }).join("")}
      <td class="tf-ideal-val"></td>
      <td class="tf-ideal-val">${getIdealTotal() > 0 ? fmtMoeda(getIdealTotal()) : "—"}</td>
    </tr>
  </tfoot>
</table>

<!-- RODAPÉ -->
<div class="page-footer">
  <span>${cfg.empresaNome ? `${cfg.empresaNome} — ` : ""}Mapa de Cotação #${mapa?.numero} | ${obraNome}</span>
  <span>Gerado em ${dataHoje} via Obra Digital</span>
</div>

</body></html>`;

    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Título</label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Ex: Estrutura 2º pavimento" disabled={isConcluido} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Local de Aplicação</label>
              {localAplicacao
                ? <p className="text-sm font-medium px-3 py-2 rounded-md bg-muted/60 border">📍 {localAplicacao}</p>
                : <p className="text-sm text-muted-foreground px-3 py-2 rounded-md bg-muted/30 border border-dashed">Definido no Pedido de Compra</p>}
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
              <FornecedorCard
                key={f.id}
                forn={f}
                index={fi}
                isConcluido={isConcluido}
                canRemove={fornecedores.length > 1}
                onRemove={() => removeFornecedorMut.mutate({ fornecedorId: f.id })}
                onUpdate={(patch) => setFornecedores(prev => prev.map((ff, i) => i === fi ? { ...ff, ...patch } : ff))}
              />
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
                <td colSpan={4} className="border px-2 py-1.5 text-right text-xs uppercase text-muted-foreground">Desconto (R$)</td>
                {fornecedores.map((f, fIdx) => (
                  <>
                    <td key={`du${fIdx}`} className="border"></td>
                    <td key={`dt${fIdx}`} className="border px-1 py-0.5">
                      <input
                        type="number" min="0" step="any"
                        disabled={isConcluido}
                        className="w-full text-right text-sm outline-none bg-transparent border-b border-transparent focus:border-blue-400 transition-colors px-1 py-0.5 disabled:opacity-50"
                        value={f.desconto > 0 ? f.desconto : ""}
                        onChange={e => {
                          const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          setFornecedores(prev => prev.map((ff, i) => i === fIdx ? { ...ff, desconto: isNaN(val) ? 0 : val } : ff));
                        }}
                        placeholder="0,00"
                      />
                    </td>
                  </>
                ))}
                <td className="border bg-green-50/60"></td>
                <td className="border px-2 py-1.5 text-right text-sm text-muted-foreground bg-green-50/60">—</td>
              </tr>
              <tr>
                <td colSpan={4} className="border px-2 py-1.5 text-right text-xs uppercase text-muted-foreground">Frete (R$)</td>
                {fornecedores.map((f, fIdx) => (
                  <>
                    <td key={`fu${fIdx}`} className="border"></td>
                    <td key={`ft${fIdx}`} className="border px-1 py-0.5">
                      <input
                        type="number" min="0" step="any"
                        disabled={isConcluido}
                        className="w-full text-right text-sm outline-none bg-transparent border-b border-transparent focus:border-blue-400 transition-colors px-1 py-0.5 disabled:opacity-50"
                        value={f.frete > 0 ? f.frete : ""}
                        onChange={e => {
                          const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          setFornecedores(prev => prev.map((ff, i) => i === fIdx ? { ...ff, frete: isNaN(val) ? 0 : val } : ff));
                        }}
                        placeholder="0,00"
                      />
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
