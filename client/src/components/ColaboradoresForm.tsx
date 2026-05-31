import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { FUNCOES } from "@/lib/funcoes";

interface ColaboradoresFormProps {
  obraId: number;
  onSuccess?: () => void;
}

export function ColaboradoresForm({ obraId, onSuccess }: ColaboradoresFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    funcao: "",
    cpf: "",
    dataAdmissao: new Date().toISOString().split("T")[0],
    ativo: true,
  });

  const createMutation = trpc.colaboradores.create.useMutation({
    onSuccess: () => {
      toast.success("Colaborador adicionado com sucesso!");
      setOpen(false);
      setFormData({
        nome: "",
        funcao: "",
        cpf: "",
        dataAdmissao: new Date().toISOString().split("T")[0],
        ativo: true,
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar colaborador");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.funcao) {
      toast.error("Nome e função são obrigatórios");
      return;
    }

    createMutation.mutate({
      equipeId: 1, // TODO: Get from equipe selector
      nome: formData.nome,
      funcao: formData.funcao || "servente",
      cpf: formData.cpf || undefined,
      dataAdmissao: formData.dataAdmissao,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Colaborador</DialogTitle>
          <DialogDescription>Preencha os dados do colaborador</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funcao">Função *</Label>
            <select
              id="funcao"
              value={formData.funcao}
              onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            >
              <option value="">Selecione uma função</option>
              {FUNCOES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataAdmissao">Data de Admissão *</Label>
            <Input
              id="dataAdmissao"
              type="date"
              value={formData.dataAdmissao}
              onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
              required
            />
          </div>



          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
