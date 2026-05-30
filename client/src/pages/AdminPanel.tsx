import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function AdminPanel() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedObra, setSelectedObra] = useState<number | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    usuarioId: "",
    permissao: "visualizar" as "visualizar" | "editar" | "admin",
  });

  // Verificar se é admin
  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Acesso Negado</CardTitle>
              <CardDescription>Apenas administradores podem acessar este painel</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { data: obras = [], isLoading: obrasLoading } = trpc.obras.list.useQuery();

  const { data: acessoList = [], isLoading: acessoLoading, refetch: refetchAcesso } = trpc.acessoObra.getByObra.useQuery(
    { obraId: selectedObra! },
    { enabled: !!selectedObra }
  );

  const createMutation = trpc.acessoObra.create.useMutation({
    onSuccess: () => {
      toast.success("Acesso concedido com sucesso!");
      setOpenDialog(false);
      setFormData({ usuarioId: "", permissao: "visualizar" });
      refetchAcesso();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao conceder acesso");
    },
  });

  const updateMutation = trpc.acessoObra.update.useMutation({
    onSuccess: () => {
      toast.success("Permissão atualizada!");
      refetchAcesso();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar permissão");
    },
  });

  const deleteMutation = trpc.acessoObra.delete.useMutation({
    onSuccess: () => {
      toast.success("Acesso removido!");
      refetchAcesso();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover acesso");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedObra || !formData.usuarioId) {
      toast.error("Selecione uma obra e um usuário");
      return;
    }

    createMutation.mutate({
      obraId: selectedObra,
      usuarioId: parseInt(formData.usuarioId),
      permissao: formData.permissao,
    });
  };

  const getPermissionColor = (permissao: string) => {
    switch (permissao) {
      case "admin":
        return "destructive";
      case "editar":
        return "default";
      case "visualizar":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPermissionLabel = (permissao: string) => {
    switch (permissao) {
      case "admin":
        return "Administrador";
      case "editar":
        return "Editar";
      case "visualizar":
        return "Visualizar";
      default:
        return permissao;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Painel de Administração</h1>
          <p className="text-muted-foreground">Gerencie permissões de acesso às obras</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Lista de Obras */}
          <Card>
            <CardHeader>
              <CardTitle>Obras</CardTitle>
              <CardDescription>Selecione uma obra para gerenciar permissões</CardDescription>
            </CardHeader>
            <CardContent>
              {obrasLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : obras.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma obra encontrada</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {obras.map((obra) => (
                    <button
                      key={obra.id}
                      onClick={() => setSelectedObra(obra.id)}
                      className={`p-4 text-left border rounded-lg transition-colors ${
                        selectedObra === obra.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      <div className="font-semibold">{obra.nome}</div>
                      <div className="text-sm opacity-75">{obra.cliente}</div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gerenciar Permissões */}
          {selectedObra && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Permissões de Acesso</CardTitle>
                  <CardDescription>
                    {obras.find((o) => o.id === selectedObra)?.nome}
                  </CardDescription>
                </div>
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Adicionar Acesso
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Conceder Acesso</DialogTitle>
                      <DialogDescription>
                        Conceda acesso a um usuário para esta obra
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="usuarioId">ID do Usuário *</Label>
                        <Input
                          id="usuarioId"
                          type="number"
                          value={formData.usuarioId}
                          onChange={(e) => setFormData({ ...formData, usuarioId: e.target.value })}
                          placeholder="Ex: 1"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="permissao">Permissão *</Label>
                        <select
                          id="permissao"
                          value={formData.permissao}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              permissao: e.target.value as "visualizar" | "editar" | "admin",
                            })
                          }
                          className="w-full px-3 py-2 border border-input rounded-md bg-background"
                        >
                          <option value="visualizar">Visualizar (somente leitura)</option>
                          <option value="editar">Editar (ler e escrever)</option>
                          <option value="admin">Administrador (controle total)</option>
                        </select>
                      </div>

                      <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                          {createMutation.isPending ? "Adicionando..." : "Adicionar"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {acessoLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner />
                  </div>
                ) : acessoList.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum usuário com acesso a esta obra
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Usuário</TableHead>
                          <TableHead>Permissão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acessoList.map((acesso) => (
                          <TableRow key={acesso.id}>
                            <TableCell className="font-medium">{acesso.usuarioId}</TableCell>
                            <TableCell>
                              <Badge variant={getPermissionColor(acesso.permissao)}>
                                {getPermissionLabel(acesso.permissao)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={acesso.ativo ? "default" : "secondary"}>
                                {acesso.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <button
                                onClick={() => {
                                  const newPermissao =
                                    acesso.permissao === "visualizar"
                                      ? "editar"
                                      : acesso.permissao === "editar"
                                        ? "admin"
                                        : "visualizar";
                                  updateMutation.mutate({
                                    acessoId: acesso.id,
                                    permissao: newPermissao as any,
                                  });
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                <Edit2 className="w-3 h-3" />
                                Alterar
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate({ acessoId: acesso.id })}
                                className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remover
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
