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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(150deg, oklch(0.22 0.018 250) 0%, oklch(0.28 0.025 250) 55%, oklch(0.2 0.015 250) 100%)" }}>
      {/* textura sutil de pontos (papel de projeto) */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(oklch(1 0 0) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      {/* brilho âmbar de canto */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, oklch(0.605 0.135 55 / 0.25), transparent 70%)" }} />
      <Card className="w-full max-w-md relative shadow-2xl border-border/60">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl">Obra Digital</CardTitle>
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
          <div className="mt-4 text-center text-xs text-muted-foreground space-y-1">
            <p>O acesso é criado pelo administrador da sua empresa.</p>
            <p>Esqueceu a senha? Fale com o administrador para redefini-la.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
