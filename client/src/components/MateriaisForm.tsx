import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface MateriaisFormProps {
  obraId: number;
  onSuccess?: () => void;
}

export function MateriaisForm({ obraId, onSuccess }: MateriaisFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    unidade: "m³",
    quantidade: "",
    custo: "",
  });

  const createMutation = trpc.materiais.create.useMutation({
    onSuccess: () => {
      toast.success("Material adicionado com sucesso!");
      setOpen(false);
      setFormData({
        nome: "",
        descricao: "",
        unidade: "m³",
        quantidade: "",
        custo: "",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar material");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome) {
      toast.error("Nome do material é obrigatório");
      return;
    }

    createMutation.mutate({
      obraId,
      nome: formData.nome,
      unidade: formData.unidade,
      quantidade: formData.quantidade || undefined,
      observacoes: formData.descricao || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Material
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Material</DialogTitle>
          <DialogDescription>Registre um novo material para a obra</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Material *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Cimento, Areia, Tijolos"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Observações</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Detalhes do material"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <select
                id="unidade"
                value={formData.unidade}
                onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="m³">m³</option>
                <option value="m²">m²</option>
                <option value="kg">kg</option>
                <option value="un">Unidade</option>
                <option value="l">Litro</option>
                <option value="m">Metro</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                step="0.01"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                placeholder="0"
              />
            </div>
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
