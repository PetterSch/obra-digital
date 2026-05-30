import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { MaoDeObraSelector } from "./MaoDeObraSelector";

interface DiarioFormProps {
  obraId: number;
  onSuccess?: () => void;
}

export function DiarioForm({ obraId, onSuccess }: DiarioFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split("T")[0],
    clima: "ensolarado" as string,
    temperatura: "",
    umidade: "",
    observacoesGerais: "",
  });

  const [atividades, setAtividades] = useState<Array<{ descricao: string; local: string; status: string; percentualConcluido: string }>>([]);
  const [maoDeObra, setMaoDeObra] = useState<Array<{ equipeId: number; operariosPresentes: number[] }>>([]);
  const [equipamentos, setEquipamentos] = useState<Array<{ nome: string; quantidade: string; horasUso: string }>>([]);
  const [ocorrencias, setOcorrencias] = useState<Array<{ tipo: string; descricao: string; criticidade: string }>>([]);

  const createMutation = trpc.diarios.create.useMutation({
    onSuccess: () => {
      toast.success("Diário criado com sucesso!");
      setOpen(false);
      setFormData({
        data: new Date().toISOString().split("T")[0],
        clima: "",
        temperatura: "",
        umidade: "",
        observacoesGerais: "",
      });
      setAtividades([]);
      setMaoDeObra([]);
      setEquipamentos([]);
      setOcorrencias([]);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar diário");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.data) {
      toast.error("Data é obrigatória");
      return;
    }

    createMutation.mutate({
      obraId,
      data: formData.data,
      clima: (formData.clima as "ensolarado" | "nublado" | "chuvoso" | "tempestade" | "ventania" | undefined) || undefined,
      temperatura: formData.temperatura ? parseFloat(formData.temperatura).toString() : undefined,
      umidade: formData.umidade ? parseInt(formData.umidade) : undefined,
      observacoesGerais: formData.observacoesGerais || undefined,
      maoDeObra: maoDeObra.length > 0 ? maoDeObra : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Diário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Diário de Obra</DialogTitle>
          <DialogDescription>Preencha as informações do diário</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="font-semibold">Informações Básicas</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clima">Clima</Label>
                <select
                id="clima"
                value={formData.clima}
                onChange={(e) => setFormData({ ...formData, clima: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="ensolarado">Ensolarado</option>
                <option value="nublado">Nublado</option>
                <option value="chuvoso">Chuvoso</option>
                <option value="tempestade">Tempestade</option>
                <option value="ventania">Ventania</option>
              </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperatura">Temperatura (°C)</Label>
                <Input
                  id="temperatura"
                  type="number"
                  step="0.1"
                  value={formData.temperatura}
                  onChange={(e) => setFormData({ ...formData, temperatura: e.target.value })}
                  placeholder="25.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="umidade">Umidade (%)</Label>
                <Input
                  id="umidade"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.umidade}
                  onChange={(e) => setFormData({ ...formData, umidade: e.target.value })}
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Gerais</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoesGerais}
                  onChange={(e) => setFormData({ ...formData, observacoesGerais: e.target.value })}
                  placeholder="Observações gerais do dia..."
                  className="min-h-20"
                />
              </div>
            </div>
          </div>

          {/* Atividades */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Atividades Executadas</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAtividades([...atividades, { descricao: "", local: "", status: "em_execução", percentualConcluido: "0" }])}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
            {atividades.map((ativ, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAtividades(atividades.filter((_, i) => i !== idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={ativ.descricao}
                      onChange={(e) => {
                        const newAtiv = [...atividades];
                        newAtiv[idx].descricao = e.target.value;
                        setAtividades(newAtiv);
                      }}
                      placeholder="Descrição da atividade"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Local</Label>
                      <Input
                        value={ativ.local}
                        onChange={(e) => {
                          const newAtiv = [...atividades];
                          newAtiv[idx].local = e.target.value;
                          setAtividades(newAtiv);
                        }}
                        placeholder="Local da atividade"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <select
                        value={ativ.status}
                        onChange={(e) => {
                          const newAtiv = [...atividades];
                          newAtiv[idx].status = e.target.value;
                          setAtividades(newAtiv);
                        }}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value="em_execução">Em Execução</option>
                        <option value="concluída">Concluída</option>
                        <option value="pausada">Pausada</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>% Concluído</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={ativ.percentualConcluido}
                        onChange={(e) => {
                          const newAtiv = [...atividades];
                          newAtiv[idx].percentualConcluido = e.target.value;
                          setAtividades(newAtiv);
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mão de Obra */}
          <div className="space-y-4">
            <h3 className="font-semibold">Mão de Obra - Selecione Equipes e Operários</h3>
            <MaoDeObraSelector value={maoDeObra} onChange={setMaoDeObra} />
          </div>

          {/* Equipamentos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Equipamentos</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEquipamentos([...equipamentos, { nome: "", quantidade: "", horasUso: "" }])}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
            {equipamentos.map((equip, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEquipamentos(equipamentos.filter((_, i) => i !== idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input
                        value={equip.nome}
                        onChange={(e) => {
                          const newEquip = [...equipamentos];
                          newEquip[idx].nome = e.target.value;
                          setEquipamentos(newEquip);
                        }}
                        placeholder="Ex: Escavadeira"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        value={equip.quantidade}
                        onChange={(e) => {
                          const newEquip = [...equipamentos];
                          newEquip[idx].quantidade = e.target.value;
                          setEquipamentos(newEquip);
                        }}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horas de Uso</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={equip.horasUso}
                        onChange={(e) => {
                          const newEquip = [...equipamentos];
                          newEquip[idx].horasUso = e.target.value;
                          setEquipamentos(newEquip);
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ocorrências */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ocorrências</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOcorrencias([...ocorrencias, { tipo: "outro", descricao: "", criticidade: "baixa" }])}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
            {ocorrencias.map((ocor, idx) => (
              <Card key={idx}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOcorrencias(ocorrencias.filter((_, i) => i !== idx))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={ocor.descricao}
                      onChange={(e) => {
                        const newOcor = [...ocorrencias];
                        newOcor[idx].descricao = e.target.value;
                        setOcorrencias(newOcor);
                      }}
                      placeholder="Descrição da ocorrência"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <select
                        value={ocor.tipo}
                        onChange={(e) => {
                          const newOcor = [...ocorrencias];
                          newOcor[idx].tipo = e.target.value;
                          setOcorrencias(newOcor);
                        }}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value="acidente">Acidente</option>
                        <option value="atraso">Atraso</option>
                        <option value="defeito">Defeito</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Criticidade</Label>
                      <select
                        value={ocor.criticidade}
                        onChange={(e) => {
                          const newOcor = [...ocorrencias];
                          newOcor[idx].criticidade = e.target.value;
                          setOcorrencias(newOcor);
                        }}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value="baixa">Baixa</option>
                        <option value="média">Média</option>
                        <option value="alta">Alta</option>
                        <option value="crítica">Crítica</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Diário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
