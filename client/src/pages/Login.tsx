import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "engenheiro" as const });
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("Login realizado!");
      await utils.auth.me.invalidate();
      navigate("/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      toast.success("Conta criada!");
      await utils.auth.me.invalidate();
      navigate("/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email: form.email, password: form.password });
    } else {
      registerMutation.mutate({ name: form.name, email: form.email, password: form.password, role: form.role });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Building2 className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Obra Digital</CardTitle>
          <CardDescription>
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Seu nome" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail ou usuário</Label>
              <Input id="email" type="text" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"} required />
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="role">Perfil</Label>
                <select id="role" className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                  <option value="engenheiro">Engenheiro</option>
                  <option value="admin">Administrador</option>
                  <option value="cliente">Cliente</option>
                </select>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Não tem conta?{" "}<button className="text-primary underline" onClick={() => setMode("register")}>Criar agora</button></>
            ) : (
              <>Já tem conta?{" "}<button className="text-primary underline" onClick={() => setMode("login")}>Entrar</button></>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
