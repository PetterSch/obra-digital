import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Search, Building2 } from "lucide-react";

/**
 * Faturamento da obra: entidades (razão social / CNPJ) habilitadas para emitir
 * a nota das Ordens de Compra desta obra. Ao gerar uma OC, o usuário escolhe
 * em nome de qual dessas entidades quer faturar.
 */
export function FaturamentoTab({ obraId }: { obraId: number }) {
  const utils = trpc.useUtils();
  const { data: entidades = [], isLoading } = trpc.obras.faturamentoList.useQuery({ obraId });
  const { data: fornecedores = [] } = trpc.fornecedores.list.useQuery();
  const [busca, setBusca] = useState("");

  const addMut = trpc.obras.faturamentoAdd.useMutation({
    onSuccess: () => { utils.obras.faturamentoList.invalidate({ obraId }); toast.success("Entidade habilitada para faturamento"); },
    onError: (e) => toast.error(e.message || "Erro ao adicionar"),
  });
  const removeMut = trpc.obras.faturamentoRemove.useMutation({
    onSuccess: () => { utils.obras.faturamentoList.invalidate({ obraId }); toast.success("Entidade removida"); },
    onError: (e) => toast.error(e.message || "Erro ao remover"),
  });

  const idsHabilitados = new Set((entidades as any[]).map(e => Number(e.fornecedorId)));

  const resultados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const base = (fornecedores as any[]).filter(f => !idsHabilitados.has(Number(f.id)));
    if (!q) return base.slice(0, 8);
    return base.filter(f =>
      (f.nome ?? "").toLowerCase().includes(q) ||
      (f.nomeFantasia ?? "").toLowerCase().includes(q) ||
      (f.cpfCnpj ?? "").toLowerCase().includes(q)
    ).slice(0, 12);
  }, [fornecedores, busca, idsHabilitados]);

  const endereco = (f: any) =>
    [ [f.endereco, f.numero].filter(Boolean).join(", "), f.bairro,
      [f.cidade, f.uf].filter(Boolean).join("/"), f.cep ].filter(Boolean).join(" – ");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold leading-tight">Faturamento</h3>
          <p className="text-xs text-muted-foreground">
            Entidades habilitadas para emitir a nota das Ordens de Compra desta obra. Ao gerar uma OC, você escolhe em nome de qual delas faturar.
          </p>
        </div>
      </div>

      {/* Adicionar */}
      <Card>
        <CardContent className="pt-4 pb-3 space-y-3">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Habilitar entidade (do cadastro de Fornecedores)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar por razão social, nome fantasia ou CNPJ..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          {(busca || resultados.length > 0) && (
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {resultados.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">Nenhum fornecedor encontrado.</div>
              ) : resultados.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-2.5 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[f.cpfCnpj ? `CNPJ/CPF: ${f.cpfCnpj}` : "", endereco(f)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" className="h-8 gap-1 shrink-0" disabled={addMut.isPending}
                    onClick={() => addMut.mutate({ obraId, fornecedorId: f.id })}>
                    <Plus className="w-3.5 h-3.5" /> Habilitar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Habilitadas */}
      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>
      ) : entidades.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">Nenhuma entidade de faturamento habilitada ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Use a busca acima para habilitar (ex: o seu próprio CNPJ, ou o do cliente).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(entidades as any[]).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{e.nome}{e.nomeFantasia && e.nomeFantasia !== e.nome ? ` (${e.nomeFantasia})` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.cpfCnpj ? `CNPJ/CPF: ${e.cpfCnpj}` : "Sem CNPJ cadastrado"}
                  </p>
                  {endereco(e) && <p className="text-xs text-muted-foreground truncate">{endereco(e)}</p>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" title="Remover"
                onClick={() => removeMut.mutate({ obraId, fornecedorId: e.fornecedorId })} disabled={removeMut.isPending}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
