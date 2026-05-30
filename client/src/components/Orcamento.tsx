import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Calculator, FileText, ChevronDown, ChevronRight } from "lucide-react";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Editor de um orçamento ───────────────────────────────────────────────
function OrcamentoEditor({ orcamentoId, onBack }: { orcamentoId: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.orcamentos.getById.useQuery({ id: orcamentoId });

  const updateOrc = trpc.orcamentos.update.useMutation({
    onSuccess: () => utils.orcamentos.getById.invalidate({ id: orcamentoId }),
  });
  const updateItem = trpc.orcamentos.updateItem.useMutation({
    onSuccess: () => utils.orcamentos.getById.invalidate({ id: orcamentoId }),
  });
  const deleteItem = trpc.orcamentos.deleteItem.useMutation({
    onSuccess: () => { toast.success("Item removido"); utils.orcamentos.getById.invalidate({ id: orcamentoId }); },
  });
  const addItem = trpc.orcamentos.addItem.useMutation({
    onSuccess: () => { toast.success("Item adicionado"); utils.orcamentos.getById.invalidate({ id: orcamentoId }); },
  });

  const [novoItem, setNovoItem] = useState({ descricao: "", unidade: "", quantidade: "", precoUnitario: "" });

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (!data?.orcamento) return <p className="text-muted-foreground">Orçamento não encontrado.</p>;

  const { orcamento, itens, totais } = data;

  // Agrupa itens por categoria
  const porCategoria: Record<string, any[]> = {};
  itens.forEach((it: any) => {
    const c = it.categoria || "Outros";
    (porCategoria[c] ??= []).push(it);
  });

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{orcamento.nome}</h3>
          <p className="text-sm text-muted-foreground">{itens.length} item(ns) no orçamento</p>
        </div>
      </div>

      {/* Tabela de itens por categoria */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="text-left p-2 pl-4">Descrição</th>
                <th className="text-center p-2 w-16">Un.</th>
                <th className="text-right p-2 w-24">Qtd.</th>
                <th className="text-right p-2 w-32">Preço Unit.</th>
                <th className="text-right p-2 w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(porCategoria).map(([cat, lista]) => (
                <>
                  <tr key={cat} className="bg-primary/5">
                    <td colSpan={6} className="px-4 py-1.5 font-semibold text-xs text-primary uppercase tracking-wide">{cat}</td>
                  </tr>
                  {lista.map((it: any) => {
                    const total = Number(it.quantidade || 0) * Number(it.precoUnitario || 0);
                    return (
                      <tr key={it.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-2 pl-4">{it.descricao}</td>
                        <td className="text-center p-2 text-muted-foreground">{it.unidade}</td>
                        <td className="p-1">
                          <Input
                            type="number" step="0.001" defaultValue={it.quantidade}
                            className="h-8 text-right text-sm"
                            onBlur={e => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v !== Number(it.quantidade)) updateItem.mutate({ id: it.id, quantidade: v });
                            }}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="number" step="0.01" defaultValue={it.precoUnitario}
                            className="h-8 text-right text-sm"
                            onBlur={e => {
                              const v = parseFloat(e.target.value) || 0;
                              if (v !== Number(it.precoUnitario)) updateItem.mutate({ id: it.id, precoUnitario: v });
                            }}
                          />
                        </td>
                        <td className="text-right p-2 font-medium whitespace-nowrap">{brl(total)}</td>
                        <td className="p-1 text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => deleteItem.mutate({ id: it.id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
              {itens.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Nenhum item. Adicione abaixo.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Adicionar item avulso */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-medium mb-2">Adicionar item avulso</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Input placeholder="Descrição" className="sm:col-span-2" value={novoItem.descricao}
              onChange={e => setNovoItem({ ...novoItem, descricao: e.target.value })} />
            <Input placeholder="Un. (m², kg...)" value={novoItem.unidade}
              onChange={e => setNovoItem({ ...novoItem, unidade: e.target.value })} />
            <Input placeholder="Qtd." type="number" value={novoItem.quantidade}
              onChange={e => setNovoItem({ ...novoItem, quantidade: e.target.value })} />
            <Input placeholder="Preço un." type="number" value={novoItem.precoUnitario}
              onChange={e => setNovoItem({ ...novoItem, precoUnitario: e.target.value })} />
          </div>
          <Button size="sm" className="mt-2 gap-1.5" disabled={!novoItem.descricao}
            onClick={() => {
              addItem.mutate({
                orcamentoId,
                descricao: novoItem.descricao,
                unidade: novoItem.unidade || undefined,
                quantidade: parseFloat(novoItem.quantidade) || 0,
                precoUnitario: parseFloat(novoItem.precoUnitario) || 0,
              });
              setNovoItem({ descricao: "", unidade: "", quantidade: "", precoUnitario: "" });
            }}>
            <Plus className="w-3.5 h-3.5" /> Adicionar item
          </Button>
        </CardContent>
      </Card>

      {/* Painel de fechamento: área, BDI, administração e totais */}
      <Card className="border-primary/30">
        <CardContent className="py-4 space-y-4">
          <h4 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> Fechamento do Orçamento</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Área total da obra (m²)</Label>
              <Input type="number" step="0.01" defaultValue={orcamento.areaM2}
                onBlur={e => updateOrc.mutate({ id: orcamentoId, areaM2: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">BDI (%)</Label>
              <Input type="number" step="0.01" defaultValue={orcamento.bdiPercent}
                onBlur={e => updateOrc.mutate({ id: orcamentoId, bdiPercent: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Administração da obra (%)</Label>
              <Input type="number" step="0.01" defaultValue={orcamento.administracaoPercent}
                onBlur={e => updateOrc.mutate({ id: orcamentoId, administracaoPercent: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          {/* Resumo de valores */}
          <div className="rounded-lg border divide-y text-sm">
            <Row label="Custo direto (itens)" value={brl(totais.custoDirecto)} />
            <Row label={`BDI (${totais.bdi}%)`} value={brl(totais.valorBdi)} />
            <Row label="Subtotal com BDI" value={brl(totais.valorComBdi)} bold />
            <Row label={`Administração da obra (${totais.adm}%)`} value={brl(totais.valorAdministracao)} />
            <Row label="VALOR TOTAL DA OBRA" value={brl(totais.valorTotal)} bold highlight />
          </div>

          {/* Custo por m² */}
          {totais.area > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3 text-center">
                <div className="text-xs text-muted-foreground">Custo por m² (sem administração)</div>
                <div className="text-lg font-bold text-primary">{brl(totais.custoM2SemAdm)}</div>
              </div>
              <div className="rounded-lg bg-primary/10 p-3 text-center">
                <div className="text-xs text-muted-foreground">Custo por m² (com administração)</div>
                <div className="text-lg font-bold text-primary">{brl(totais.custoM2ComAdm)}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center">Informe a área total para calcular o custo por m².</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2 ${highlight ? "bg-primary/10" : ""}`}>
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${highlight ? "text-primary text-base" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Modal de criação com seleção do catálogo ─────────────────────────────
function NovoOrcamentoModal({ obraId, open, onClose, onCreated }: {
  obraId: number; open: boolean; onClose: () => void; onCreated: (id: number) => void;
}) {
  const { data: catalogo } = trpc.orcamentos.catalogo.useQuery(undefined, { enabled: open });
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const createMut = trpc.orcamentos.create.useMutation({
    onSuccess: (orc: any) => { toast.success("Orçamento criado!"); onCreated(orc.id); reset(); },
    onError: (e) => toast.error(e.message || "Erro ao criar"),
  });

  const reset = () => { setNome(""); setArea(""); setSelecionados(new Set()); setExpandidas(new Set()); };

  const toggleItem = (key: string) => {
    setSelecionados(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };
  const toggleCat = (cat: string) => {
    setExpandidas(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });
  };

  const itensPorCat = (cat: string) => (catalogo?.itens ?? []).filter(i => i.categoria === cat);

  const handleCreate = () => {
    if (!nome.trim()) { toast.error("Dê um nome ao orçamento"); return; }
    const itens = (catalogo?.itens ?? [])
      .filter(i => selecionados.has(i.categoria + "|" + i.descricao))
      .map(i => ({ categoria: i.categoria, descricao: i.descricao, unidade: i.unidade, quantidade: 0, precoUnitario: i.precoReferencia }));
    createMut.mutate({ obraId, nome, areaM2: parseFloat(area) || 0, itens });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Orçamento</DialogTitle>
          <DialogDescription>Selecione os serviços que farão parte da obra. As quantidades você ajusta depois.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome do orçamento *</Label>
              <Input placeholder="Ex: Orçamento inicial" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Área total (m²)</Label>
              <Input type="number" placeholder="Ex: 120" value={area} onChange={e => setArea(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Serviços ({selecionados.size} selecionado(s))</p>
            <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
              {(catalogo?.categorias ?? []).map(cat => {
                const itens = itensPorCat(cat);
                const aberta = expandidas.has(cat);
                const selNaCat = itens.filter(i => selecionados.has(cat + "|" + i.descricao)).length;
                return (
                  <div key={cat}>
                    <button type="button" className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40"
                      onClick={() => toggleCat(cat)}>
                      <span className="flex items-center gap-2 font-medium text-sm">
                        {aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {cat}
                      </span>
                      {selNaCat > 0 && <Badge variant="secondary" className="text-xs">{selNaCat}</Badge>}
                    </button>
                    {aberta && (
                      <div className="bg-muted/20 px-3 py-1">
                        {itens.map(it => {
                          const key = cat + "|" + it.descricao;
                          return (
                            <label key={key} className="flex items-center gap-2 py-1.5 cursor-pointer text-sm">
                              <Checkbox checked={selecionados.has(key)} onCheckedChange={() => toggleItem(key)} />
                              <span className="flex-1">{it.descricao}</span>
                              <span className="text-xs text-muted-foreground">{it.unidade} · {brl(it.precoReferencia)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Preços são valores de referência — você ajusta cada um depois.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Criando..." : `Criar orçamento (${selecionados.size} itens)`}
            </Button>
            <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente principal (lista + roteamento interno) ────────────────────
export function Orcamento({ obraId }: { obraId: number }) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: orcamentos = [], isLoading, refetch } = trpc.orcamentos.listByObra.useQuery({ obraId });
  const deleteMut = trpc.orcamentos.delete.useMutation({
    onSuccess: () => { toast.success("Orçamento excluído"); refetch(); },
  });

  if (selecionado) {
    return <OrcamentoEditor orcamentoId={selecionado} onBack={() => { setSelecionado(null); refetch(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Orçamentos desta obra</p>
        <Button className="gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" /> Novo Orçamento
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : orcamentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-4">Nenhum orçamento criado ainda</p>
            <Button onClick={() => setModalOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Criar primeiro orçamento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orcamentos.map((o: any) => (
            <Card key={o.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelecionado(o.id)}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="font-medium">{o.nome}</div>
                  <div className="text-sm text-muted-foreground">
                    {Number(o.areaM2) > 0 ? `${Number(o.areaM2).toLocaleString("pt-BR")} m² · ` : ""}
                    BDI {Number(o.bdiPercent)}% · Adm {Number(o.administracaoPercent)}%
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                  onClick={e => { e.stopPropagation(); if (confirm(`Excluir o orçamento "${o.nome}"?`)) deleteMut.mutate({ id: o.id }); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NovoOrcamentoModal obraId={obraId} open={modalOpen} onClose={() => setModalOpen(false)}
        onCreated={(id) => { setModalOpen(false); refetch(); setSelecionado(id); }} />
    </div>
  );
}
