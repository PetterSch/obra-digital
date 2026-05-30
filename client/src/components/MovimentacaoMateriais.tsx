import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface MovimentacaoMateriaisProps {
  obraId: number;
}

export function MovimentacaoMateriais({ obraId }: MovimentacaoMateriaisProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    materialId: "",
    tipo: "entrada",
    quantidade: "",
    observacoes: "",
  });

  const { data: materiais = [], isLoading: materiaisLoading } = trpc.materiais.listByObra.useQuery(
    { obraId },
    { enabled: !!obraId }
  );

  const { data: movimentacoes = [], isLoading: movimentacoesLoading, error: movimentacoesError, refetch } = trpc.materiais.listByObra.useQuery(
    { obraId },
    { enabled: !!obraId }
  );

  const createMutation = trpc.materiais.addMovimentacao.useMutation({
    onSuccess: () => {
      toast.success("Movimentação registrada com sucesso!");
      setOpen(false);
      setFormData({ materialId: "", tipo: "entrada", quantidade: "", observacoes: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar movimentação");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.materialId || !formData.quantidade) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    createMutation.mutate({
      materialId: parseInt(formData.materialId),
      tipo: formData.tipo as "entrada" | "saida",
      quantidade: formData.quantidade,
      data: new Date().toISOString().split('T')[0],
      observacoes: formData.observacoes || undefined,
    });
  };

  if (materiaisLoading || movimentacoesLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (movimentacoesError) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8">
          <p className="text-red-600 mb-4">Erro ao carregar movimentacoes</p>
          <button
            onClick={() => refetch()}
            className="text-blue-600 hover:underline text-sm"
          >
            Tentar novamente
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Movimentação de Materiais</CardTitle>
            <CardDescription>{movimentacoes.length} movimentação(ões)</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Registrar Movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Movimentação</DialogTitle>
                <DialogDescription>Registre entrada ou saída de material</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="material">Material *</Label>
                  <select
                    id="material"
                    value={formData.materialId}
                    onChange={(e) => setFormData({ ...formData, materialId: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="">Selecione um material</option>
                    {materiais.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.nome} ({mat.unidade})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo *</Label>
                    <select
                      id="tipo"
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade *</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      step="0.01"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Input
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Registrando..." : "Registrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {movimentacoes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma movimentação registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.map((mov: any) => (
                    <TableRow key={mov.id}>
                      <TableCell className="font-medium">{mov.materialNome || "Material"}</TableCell>
                      <TableCell>
                        <Badge variant={mov.tipo === "entrada" ? "default" : "destructive"} className="gap-1">
                          {mov.tipo === "entrada" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {mov.tipo === "entrada" ? "Entrada" : "Saída"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {parseFloat(mov.quantidade || "0").toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(mov.data).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {mov.observacoes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
