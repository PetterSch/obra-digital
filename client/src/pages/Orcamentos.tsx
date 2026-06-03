import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Plus, Trash2, ArrowLeft, Calculator, FileText, FileDown, FileSpreadsheet,
  ChevronDown, ChevronRight, Eye, Pencil, User, Building2,
  Wallet, Ruler, ListChecks, Percent,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { exportOrcamentoPDF } from "@/lib/pdfExport";
import { exportOrcamentoToExcel } from "@/lib/exportUtils";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Editor de um orçamento ───────────────────────────────────────────────
function OrcamentoEditor({ orcamentoId, onBack, readOnly = false }: { orcamentoId: number; onBack: () => void; readOnly?: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.orcamentos.getById.useQuery({ id: orcamentoId });

  const inval = () => utils.orcamentos.getById.invalidate({ id: orcamentoId });
  const updateOrc = trpc.orcamentos.update.useMutation({ onSuccess: inval });
  const updateItem = trpc.orcamentos.updateItem.useMutation({ onSuccess: inval });
  const deleteItem = trpc.orcamentos.deleteItem.useMutation({ onSuccess: () => { toast.success("Item removido"); inval(); } });
  const addItem = trpc.orcamentos.addItem.useMutation({ onSuccess: () => { toast.success("Item adicionado"); inval(); } });
  const addItemAsync = trpc.orcamentos.addItem.useMutation();

  const [novoItem, setNovoItem] = useState({ descricao: "", unidade: "", quantidade: "", precoUnitario: "" });

  // Catálogo para adicionar serviços já prontos
  const { data: catalogo } = trpc.orcamentos.catalogo.useQuery();
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [selCat, setSelCat] = useState<Set<string>>(new Set());
  const [expCat, setExpCat] = useState<Set<string>>(new Set());
  const [salvandoCat, setSalvandoCat] = useState(false);

  if (isLoading) return <div className="flex justify-center py-10"><Spinner /></div>;
  if (!data?.orcamento) return <p className="text-muted-foreground">Orçamento não encontrado.</p>;

  const { orcamento, itens, totais } = data;
  const o: any = orcamento;

  const porCategoria: Record<string, any[]> = {};
  itens.forEach((it: any) => { (porCategoria[it.categoria || "Outros"] ??= []).push(it); });

  // Chaves dos itens já presentes no orçamento (evita duplicidade no catálogo)
  const chavesExistentes = new Set(itens.map((i: any) => `${i.categoria || ""}|${i.descricao}`));

  const dadosExport = {
    obraNome: o.obraNomeRef || o.nome,
    obraCodigo: "—",
    cliente: o.clienteNome || "—",
    responsavelTecnico: o.responsavel || "—",
    endereco: o.obraEndereco || "—",
    nome: o.nome,
    itens: itens.map((i: any) => ({ categoria: i.categoria, descricao: i.descricao, unidade: i.unidade, quantidade: Number(i.quantidade), precoUnitario: Number(i.precoUnitario) })),
    totais,
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">{o.nome}</h3>
          <p className="text-sm text-muted-foreground">
            {o.clienteNome ? `${o.clienteNome} · ` : ""}{itens.length} item(ns){readOnly ? " · somente leitura" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportOrcamentoPDF(dadosExport)}>
            <FileDown className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { exportOrcamentoToExcel(dadosExport); toast.success("Excel gerado!"); }}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Valor total da obra" value={brl(totais.valorTotal)} icon={Wallet} tone="green" hint="Com BDI e administração" />
        <StatCard label="Custo por m²" value={totais.area > 0 ? brl(totais.custoM2ComAdm) : "—"} icon={Ruler} tone="blue" hint={totais.area > 0 ? `${totais.area.toLocaleString("pt-BR")} m²` : "Informe a área"} />
        <StatCard label="Itens orçados" value={itens.length} icon={ListChecks} tone="neutral" hint="Serviços no orçamento" />
        <StatCard label="Administração" value={`${totais.adm}%`} icon={Percent} tone="amber" hint={brl(totais.valorAdministracao)} />
      </div>

      {/* Dados do cliente e da obra */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Cliente e Obra</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome do orçamento" value={o.nome} disabled={readOnly}
              onSave={v => updateOrc.mutate({ id: orcamentoId, nome: v })} />
            <Field label="Cliente" value={o.clienteNome} disabled={readOnly}
              onSave={v => updateOrc.mutate({ id: orcamentoId, clienteNome: v })} />
            <Field label="Telefone do cliente" value={o.clienteTelefone} disabled={readOnly}
              onSave={v => updateOrc.mutate({ id: orcamentoId, clienteTelefone: v })} />
            <Field label="E-mail do cliente" value={o.clienteEmail} disabled={readOnly}
              onSave={v => updateOrc.mutate({ id: orcamentoId, clienteEmail: v })} />
            <Field label="Nome da obra" value={o.obraNomeRef} disabled={readOnly}
              onSave={v => updateOrc.mutate({ id: orcamentoId, obraNomeRef: v })} />
            <Field label="Responsável técnico" value={o.responsavel} disabled={readOnly}
              onSave={v => updateOrc.mutate({ id: orcamentoId, responsavel: v })} />
            <div className="sm:col-span-2">
              <Field label="Endereço da obra" value={o.obraEndereco} disabled={readOnly}
                onSave={v => updateOrc.mutate({ id: orcamentoId, obraEndereco: v })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de itens */}
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
                <React.Fragment key={cat}>
                  <tr className="bg-primary/5">
                    <td colSpan={6} className="px-4 py-1.5 font-semibold text-xs text-primary uppercase tracking-wide">{cat}</td>
                  </tr>
                  {lista.map((it: any) => {
                    const total = Number(it.quantidade || 0) * Number(it.precoUnitario || 0);
                    return (
                      <tr key={it.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-2 pl-4">{it.descricao}</td>
                        <td className="text-center p-2 text-muted-foreground">{it.unidade}</td>
                        <td className="p-1">
                          <Input type="number" step="0.001" defaultValue={it.quantidade} disabled={readOnly}
                            className="h-8 text-right text-sm"
                            onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== Number(it.quantidade)) updateItem.mutate({ id: it.id, quantidade: v }); }} />
                        </td>
                        <td className="p-1">
                          <Input type="number" step="0.01" defaultValue={it.precoUnitario} disabled={readOnly}
                            className="h-8 text-right text-sm"
                            onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== Number(it.precoUnitario)) updateItem.mutate({ id: it.id, precoUnitario: v }); }} />
                        </td>
                        <td className="text-right p-2 font-medium whitespace-nowrap">{brl(total)}</td>
                        <td className="p-1 text-center">
                          {!readOnly && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem.mutate({ id: it.id })}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              {itens.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">Nenhum item. Adicione abaixo.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Adicionar do catálogo */}
      {!readOnly && (
        <Card>
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Adicionar serviços do catálogo</p>
              <p className="text-xs text-muted-foreground">Inclua itens prontos que não foram selecionados na criação</p>
            </div>
            <Button variant="default" size="sm" className="gap-1.5 shrink-0"
              onClick={() => { setSelCat(new Set()); setExpCat(new Set()); setCatalogoOpen(true); }}>
              <Plus className="w-4 h-4" /> Catálogo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Adicionar item avulso */}
      {!readOnly && (
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
                addItem.mutate({ orcamentoId, descricao: novoItem.descricao, unidade: novoItem.unidade || undefined, quantidade: parseFloat(novoItem.quantidade) || 0, precoUnitario: parseFloat(novoItem.precoUnitario) || 0 });
                setNovoItem({ descricao: "", unidade: "", quantidade: "", precoUnitario: "" });
              }}>
              <Plus className="w-3.5 h-3.5" /> Adicionar item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Fechamento */}
      <Card className="border-primary/30">
        <CardContent className="py-4 space-y-4">
          <h4 className="font-semibold flex items-center gap-2"><Calculator className="w-4 h-4 text-primary" /> Fechamento do Orçamento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Área total da obra (m²)</Label>
              <Input type="number" step="0.01" defaultValue={o.areaM2} disabled={readOnly}
                onBlur={e => updateOrc.mutate({ id: orcamentoId, areaM2: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">BDI (%) <span className="text-[10px] text-muted-foreground">(interno)</span></Label>
              <Input type="number" step="0.01" defaultValue={o.bdiPercent} disabled={readOnly}
                onBlur={e => updateOrc.mutate({ id: orcamentoId, bdiPercent: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Administração da obra (%)</Label>
              <Input type="number" step="0.01" defaultValue={o.administracaoPercent} disabled={readOnly}
                onBlur={e => updateOrc.mutate({ id: orcamentoId, administracaoPercent: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          {!readOnly && (
            <p className="text-xs text-muted-foreground -mt-1">
              ℹ️ O BDI é uso interno: no PDF/Excel exportado ele fica embutido nos preços. A administração aparece normalmente.
            </p>
          )}

          <div className="rounded-lg border divide-y text-sm">
            <Row label="Custo direto (itens)" value={brl(totais.custoDirecto)} />
            <Row label={`BDI (${totais.bdi}%) — interno`} value={brl(totais.valorBdi)} />
            <Row label="Subtotal com BDI" value={brl(totais.valorComBdi)} bold />
            <Row label={`Administração da obra (${totais.adm}%)`} value={brl(totais.valorAdministracao)} />
            <Row label="VALOR TOTAL DA OBRA" value={brl(totais.valorTotal)} bold highlight />
          </div>

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

      {/* Modal: adicionar serviços do catálogo */}
      <Dialog open={catalogoOpen} onOpenChange={v => { if (!v) setCatalogoOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar serviços do catálogo</DialogTitle>
            <DialogDescription>Selecione os serviços para incluir neste orçamento ({selCat.size} selecionado(s)).</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
            {(catalogo?.categorias ?? []).map(cat => {
              const itens = (catalogo?.itens ?? []).filter(i => i.categoria === cat);
              const aberta = expCat.has(cat);
              const sel = itens.filter(i => selCat.has(cat + "|" + i.descricao)).length;
              return (
                <div key={cat}>
                  <button type="button" className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40"
                    onClick={() => setExpCat(p => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}>
                    <span className="flex items-center gap-2 font-medium text-sm">
                      {aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{cat}
                    </span>
                    {sel > 0 && <Badge variant="secondary" className="text-xs">{sel}</Badge>}
                  </button>
                  {aberta && (
                    <div className="bg-muted/20 px-3 py-1">
                      {itens.map(it => {
                        const key = cat + "|" + it.descricao;
                        const jaTem = chavesExistentes.has(key);
                        return (
                          <label key={key} className={`flex items-center gap-2 py-1.5 text-sm ${jaTem ? "opacity-60 cursor-default" : "cursor-pointer"}`}>
                            <Checkbox checked={jaTem || selCat.has(key)} disabled={jaTem}
                              onCheckedChange={() => { if (jaTem) return; setSelCat(p => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; }); }} />
                            <span className="flex-1">{it.descricao}{jaTem && <span className="text-xs text-muted-foreground italic"> · já no orçamento</span>}</span>
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
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={salvandoCat || selCat.size === 0}
              onClick={async () => {
                setSalvandoCat(true);
                try {
                  const escolhidos = (catalogo?.itens ?? []).filter(i => {
                    const k = i.categoria + "|" + i.descricao;
                    return selCat.has(k) && !chavesExistentes.has(k);
                  });
                  for (const it of escolhidos) {
                    await addItemAsync.mutateAsync({
                      orcamentoId, categoria: it.categoria, descricao: it.descricao,
                      unidade: it.unidade, quantidade: 0, precoUnitario: it.precoReferencia,
                    });
                  }
                  toast.success(`${escolhidos.length} serviço(s) adicionado(s)!`);
                  setCatalogoOpen(false);
                  inval();
                } catch { toast.error("Erro ao adicionar serviços"); }
                setSalvandoCat(false);
              }}>
              {salvandoCat ? "Adicionando..." : `Adicionar ${selCat.size} serviço(s)`}
            </Button>
            <Button variant="outline" onClick={() => setCatalogoOpen(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Campo de texto com salvamento no blur
function Field({ label, value, onSave, disabled }: { label: string; value: any; onSave: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input defaultValue={value ?? ""} disabled={disabled}
        onBlur={e => { if (e.target.value !== (value ?? "")) onSave(e.target.value); }} />
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

// ─── Modal de criação ─────────────────────────────────────────────────────
const FORM_DEFAULT = {
  nome: "", clienteNome: "", clienteTelefone: "", clienteEmail: "",
  obraNomeRef: "", obraEndereco: "", responsavel: "", area: "",
};

function NovoOrcamentoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const { data: catalogo } = trpc.orcamentos.catalogo.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState(FORM_DEFAULT);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

  const createMut = trpc.orcamentos.create.useMutation({
    onSuccess: (orc: any) => { toast.success("Orçamento criado!"); onCreated(orc.id); reset(); },
    onError: (e) => toast.error(e.message || "Erro ao criar"),
  });

  const reset = () => { setForm(FORM_DEFAULT); setSelecionados(new Set()); setExpandidas(new Set()); };
  const toggleItem = (k: string) => setSelecionados(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleCat = (c: string) => setExpandidas(p => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const itensPorCat = (cat: string) => (catalogo?.itens ?? []).filter(i => i.categoria === cat);
  const set = (k: keyof typeof FORM_DEFAULT) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const handleCreate = () => {
    if (!form.nome.trim()) { toast.error("Dê um nome ao orçamento"); return; }
    const itens = (catalogo?.itens ?? [])
      .filter(i => selecionados.has(i.categoria + "|" + i.descricao))
      .map(i => ({ categoria: i.categoria, descricao: i.descricao, unidade: i.unidade, quantidade: 0, precoUnitario: i.precoReferencia }));
    createMut.mutate({
      nome: form.nome,
      clienteNome: form.clienteNome || undefined,
      clienteTelefone: form.clienteTelefone || undefined,
      clienteEmail: form.clienteEmail || undefined,
      obraNomeRef: form.obraNomeRef || undefined,
      obraEndereco: form.obraEndereco || undefined,
      responsavel: form.responsavel || undefined,
      areaM2: parseFloat(form.area) || 0,
      itens,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Orçamento</DialogTitle>
          <DialogDescription>Preencha os dados do cliente e da obra, e selecione os serviços.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nome do orçamento *</Label>
            <Input placeholder="Ex: Residência Silva — Orçamento 2024" value={form.nome} onChange={set("nome")} />
          </div>

          {/* Cliente */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Dados do cliente</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="Nome do cliente" value={form.clienteNome} onChange={set("clienteNome")} />
              <Input placeholder="Telefone" value={form.clienteTelefone} onChange={set("clienteTelefone")} />
              <Input placeholder="E-mail" value={form.clienteEmail} onChange={set("clienteEmail")} />
            </div>
          </div>

          {/* Obra */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Dados da obra</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Nome / descrição da obra" value={form.obraNomeRef} onChange={set("obraNomeRef")} />
              <Input placeholder="Responsável técnico" value={form.responsavel} onChange={set("responsavel")} />
              <Input placeholder="Endereço da obra" className="sm:col-span-2" value={form.obraEndereco} onChange={set("obraEndereco")} />
              <Input placeholder="Área total (m²)" type="number" value={form.area} onChange={set("area")} />
            </div>
          </div>

          {/* Serviços */}
          <div>
            <p className="text-sm font-medium mb-2">Serviços ({selecionados.size} selecionado(s))</p>
            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
              {(catalogo?.categorias ?? []).map(cat => {
                const itens = itensPorCat(cat);
                const aberta = expandidas.has(cat);
                const selNaCat = itens.filter(i => selecionados.has(cat + "|" + i.descricao)).length;
                return (
                  <div key={cat}>
                    <button type="button" className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40" onClick={() => toggleCat(cat)}>
                      <span className="flex items-center gap-2 font-medium text-sm">
                        {aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{cat}
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

// ─── Página ────────────────────────────────────────────────────────────────
export default function Orcamentos() {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [modo, setModo] = useState<"ver" | "editar">("editar");
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: orcamentos = [], isLoading, refetch } = trpc.orcamentos.list.useQuery();
  const deleteMut = trpc.orcamentos.delete.useMutation({ onSuccess: () => { toast.success("Orçamento excluído"); refetch(); } });

  const filtrados = orcamentos.filter((o: any) =>
    o.nome.toLowerCase().includes(search.toLowerCase()) ||
    (o.clienteNome ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (o.obraNomeRef ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-5">
        {selecionado ? (
          <OrcamentoEditor orcamentoId={selecionado} readOnly={modo === "ver"} onBack={() => { setSelecionado(null); refetch(); }} />
        ) : (
          <>
            <PageHeader
              title="Orçamentos"
              description="Orçamentos para clientes atuais e futuros"
              icon={Calculator}
              actions={<Button className="gap-2" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Novo Orçamento</Button>}
            />

            {orcamentos.length > 3 && (
              <Input placeholder="Buscar por orçamento, cliente ou obra..." value={search}
                onChange={e => setSearch(e.target.value)} className="max-w-sm" />
            )}

            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : filtrados.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground mb-4">{search ? "Nenhum orçamento encontrado" : "Nenhum orçamento criado ainda"}</p>
                  {!search && <Button onClick={() => setModalOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Criar primeiro orçamento</Button>}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filtrados.map((o: any) => (
                  <Card key={o.id} className="hover:border-primary/40 transition-colors">
                    <CardContent className="flex items-center justify-between py-4 gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{o.nome}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {o.clienteNome ? `${o.clienteNome}` : "Sem cliente"}
                          {o.obraNomeRef ? ` · ${o.obraNomeRef}` : ""}
                          {Number(o.areaM2) > 0 ? ` · ${Number(o.areaM2).toLocaleString("pt-BR")} m²` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setModo("ver"); setSelecionado(o.id); }}>
                          <Eye className="w-4 h-4" /> Ver
                        </Button>
                        <Button variant="default" size="sm" className="gap-1.5" onClick={() => { setModo("editar"); setSelecionado(o.id); }}>
                          <Pencil className="w-4 h-4" /> Editar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => { if (confirm(`Excluir o orçamento "${o.nome}"?`)) deleteMut.mutate({ id: o.id }); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NovoOrcamentoModal open={modalOpen} onClose={() => setModalOpen(false)}
        onCreated={(id) => { setModalOpen(false); refetch(); setModo("editar"); setSelecionado(id); }} />
    </DashboardLayout>
  );
}
