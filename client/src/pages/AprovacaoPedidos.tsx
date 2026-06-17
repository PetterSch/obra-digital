import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Truck, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Building2, CheckCheck } from "lucide-react";

// ─── Utilitário de status ─────────────────────────────────────────────────────

type StatusAprovacao = "pendente" | "aprovado" | "reprovado";

function calcularStatusPedido(itens: { statusAprovacao: StatusAprovacao }[]): string {
  if (!itens.length) return "aberto";
  const statuses = itens.map(i => i.statusAprovacao ?? "pendente");
  if (statuses.every(s => s === "aprovado")) return "aprovado_total";
  if (statuses.every(s => s === "reprovado")) return "reprovado";
  if (statuses.some(s => s !== "pendente")) return "aprovado_parcial";
  return "aguardando_aprovacao";
}

const STATUS_PEDIDO: Record<string, { label: string; cls: string }> = {
  aguardando_aprovacao: { label: "Aguardando aprovação", cls: "bg-amber-100 text-amber-700" },
  aprovado_parcial:     { label: "Aprovado parcial",     cls: "bg-violet-100 text-violet-700" },
  aprovado_total:       { label: "Aprovado total",       cls: "bg-green-100 text-green-700" },
  reprovado:            { label: "Reprovado",             cls: "bg-red-100 text-red-700" },
  aberto:               { label: "Aberto",                cls: "bg-gray-100 text-gray-600" },
};

// Agrupa um pedido em uma das 3 abas com base no status dos seus itens
type Grupo = "aguardando" | "aprovados" | "reprovados";
function grupoPedido(itens: { statusAprovacao?: StatusAprovacao }[]): Grupo {
  const st = (itens ?? []).map(i => i.statusAprovacao ?? "pendente");
  if (!st.length) return "aguardando";
  if (st.some(s => s === "pendente")) return "aguardando";       // ainda há itens a decidir
  if (st.every(s => s === "reprovado")) return "reprovados";     // todos reprovados
  return "aprovados";                                            // tudo decidido, ao menos um aprovado
}

// ─── Indicador de status por item ────────────────────────────────────────────

function ItemStatusIcon({ status }: { status: StatusAprovacao }) {
  if (status === "aprovado") return <CheckCircle2 className="w-4 h-4 text-green-500" aria-label="Aprovado" />;
  if (status === "reprovado") return <XCircle className="w-4 h-4 text-red-500" aria-label="Reprovado" />;
  return <Clock className="w-4 h-4 text-amber-400" aria-label="Pendente" />;
}

// ─── Linha de item ────────────────────────────────────────────────────────────

