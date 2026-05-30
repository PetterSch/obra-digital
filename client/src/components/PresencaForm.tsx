import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface PresencaFormProps {
  diarioId: number;
  onSuccess?: () => void;
}

export function PresencaForm({ diarioId, onSuccess }: PresencaFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    colaboradorId: "",
    presenca: "presente",
    horaEntrada: "08:00",
    horaSaida: "17:00",
  });

  const createMutation = trpc.presenca.create.useMutation({
    onSuccess: () => {
      toast.success("Presença registrada com sucesso!");
      setOpen(false);
      setFormData({
        colaboradorId: "",
        presenca: "presente",
        horaEntrada: "08:00",
        horaSaida: "17:00",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar presença");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.colaboradorId) {
      toast.error("Selecione um colaborador");
      return;
    }

    createMutation.mutate({
      diarioId,
      colaboradorId: parseInt(formData.colaboradorId),
      data: new Date().toISOString().split('T')[0],
      presente: formData.presenca === "presente",
      horarioChegada: formData.horaEntrada || undefined,
      horarioSaida: formData.horaSaida || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Registrar Presença
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Presença</DialogTitle>
          <DialogDescription>Registre a presença de um colaborador</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="colaborador">Colaborador *</Label>
            <select
              id="colaborador"
              value={formData.colaboradorId}
              onChange={(e) => setFormData({ ...formData, colaboradorId: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            >
              <option value="">Selecione um colaborador</option>
              <option value="1">Colaborador 1 - Pedreiro</option>
              <option value="2">Colaborador 2 - Carpinteiro</option>
              <option value="3">Colaborador 3 - Encanador</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="presenca">Tipo de Presença *</Label>
            <select
              id="presenca"
              value={formData.presenca}
              onChange={(e) => setFormData({ ...formData, presenca: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              <option value="presente">Presente</option>
              <option value="falta">Falta</option>
              <option value="atraso">Atraso</option>
              <option value="saida_antecipada">Saída Antecipada</option>
            </select>
          </div>

          {formData.presenca === "presente" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entrada">Hora de Entrada</Label>
                  <Input
                    id="entrada"
                    type="time"
                    value={formData.horaEntrada}
                    onChange={(e) => setFormData({ ...formData, horaEntrada: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida">Hora de Saída</Label>
                  <Input
                    id="saida"
                    type="time"
                    value={formData.horaSaida}
                    onChange={(e) => setFormData({ ...formData, horaSaida: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

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
