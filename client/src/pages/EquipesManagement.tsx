import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function EquipesManagement() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ nome: "", empresa: "" });

  const { data: equipes = [], refetch } = trpc.equipes.list.useQuery();

  const createMutation = trpc.equipes.create.useMutation({
    onSuccess: () => {
      toast.success("Equipe criada com sucesso");
      setFormData({ nome: "", empresa: "" });
      setOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar equipe");
    },
  });

  const deleteMutation = trpc.equipes.delete.useMutation({
    onSuccess: () => {
      toast.success("Equipe deletada com sucesso");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar equipe");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) {
      toast.error("Nome da equipe é obrigatório");
      return;
    }

    createMutation.mutate({ nome: formData.nome, empresa: formData.empresa });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Equipes</h1>
            <p className="text-muted-foreground mt-1">Gerencie as empresas/equipes de trabalho</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Equipe
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Equipe</DialogTitle>
                <DialogDescription>Adicione uma nova empresa ou equipe de trabalho</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome da Equipe *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Equipe A, Equipe B"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="empresa">Empresa *</Label>
                  <Input
                    id="empresa"
                    value={formData.empresa}
                    onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                    placeholder="Ex: RN Hidráulica, Construtora ABC"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Equipes List */}
        <div className="grid gap-4">
          {equipes.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <p className="text-muted-foreground mb-4">Nenhuma equipe cadastrada</p>
                <Button onClick={() => setOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Primeira Equipe
                </Button>
              </CardContent>
            </Card>
          ) : (
            equipes.map((equipe) => (
              <Card key={equipe.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{equipe.nome}</CardTitle>
                      <CardDescription className="mt-1">{equipe.empresa}</CardDescription>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja deletar a equipe "${equipe.nome}"?`)) {
                          deleteMutation.mutate({ id: equipe.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Criada em: {new Date(equipe.criadoEm).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Dica</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800">
            <p>
              As equipes representam empresas ou grupos de trabalho (ex: RN Hidráulica, Construtora ABC). 
              Após criar uma equipe, você pode adicionar funcionários a ela e selecioná-los nos diários de obra.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
