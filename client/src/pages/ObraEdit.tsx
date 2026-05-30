import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useState } from "react";

// ─── Helper: formata Date para input[type=date] ────────────────────────────
function toDateInput(val: any): string {
  if (!val) return "";
  try {
    return new Date(val).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

// ─── Seção visual ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
        <Separator className="mt-2" />
      </div>
      {children}
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────

export default function ObraEdit() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/obras/:id/edit");
  const obraId = params?.id ? parseInt(params.id) : null;

  const { data: obra, isLoading } = trpc.obras.getById.useQuery(
    { id: obraId! },
    { enabled: !!obraId }
  );

  const [form, setForm] = useState({
    // Identificação
    codigo:             "",
    nome:               "",
    // Cliente
    cliente:            "",
    // Localização
    endereco:           "",
    cidade:             "",
    estado:             "",
    cep:                "",
    // Responsável
    responsavelTecnico: "",
    crea:               "",
    // Datas e contrato
    dataInicio:         "",
    dataPrevistTermino: "",
    valorContrato:      "",
    // Progresso
    status:             "planejamento" as "planejamento" | "em_andamento" | "pausada" | "finalizada",
    percentualAndamento: 0,
    // Descrição
    descricao:          "",
  });

  // Preenche o form quando os dados chegam
  useEffect(() => {
    if (!obra) return;
    setForm({
      codigo:             obra.codigo              ?? "",
      nome:               obra.nome                ?? "",
      cliente:            obra.cliente             ?? "",
      endereco:           obra.endereco            ?? "",
      cidade:             obra.cidade              ?? "",
      estado:             obra.estado              ?? "",
      cep:                obra.cep                 ?? "",
      responsavelTecnico: obra.responsavelTecnico  ?? "",
      crea:               obra.crea                ?? "",
      dataInicio:         toDateInput(obra.dataInicio),
      dataPrevistTermino: toDateInput(obra.dataPrevistTermino),
      valorContrato:      obra.valorContrato        ?? "",
      status:             (obra.status as any)      ?? "planejamento",
      percentualAndamento: obra.percentualAndamento ?? 0,
      descricao:          obra.descricao            ?? "",
    });
  }, [obra]);

  const updateMutation = trpc.obras.update.useMutation({
    onSuccess: () => {
      toast.success("Obra atualizada com sucesso!");
      navigate(`/obras/${obraId}`);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar obra"),
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error("Nome da obra é obrigatório"); return; }
    if (!form.codigo.trim()) { toast.error("Código é obrigatório"); return; }
    updateMutation.mutate({ id: obraId!, ...form });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]"><Spinner /></div>
      </DashboardLayout>
    );
  }

  if (!obra) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Obra não encontrada</p>
          <Button onClick={() => navigate("/obras")}>Voltar para obras</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editar Obra</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{obra.nome}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Identificação ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Código *</Label>
                  <Input value={form.codigo} onChange={set("codigo")} placeholder="Ex: OBR-001" required />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>Nome da Obra *</Label>
                  <Input value={form.nome} onChange={set("nome")} placeholder="Nome da obra" required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Cliente e Responsável ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Cliente e Responsável</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Input value={form.cliente} onChange={set("cliente")} placeholder="Nome do cliente ou empresa" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Responsável Técnico</Label>
                  <Input value={form.responsavelTecnico} onChange={set("responsavelTecnico")} placeholder="Nome do engenheiro" />
                </div>
                <div className="space-y-1.5">
                  <Label>CREA <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input value={form.crea} onChange={set("crea")} placeholder="Número do CREA" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Localização ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Localização</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={set("endereco")} placeholder="Rua, número, complemento" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={set("cidade")} placeholder="Cidade" />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Input value={form.estado} onChange={set("estado")} placeholder="SP" maxLength={2} className="uppercase" />
                </div>
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input value={form.cep} onChange={set("cep")} placeholder="00000-000" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Datas e Contrato ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Datas e Contrato</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Data de Início</Label>
                  <Input type="date" value={form.dataInicio} onChange={set("dataInicio")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data Prevista de Término</Label>
                  <Input type="date" value={form.dataPrevistTermino} onChange={set("dataPrevistTermino")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Valor do Contrato <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  value={form.valorContrato}
                  onChange={set("valorContrato")}
                  placeholder="Ex: R$ 250.000,00"
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Progresso ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Progresso e Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={v => setForm(f => ({ ...f, status: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planejamento">📋 Planejamento</SelectItem>
                      <SelectItem value="em_andamento">🚧 Em Andamento</SelectItem>
                      <SelectItem value="pausada">⏸️ Pausada</SelectItem>
                      <SelectItem value="finalizada">✅ Finalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Percentual de Andamento — <span className="text-primary font-semibold">{form.percentualAndamento}%</span></Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.percentualAndamento}
                    onChange={e => setForm(f => ({ ...f, percentualAndamento: parseInt(e.target.value) }))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Descrição ── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Descrição</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.descricao}
                onChange={set("descricao")}
                placeholder="Descrição geral da obra, escopo, observações..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* ── Ações ── */}
          <div className="flex gap-3 pb-8">
            <Button type="submit" className="gap-2" disabled={updateMutation.isPending}>
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/obras/${obraId}`)}
            >
              Cancelar
            </Button>
          </div>

        </form>
      </div>
    </DashboardLayout>
  );
}