function LinhaItem({
  item,
  qtd,
  onQtdChange,
  onAprovar,
  onReprovar,
  salvando,
}: {
  item: any;
  qtd: string;
  onQtdChange: (v: string) => void;
  onAprovar: (quantidade?: number) => void;
  onReprovar: (obs: string) => void;
  salvando: boolean;
}) {
  const [reprovando, setReprovando] = useState(false);
  const [obsReprovacao, setObsReprovacao] = useState(item.observacaoReprovacao ?? "");
  const status: StatusAprovacao = item.statusAprovacao ?? "pendente";

  const handleAprovar = () => {
    setReprovando(false);
    const val = qtd.trim().replace(",", ".");
    const n = val !== "" ? parseFloat(val) : undefined;
    onAprovar(!n || isNaN(n) ? undefined : n);
  };

  return (
    <>
      <tr className={`border-b last:border-0 transition-colors ${status === "aprovado" ? "bg-green-50/40" : status === "reprovado" ? "bg-red-50/40" : ""}`}>
        <td className="p-2 w-8">
          <ItemStatusIcon status={status} />
        </td>
        <td className="p-2 text-sm font-medium">{item.descricao || "—"}</td>
        <td className="p-2" style={{ width: 110, minWidth: 90 }}>
          <input
            type="text"
            inputMode="decimal"
            className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            value={qtd}
            onChange={e => onQtdChange(e.target.value)}
            placeholder="Qtd"
            title="Altere a quantidade antes de aprovar"
          />
        </td>
        <td className="p-2 text-sm text-muted-foreground">{item.unidade || "—"}</td>
        <td className="p-2 text-sm text-right tabular-nums text-muted-foreground">
          {item.valorEstimado != null ? Number(item.valorEstimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
        </td>
        <td className="p-2">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={status === "aprovado" ? "default" : "outline"}
              className={`h-7 gap-1 text-xs ${status === "aprovado" ? "bg-green-600 hover:bg-green-700 border-green-600" : "hover:border-green-500 hover:text-green-600"}`}
              disabled={salvando}
              aria-label="Aprovar item"
              onClick={handleAprovar}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant={status === "reprovado" ? "default" : "outline"}
              className={`h-7 gap-1 text-xs ${status === "reprovado" ? "bg-red-600 hover:bg-red-700 border-red-600" : "hover:border-red-500 hover:text-red-600"}`}
              disabled={salvando}
              aria-label="Reprovar item"
              onClick={() => setReprovando(v => !v)}
            >
              <XCircle className="w-3.5 h-3.5" /> Reprovar
            </Button>
          </div>
        </td>
      </tr>
      {reprovando && (
        <tr className="bg-red-50/60 border-b">
          <td colSpan={6} className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Motivo da reprovação (opcional)"
                value={obsReprovacao}
                onChange={e => setObsReprovacao(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { onReprovar(obsReprovacao); setReprovando(false); } if (e.key === "Escape") setReprovando(false); }}
              />
              <Button size="sm" className="h-8 bg-red-600 hover:bg-red-700 text-xs gap-1" onClick={() => { onReprovar(obsReprovacao); setReprovando(false); }}>
                <XCircle className="w-3.5 h-3.5" /> Confirmar reprovação
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setReprovando(false)}>Cancelar</Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Card de pedido ───────────────────────────────────────────────────────────

function CardPedido({ pedido, onAtualizar }: { pedido: any; onAtualizar: () => void }) {
  const [expandido, setExpandido] = useState(true);
  const [itensMutados, setItensMutados] = useState<Record<number, { statusAprovacao: StatusAprovacao; observacaoReprovacao?: string }>>({});
  const [qtdsEditaveis, setQtdsEditaveis] = useState<Record<number, string>>(() =>
    Object.fromEntries((pedido.itens as any[]).map((it: any) => [it.id, it.quantidade != null ? String(it.quantidade) : ""]))
  );
  const utils = trpc.useUtils();

  const aprovarMut = trpc.suprimentos.aprovarItem.useMutation({
    onSuccess: () => { utils.suprimentos.listPedidosAprovacao.invalidate(); onAtualizar(); },
    onError: e => toast.error(e.message),
  });

  const itensComMutacao = pedido.itens.map((it: any) => ({
    ...it,
    ...(itensMutados[it.id] ?? {}),
  }));

  const statusPedido = calcularStatusPedido(itensComMutacao);
  const statusInfo = STATUS_PEDIDO[statusPedido] ?? STATUS_PEDIDO.aberto;

  const aprovarTodos = () => {
    pedido.itens.forEach((it: any) => {
      aprovarMut.mutate({ itemId: it.id, statusAprovacao: "aprovado" });
    });
    toast.success("Todos os itens aprovados!");
  };

  const handleAprovar = (itemId: number, quantidade?: number) => {
    setItensMutados(prev => ({ ...prev, [itemId]: { statusAprovacao: "aprovado" } }));
    aprovarMut.mutate({ itemId, statusAprovacao: "aprovado", quantidade });
  };

  const handleReprovar = (itemId: number, obs: string) => {
    setItensMutados(prev => ({ ...prev, [itemId]: { statusAprovacao: "reprovado", observacaoReprovacao: obs } }));
    aprovarMut.mutate({ itemId, statusAprovacao: "reprovado", observacaoReprovacao: obs || undefined });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-4 bg-muted/20 border-b">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            className="flex items-center gap-2 text-left min-w-0 flex-1"
            onClick={() => setExpandido(v => !v)}
          >
            {expandido ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight">
                Pedido {pedido.numero ? `nº ${pedido.numero}` : `#${pedido.id}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pedido.solicitante && <span>{pedido.solicitante} · </span>}
                {new Date(pedido.criadoEm).toLocaleDateString("pt-BR")}
                {pedido.observacao && <span> · {pedido.observacao}</span>}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusInfo.cls}`}>
              {statusInfo.label}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={aprovarTodos}
              disabled={aprovarMut.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5" /> Aprovar todos
            </Button>
          </div>
        </div>
      </CardHeader>

      {expandido && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 600 }}>
              <thead>
                <tr className="bg-muted/30 text-[11px] uppercase text-muted-foreground">
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">Material / Descrição</th>
                  <th className="p-2 text-right w-20">Qtd</th>
                  <th className="p-2 text-left w-20">Unidade</th>
                  <th className="p-2 text-right w-32">Valor est.</th>
                  <th className="p-2 w-44">Ação</th>
                </tr>
              </thead>
              <tbody>
                {itensComMutacao.map((it: any) => (
                  <LinhaItem
                    key={it.id}
                    item={it}
                    qtd={qtdsEditaveis[it.id] ?? ""}
                    onQtdChange={v => setQtdsEditaveis(prev => ({ ...prev, [it.id]: v }))}
                    salvando={aprovarMut.isPending}
                    onAprovar={(qtd) => handleAprovar(it.id, qtd)}
                    onReprovar={(obs) => handleReprovar(it.id, obs)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/10">
            {itensComMutacao.length} item(ns) · {itensComMutacao.filter((i: any) => (i.statusAprovacao ?? "pendente") === "aprovado").length} aprovado(s) · {itensComMutacao.filter((i: any) => (i.statusAprovacao ?? "pendente") === "reprovado").length} reprovado(s)
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AprovacaoPedidos() {
  const [obraId, setObraId] = useState<number | null>(null);
  const [aba, setAba] = useState<Grupo>("aguardando");
  const { data: obras = [], isLoading: carregandoObras } = trpc.obras.list.useQuery();

  const { data: pedidos = [], isLoading: carregandoPedidos, refetch } = trpc.suprimentos.listPedidosAprovacao.useQuery(
    { obraId: obraId! },
    { enabled: obraId != null }
  );

  const todos = pedidos as any[];
  const porGrupo = {
    aguardando: todos.filter(p => grupoPedido(p.itens) === "aguardando"),
    aprovados:  todos.filter(p => grupoPedido(p.itens) === "aprovados"),
    reprovados: todos.filter(p => grupoPedido(p.itens) === "reprovados"),
  };
  const pedidosAba = porGrupo[aba];

  const ABAS: { id: Grupo; label: string; cor: string }[] = [
    { id: "aguardando", label: "Aguardando aprovação", cor: "text-amber-600 border-amber-500" },
    { id: "aprovados",  label: "Aprovados",            cor: "text-green-600 border-green-500" },
    { id: "reprovados", label: "Reprovados",           cor: "text-red-600 border-red-500" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-5xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Aprovação de Pedidos</h1>
            <p className="text-sm text-muted-foreground">Analise e aprove ou reprove os itens de cada pedido</p>
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
                  {(obras as any[]).map((o: any) => (
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
              <Truck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Selecione uma obra para visualizar os pedidos.</p>
            </CardContent>
          </Card>
        ) : carregandoPedidos ? (
          <div className="flex justify-center py-14"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            {/* Abas */}
            <div className="flex items-center gap-1 border-b">
              {ABAS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    aba === t.id ? t.cor : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${aba === t.id ? "bg-muted" : "bg-muted/60"}`}>
                    {porGrupo[t.id].length}
                  </span>
                </button>
              ))}
            </div>

            {pedidosAba.length === 0 ? (
              <Card>
                <CardContent className="py-14 text-center">
                  {aba === "aguardando" && <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400/60" />}
                  {aba === "aprovados" && <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />}
                  {aba === "reprovados" && <XCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />}
                  <p className="text-muted-foreground text-sm">
                    {aba === "aguardando" && "Nenhum pedido aguardando aprovação nesta obra."}
                    {aba === "aprovados" && "Nenhum pedido aprovado ainda."}
                    {aba === "reprovados" && "Nenhum pedido reprovado."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{pedidosAba.length} pedido(s)</p>
                {pedidosAba.map((p: any) => (
                  <CardPedido key={p.id} pedido={p} onAtualizar={() => refetch()} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
