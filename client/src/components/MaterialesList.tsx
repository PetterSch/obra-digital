import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

interface MateriaisListProps {
  obraId: number;
}

export function MaterialesList({ obraId }: MateriaisListProps) {
  const { data: materiais = [], isLoading, error, refetch } = trpc.materiais.listByObra.useQuery(
    { obraId },
    { enabled: !!obraId }
  );

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ nome: "", unidade: "", quantidade: "", fornecedor: "", observacoes: "" });

  const updateMutation = trpc.materiais.update.useMutation({
    onSuccess: () => { toast.success("Material atualizado!"); setEditing(null); refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar material"),
  });

  const deleteMutation = trpc.materiais.delete.useMutation({
    onSuccess: () => { toast.success("Material removido!"); refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao remover material"),
  });

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      nome: m.nome ?? "",
      unidade: m.unidade ?? "",
      quantidade: m.quantidade ?? "",
      fornecedor: m.fornecedor ?? "",
      observacoes: m.observacoes ?? "",
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.unidade) { toast.error("Nome e unidade são obrigatórios"); return; }
    updateMutation.mutate({ id: editing.id, ...form });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center py-8"><Spinner /></CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8">
          <p className="text-red-600 mb-4">Erro ao carregar materiais</p>
          <button onClick={() => refetch()} className="text-blue-600 hover:underline text-sm">Tentar novamente</button>
        </CardContent>
      </Card>
    );
  }

  if (materiais.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8">
          <p className="text-muted-foreground">Nenhum material cadastrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estoque de Materiais</CardTitle>
        <CardDescription>{materiais.length} material(is) cadastrado(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiais.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">{material.nome}</TableCell>
                  <TableCell><Badge variant="outline">{material.unidade}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">
                    {parseFloat(material.quantidade || "0").toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {material.observacoes || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(material)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => { if (confirm(`Excluir o material "${material.nome}"?`)) deleteMutation.mutate({ id: material.id }); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Modal de edição */}
      <Dialog open={!!editing} onOpenChange={v => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Material</DialogTitle>
            <DialogDescription>{editing?.nome}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Cimento" />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade *</Label>
                <Input value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })} placeholder="kg, m², sc..." />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input type="number" step="0.01" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Fornecedor</Label>
                <Input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} placeholder="Nome do fornecedor" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Observações</Label>
                <Input value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Opcional" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
