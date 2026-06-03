import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X, ImagePlus, CloudSun, ClipboardList, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { MaoDeObraSelector } from "./MaoDeObraSelector";
import { hojeISO, dataISO } from "@/lib/data";

interface DiarioFormProps {
  obraId: number;
  onSuccess?: () => void;
}

export function DiarioForm({ obraId, onSuccess }: DiarioFormProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    data: hojeISO(),
    clima: "ensolarado" as string,
    temperatura: "",
    umidade: "",
    observacoesGerais: "",
  });

  const [atividades, setAtividades] = useState<Array<{ descricao: string; local: string; status: string; percentualConcluido: string }>>([]);
  const [maoDeObra, setMaoDeObra] = useState<Array<{ equipeId: number; operariosPresentes: number[] }>>([]);
  const [ocorrencias, setOcorrencias] = useState<Array<{ tipo: string; descricao: string; criticidade: string }>>([]);
  // Fotos coletadas antes de criar o diário (enviadas após a criação)
  const [fotos, setFotos] = useState<Array<{ base64: string; nome: string; mimeType: string; descricao: string }>>([]);
  const [enviando, setEnviando] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Atividades do diário mais recente da obra (para pré-preencher o novo diário)
  const { data: diariosObra = [] } = trpc.diarios.listByObra.useQuery({ obraId }, { enabled: open });
  const ultimoDiario = [...(diariosObra as any[])].sort((a, b) => dataISO(b.data).localeCompare(dataISO(a.data)))[0];
  const { data: atividadesAnteriores = [] } = trpc.atividades.listByDiario.useQuery(
    { diarioId: ultimoDiario?.id! },
    { enabled: open && !!ultimoDiario }
  );

  useEffect(() => {
    if (open && !prefilled && atividades.length === 0 && (atividadesAnteriores as any[]).length > 0) {
      setAtividades((atividadesAnteriores as any[]).map((a) => ({
        descricao: a.descricao || "",
        local: a.local || "",
        status: a.status || "em_andamento",
        percentualConcluido: a.percentualConcluido != null ? String(a.percentualConcluido) : "",
      })));
      setPrefilled(true);
      toast.info(`${(atividadesAnteriores as any[]).length} atividade(s) copiada(s) do diário anterior — ajuste conforme o dia.`);
    }
  }, [open, atividadesAnteriores]);

  useEffect(() => { if (!open) setPrefilled(false); }, [open]);

  const uploadMutation = trpc.midia.upload.useMutation();
  const addAtividade = trpc.atividades.create.useMutation();
  const addOcorrencia = trpc.ocorrencias.create.useMutation();

  const createMutation = trpc.diarios.create.useMutation({
    onSuccess: async (diarioCriado: any) => {
      const novoId = diarioCriado?.id;
      if (novoId) {
        setEnviando(true);
        try {
          // Atividades
          for (const a of atividades) {
            if (!a.descricao?.trim()) continue;
            await addAtividade.mutateAsync({
              diarioId: novoId, descricao: a.descricao.trim(),
              local: a.local || undefined,
              status: (a.status || undefined) as any,
              percentualConcluido: a.percentualConcluido ? parseInt(a.percentualConcluido) : undefined,
            });
          }
          // Ocorrências
          for (const oc of ocorrencias) {
            if (!oc.descricao?.trim()) continue;
            await addOcorrencia.mutateAsync({
              diarioId: novoId, descricao: oc.descricao.trim(),
              tipo: (oc.tipo || "outro") as any,
              criticidade: (oc.criticidade || undefined) as any,
            });
          }
          // Fotos
          for (const f of fotos) {
            await uploadMutation.mutateAsync({
              diarioId: novoId, obraId, tipo: "foto",
              descricao: f.descricao || undefined,
              arquivo: f.base64, nomeOriginal: f.nome, mimeType: f.mimeType,
            });
          }
        } catch {
          toast.error("Diário criado, mas houve erro ao salvar alguns itens (atividades/ocorrências/fotos).");
        }
        setEnviando(false);
      }
      toast.success("Diário criado com sucesso!");
      setOpen(false);
      setFormData({
        data: hojeISO(),
        clima: "",
        temperatura: "",
        umidade: "",
        observacoesGerais: "",
      });
      setAtividades([]);
      setMaoDeObra([]);
      setOcorrencias([]);
      setFotos([]);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar diário");
    },
  });

  const handleAddFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      if (file.size > 5_000_000) { toast.error(`${file.name}: máximo 5 MB`); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        setFotos(prev => [...prev, {
          base64: ev.target?.result as string,
          nome: file.name,
          mimeType: file.type,
          descricao: "",
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

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
      <DialogContent className="!max-w-[860px] w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Diário de Obra</DialogTitle>
          <DialogDescription>Preencha as informações do diário</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Informações Básicas */}
          <Card><CardContent className="pt-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><CloudSun className="w-4 h-4 text-primary" /> Informações Básicas</h3>
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="data">Data *</Label>
                <Input id="data" type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} required />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="clima">Clima</Label>
                <select id="clima" value={formData.clima} onChange={(e) => setFormData({ ...formData, clima: e.target.value })}
                  className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm">
                  <option value="ensolarado">Ensolarado</option>
                  <option value="nublado">Nublado</option>
                  <option value="chuvoso">Chuvoso</option>
                  <option value="tempestade">Tempestade</option>
                  <option value="ventania">Ventania</option>
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="temperatura">Temp. (°C)</Label>
                <Input id="temperatura" type="number" step="0.1" value={formData.temperatura} onChange={(e) => setFormData({ ...formData, temperatura: e.target.value })} placeholder="25.5" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="umidade">Umidade (%)</Label>
                <Input id="umidade" type="number" min="0" max="100" value={formData.umidade} onChange={(e) => setFormData({ ...formData, umidade: e.target.value })} placeholder="60" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacoes">Observações Gerais</Label>
              <Textarea id="observacoes" value={formData.observacoesGerais} onChange={(e) => setFormData({ ...formData, observacoesGerais: e.target.value })} placeholder="Observações gerais do dia..." className="min-h-16" />
            </div>
          </CardContent></Card>

          {/* Atividades */}
          <Card><CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Atividades Executadas</h3>
              <Button type="button" variant="outline" size="sm" className="gap-1.5"
                onClick={() => setAtividades([...atividades, { descricao: "", local: "", status: "em_andamento", percentualConcluido: "0" }])}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            {atividades.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma atividade adicionada.</p>
            ) : atividades.map((ativ, idx) => (
              <div key={idx} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atividade {idx + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAtividades(atividades.filter((_, i) => i !== idx))}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={ativ.descricao} className="min-h-16"
                    onChange={(e) => { const n = [...atividades]; n[idx].descricao = e.target.value; setAtividades(n); }}
                    placeholder="Descrição da atividade" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-xs">Local</Label>
                    <Input value={ativ.local} onChange={(e) => { const n = [...atividades]; n[idx].local = e.target.value; setAtividades(n); }} placeholder="Ex: Térreo" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label className="text-xs">Status</Label>
                    <select value={ativ.status} onChange={(e) => { const n = [...atividades]; n[idx].status = e.target.value; setAtividades(n); }}
                      className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm">
                      <option value="nao_iniciada">Não iniciada</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluida">Concluída</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">% Concl.</Label>
                    <Input type="number" min="0" max="100" value={ativ.percentualConcluido} onChange={(e) => { const n = [...atividades]; n[idx].percentualConcluido = e.target.value; setAtividades(n); }} placeholder="0" />
                  </div>
                </div>
              </div>
            ))}
          </CardContent></Card>

          {/* Mão de Obra */}
          <Card><CardContent className="pt-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Mão de Obra</h3>
            <MaoDeObraSelector value={maoDeObra} onChange={setMaoDeObra} />
          </CardContent></Card>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* Ocorrências */}
          <Card><CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Ocorrências</h3>
              <Button type="button" variant="outline" size="sm" className="gap-1.5"
                onClick={() => setOcorrencias([...ocorrencias, { tipo: "outro", descricao: "", criticidade: "baixa" }])}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>
            {ocorrencias.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma ocorrência registrada.</p>
            ) : ocorrencias.map((ocor, idx) => (
              <div key={idx} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocorrência {idx + 1}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setOcorrencias(ocorrencias.filter((_, i) => i !== idx))}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={ocor.descricao} className="min-h-16"
                    onChange={(e) => { const n = [...ocorrencias]; n[idx].descricao = e.target.value; setOcorrencias(n); }}
                    placeholder="Descrição da ocorrência" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <select value={ocor.tipo} onChange={(e) => { const n = [...ocorrencias]; n[idx].tipo = e.target.value; setOcorrencias(n); }}
                      className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm">
                      <option value="acidente">Acidente</option>
                      <option value="atraso_material">Atraso de material</option>
                      <option value="chuva">Chuva</option>
                      <option value="problema_projeto">Problema de projeto</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Criticidade</Label>
                    <select value={ocor.criticidade} onChange={(e) => { const n = [...ocorrencias]; n[idx].criticidade = e.target.value; setOcorrencias(n); }}
                      className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm">
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </CardContent></Card>

          {/* Fotos */}
          <Card><CardContent className="pt-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><ImagePlus className="w-4 h-4 text-primary" /> Fotos</h3>
            <label className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40 transition-colors text-center">
              <ImagePlus className="w-7 h-7 text-muted-foreground/50 mb-1" />
              <span className="text-sm font-medium">Clique para adicionar fotos</span>
              <span className="text-xs text-muted-foreground">Pode selecionar várias · máx. 5 MB cada</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddFotos} />
            </label>
            {fotos.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {fotos.map((f, i) => (
                  <div key={i} className="relative group border rounded-lg overflow-hidden">
                    <img src={f.base64} alt={f.nome} className="w-full h-24 object-cover" />
                    <button type="button" className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setFotos(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                    <Input placeholder="Descrição" value={f.descricao}
                      onChange={e => setFotos(prev => prev.map((x, idx) => idx === i ? { ...x, descricao: e.target.value } : x))}
                      className="text-xs border-0 rounded-none h-7" />
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
          </div>

          <div className="flex gap-3 justify-end sticky bottom-0 bg-background py-3 -mb-2 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={createMutation.isPending || enviando}>
              {createMutation.isPending || enviando ? "Criando..." : "Criar Diário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
