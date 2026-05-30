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
  const [form, setForm] = useState({ email: "", password: "" });
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      toast.success("Login realizado!");
      await utils.auth.me.invalidate();
      navigate("/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = loginMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email: form.email, password: form.password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Building2 className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Obra Digital</CardTitle>
          <CardDescription>Entre na sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail ou usuário</Label>
              <Input id="email" type="text" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="e-mail ou usuário" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Sua senha" required />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            O acesso é criado pelo administrador da sua empresa.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
