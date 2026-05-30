import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface PendenciasFormProps {
  obraId: number;
  onSuccess?: () => void;
}

export function PendenciasForm({ obraId, onSuccess }: PendenciasFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    criticidade: "media",
    responsavel: "",
    dataVencimento: new Date().toISOString().split("T")[0],
  });

  const createMutation = trpc.pendencias.create.useMutation({
    onSuccess: () => {
      toast.success("Pendência registrada com sucesso!");
      setOpen(false);
      setFormData({
        titulo: "",
        descricao: "",
        criticidade: "media",
        responsavel: "",
        dataVencimento: new Date().toISOString().split("T")[0],
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar pendência");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.descricao) {
      toast.error("Título e descrição são obrigatórios");
      return;
    }

    createMutation.mutate({
      obraId,
      titulo: formData.titulo,
      descricao: formData.descricao,
      prioridade: (formData.criticidade as "baixa" | "media" | "alta" | "critica"),
      dataVencimento: formData.dataVencimento || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Pendência
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pendência</DialogTitle>
          <DialogDescription>Preencha os dados da pendência ou não-conformidade</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Título da pendência"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva a pendência em detalhes"
              className="min-h-24"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="criticidade">Criticidade *</Label>
              <select
                id="criticidade"
                value={formData.criticidade}
                onChange={(e) => setFormData({ ...formData, criticidade: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                required
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataVencimento">Data de Vencimento</Label>
            <Input
              id="dataVencimento"
              type="date"
              value={formData.dataVencimento}
              onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
            />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Input
              id="responsavel"
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
              placeholder="Nome do responsável"
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
  );
}
