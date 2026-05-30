import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, ShieldCheck, HardHat, Eye, UserCog, Building2, KeyRound, Pencil } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const ROLE_INFO: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  admin:      { label: "Administrador", icon: <ShieldCheck className="w-3.5 h-3.5" />, color: "bg-red-100 text-red-700 border-red-200", desc: "Vê e gerencia tudo" },
  engenheiro: { label: "Engenheiro",    icon: <HardHat className="w-3.5 h-3.5" />,    color: "bg-blue-100 text-blue-700 border-blue-200", desc: "Edita obras liberadas" },
  auxiliar:   { label: "Auxiliar",      icon: <HardHat className="w-3.5 h-3.5" />,    color: "bg-teal-100 text-teal-700 border-teal-200", desc: "Mesmas permissões do engenheiro" },
  cliente:    { label: "Cliente",       icon: <Eye className="w-3.5 h-3.5" />,        color: "bg-gray-100 text-gray-700 border-gray-200", desc: "Visualiza obras liberadas" },
};

const FORM_DEFAULT = {
  name: "", username: "", email: "", password: "",
  role: "engenheiro" as "admin" | "engenheiro" | "cliente" | "auxiliar",
  obraIds: [] as number[],
};

export default function AdminPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", username: "", email: "", role: "engenheiro" as "admin" | "engenheiro" | "cliente" | "auxiliar" });

  // Gate de admin
  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Acesso Negado</CardTitle>
              <CardDescription>Apenas administradores podem acessar este painel.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { data: usuarios = [], isLoading, refetch } = trpc.admin.listUsers.useQuery();
  const { data: obras = [] } = trpc.obras.list.useQuery();

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setForm(FORM_DEFAULT);
      setOpen(false);
      refetch();
    },
    onError: (e) => toast.error(e.message || "Erro ao criar usuário"),
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { toast.success("Usuário removido!"); refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao remover usuário"),
  });

  const resetMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setResetUser(null);
      setNovaSenha("");
    },
    onError: (e) => toast.error(e.message || "Erro ao redefinir senha"),
  });

  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success("Usuário atualizado!"); setEditUser(null); refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar usuário"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.username || !form.email || !form.password) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    createMutation.mutate(form);
  };

  const toggleObra = (id: number) => {
    setForm(f => ({
      ...f,
      obraIds: f.obraIds.includes(id) ? f.obraIds.filter(o => o !== id) : [...f.obraIds, id],
    }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <UserCog className="w-6 h-6 text-primary" />
              Usuários
            </h1>
            <p className="text-muted-foreground mt-1">Crie acessos e defina quais obras cada usuário pode ver</p>
          </div>
          <Button className="gap-2 self-start sm:self-auto" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>

        {/* Lista de usuários */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="grid gap-3">
            {usuarios.map((u: any) => {
              const info = ROLE_INFO[u.role] ?? ROLE_INFO.cliente;
              const isMe = u.id === user.id;
              return (
                <Card key={u.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary">
                        {(u.name ?? u.username ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          {u.name}
                          {isMe && <Badge variant="outline" className="text-xs">você</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          @{u.username} · {u.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${info.color}`}>
                        {info.icon}{info.label}
                      </span>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Editar usuário"
                        onClick={() => { setEditUser(u); setEditForm({ name: u.name ?? "", username: u.username ?? "", email: u.email ?? "", role: u.role ?? "engenheiro" }); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Redefinir senha"
                        onClick={() => { setResetUser(u); setNovaSenha(""); }}
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      {!isMe && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover o usuário "${u.name}"?`)) deleteMutation.mutate({ id: u.id });
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal criar usuário */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie o acesso e defina o que essa pessoa pode ver</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome da pessoa" />
              </div>
              <div className="space-y-1.5">
                <Label>Usuário *</Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ex: joao.silva" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha *</Label>
                <Input type="text" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
            </div>

            {/* Perfil */}
            <div className="space-y-1.5">
              <Label>Perfil de acesso *</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="engenheiro">🏗️ Engenheiro — edita obras liberadas</SelectItem>
                  <SelectItem value="auxiliar">🧰 Auxiliar — mesmas permissões do engenheiro</SelectItem>
                  <SelectItem value="cliente">👁️ Cliente — só visualiza obras liberadas</SelectItem>
                  <SelectItem value="admin">🛡️ Administrador — vê e gerencia tudo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Seleção de obras (só se não for admin) */}
            {form.role !== "admin" ? (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Obras que pode acessar
                </Label>
                {obras.length === 0 ? (
                  <p className="text-sm text-muted-foreground border rounded-lg p-3">
                    Nenhuma obra cadastrada ainda.
                  </p>
                ) : (
                  <div className="border rounded-lg divide-y max-h-52 overflow-y-auto">
                    {obras.map((o: any) => (
                      <label key={o.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
                        <Checkbox
                          checked={form.obraIds.includes(o.id)}
                          onCheckedChange={() => toggleObra(o.id)}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{o.nome}</div>
                          <div className="text-xs text-muted-foreground truncate">{o.codigo} · {o.cliente}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {form.obraIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">{form.obraIds.length} obra(s) selecionada(s)</p>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Administradores têm acesso a todas as obras automaticamente.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar usuário"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal redefinir senha */}
      <Dialog open={!!resetUser} onOpenChange={v => { if (!v) { setResetUser(null); setNovaSenha(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para <strong>{resetUser?.name}</strong> (@{resetUser?.username})
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (novaSenha.length < 6) { toast.error("A senha deve ter ao menos 6 caracteres"); return; }
              resetMutation.mutate({ id: resetUser.id, novaSenha });
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="text"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Informe essa senha ao usuário. Ele poderá trocá-la depois.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? "Salvando..." : "Redefinir senha"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setResetUser(null); setNovaSenha(""); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal editar usuário */}
      <Dialog open={!!editUser} onOpenChange={v => { if (!v) setEditUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere os dados de {editUser?.name}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!editForm.name || !editForm.username || !editForm.email) { toast.error("Preencha todos os campos"); return; }
              updateMutation.mutate({ id: editUser.id, ...editForm });
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Usuário</Label>
              <Input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="engenheiro">🏗️ Engenheiro</SelectItem>
                  <SelectItem value="auxiliar">🧰 Auxiliar</SelectItem>
                  <SelectItem value="cliente">👁️ Cliente</SelectItem>
                  <SelectItem value="admin">🛡️ Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
