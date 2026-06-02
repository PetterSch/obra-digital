import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save, X, Plus, Trash2, Upload } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/_core/hooks/useAuth";
import { MaoDeObraSelector } from "@/components/MaoDeObraSelector";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function DiarioEdit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/obras/:obraId/diario/:diarioId/edit");
  const diarioId = params?.diarioId ? parseInt(params.diarioId) : null;
  const obraId = params?.obraId ? parseInt(params.obraId) : null;
  const utils = trpc.useUtils();

  const { data: diario, isLoading } = trpc.diarios.getById.useQuery({ id: diarioId! }, { enabled: !!diarioId });
  const { data: acessos = [] } = trpc.acessoObra.getByObra.useQuery({ obraId: obraId! }, { enabled: !!obraId });
  const acesso = acessos.find((a) => a.usuarioId === user?.id);
  const canEdit =
    user?.role === "admin" || user?.role === "engenheiro" || user?.role === "auxiliar" ||
    acesso?.permissao === "editar" || acesso?.permissao === "admin";

  // ── Cabeçalho ──
  const [header, setHeader] = useState({ clima: "", temperatura: "", umidade: "", observacoesGerais: "" });
  useEffect(() => {
    if (diario) setHeader({
      clima: diario.clima ?? "",
      temperatura: diario.temperatura != null ? String(diario.temperatura) : "",
      umidade: diario.umidade != null ? String(diario.umidade) : "",
      observacoesGerais: diario.observacoesGerais ?? "",
    });
  }, [diario]);

  const updateHeader = trpc.diarios.update.useMutation({
    onSuccess: () => { toast.success("Informações salvas!"); utils.diarios.getById.invalidate({ id: diarioId! }); },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  // ── Atividades ──
  const { data: atividades = [] } = trpc.atividades.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const [novaAtiv, setNovaAtiv] = useState({ descricao: "", local: "", status: "em_andamento", percentualConcluido: "" });
  const addAtiv = trpc.atividades.create.useMutation({ onSuccess: () => { setNovaAtiv({ descricao: "", local: "", status: "em_andamento", percentualConcluido: "" }); utils.atividades.listByDiario.invalidate({ diarioId: diarioId! }); }, onError: (e) => toast.error(e.message) });
  const delAtiv = trpc.atividades.delete.useMutation({ onSuccess: () => utils.atividades.listByDiario.invalidate({ diarioId: diarioId! }) });

  // ── Equipamentos ──
  const { data: equipamentos = [] } = trpc.equipamentos.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const [novoEquip, setNovoEquip] = useState({ nome: "", quantidade: "1", horasUso: "", observacoes: "" });
  const addEquip = trpc.equipamentos.create.useMutation({ onSuccess: () => { setNovoEquip({ nome: "", quantidade: "1", horasUso: "", observacoes: "" }); utils.equipamentos.listByDiario.invalidate({ diarioId: diarioId! }); }, onError: (e) => toast.error(e.message) });
  const delEquip = trpc.equipamentos.delete.useMutation({ onSuccess: () => utils.equipamentos.listByDiario.invalidate({ diarioId: diarioId! }) });

  // ── Mão de obra (presença por equipe) ──
  const { data: resumo = [] } = trpc.presenca.resumoByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const [maoDeObra, setMaoDeObra] = useState<Array<{ equipeId: number; operariosPresentes: number[] }>>([]);
  useEffect(() => {
    setMaoDeObra((resumo as any[]).map((g) => ({ equipeId: g.equipeId, operariosPresentes: g.operarios || [] })));
  }, [resumo]);
  const saveMao = trpc.presenca.setForDiario.useMutation({
    onSuccess: () => { toast.success("Mão de obra salva!"); utils.presenca.resumoByDiario.invalidate({ diarioId: diarioId! }); },
    onError: (e) => toast.error(e.message || "Erro ao salvar mão de obra"),
  });

  // ── Fotos ──
  const { data: fotos = [] } = trpc.midia.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const uploadFoto = trpc.midia.upload.useMutation({ onSuccess: () => utils.midia.listByDiario.invalidate({ diarioId: diarioId! }), onError: (e) => toast.error(e.message) });
  const delFoto = trpc.midia.delete.useMutation({ onSuccess: () => utils.midia.listByDiario.invalidate({ diarioId: diarioId! }) });
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const handleAddFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      if (file.size > 5_000_000) { toast.error(`${file.name}: máximo 5 MB`); return; }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        setEnviandoFoto(true);
        try {
          await uploadFoto.mutateAsync({
            diarioId: diarioId!, obraId: obraId ?? undefined, tipo: "foto",
            arquivo: ev.target?.result as string, nomeOriginal: file.name, mimeType: file.type,
          });
        } finally { setEnviandoFoto(false); }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  if (isLoading) return <DashboardLayout><div className="flex items-center justify-center min-h-screen"><Spinner /></div></DashboardLayout>;
  if (!diario) return <DashboardLayout><div className="text-center py-12"><p className="text-muted-foreground mb-4">Diário não encontrado</p><Button onClick={() => navigate(`/obras/${obraId}`)}>Voltar</Button></div></DashboardLayout>;
  if (!canEdit) return <DashboardLayout><div className="text-center py-12"><p className="text-muted-foreground mb-4">Você não tem permissão para editar este diário</p><Button onClick={() => navigate(`/obras/${obraId}/diario/${diarioId}`)}>Ver Diário</Button></div></DashboardLayout>;

  const verDiario = () => navigate(`/obras/${obraId}/diario/${diarioId}`);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={verDiario}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Editar Diário de Obra</h1>
            <p className="text-muted-foreground mt-1">{new Date(diario.data).toLocaleDateString("pt-BR")}</p>
          </div>
          <Button variant="outline" onClick={verDiario} className="gap-2"><X className="w-4 h-4" /> Fechar</Button>
        </div>

        {/* Cabeçalho */}
        <Card>
          <CardHeader><CardTitle>Informações do Diário</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Clima</Label>
                  <Select value={header.clima} onValueChange={(v) => setHeader({ ...header, clima: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {["ensolarado", "nublado", "chuvoso", "tempestade", "ventania"].map((c) => <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Temperatura (°C)</Label><Input type="number" value={header.temperatura} onChange={(e) => setHeader({ ...header, temperatura: e.target.value })} placeholder="Ex: 25" /></div>
                <div className="space-y-2"><Label>Umidade (%)</Label><Input type="number" value={header.umidade} onChange={(e) => setHeader({ ...header, umidade: e.target.value })} placeholder="Ex: 60" /></div>
              </div>
              <div className="space-y-2">
                <Label>Observações Gerais</Label>
                <textarea value={header.observacoesGerais} onChange={(e) => setHeader({ ...header, observacoesGerais: e.target.value })} rows={4} className="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="Descreva as observações gerais do dia..." />
              </div>
              <Button className="gap-2" disabled={updateHeader.isPending}
                onClick={() => updateHeader.mutate({ id: diarioId!, clima: (header.clima || undefined) as any, temperatura: header.temperatura || undefined, umidade: header.umidade ? parseInt(header.umidade) : undefined, observacoesGerais: header.observacoesGerais || undefined })}>
                <Save className="w-4 h-4" /> {updateHeader.isPending ? "Salvando..." : "Salvar informações"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seções */}
        <Tabs defaultValue="atividades" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="atividades">Atividades ({atividades.length})</TabsTrigger>
            <TabsTrigger value="mao-obra">Mão de Obra</TabsTrigger>
            <TabsTrigger value="equipamentos">Equipamentos ({equipamentos.length})</TabsTrigger>
            <TabsTrigger value="fotos">Fotos ({fotos.length})</TabsTrigger>
          </TabsList>

          {/* Atividades */}
          <TabsContent value="atividades" className="space-y-3 mt-4">
            <Card><CardContent className="pt-4 space-y-2">
              {atividades.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma atividade. Adicione abaixo.</p> :
                atividades.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{a.descricao}</p>
                      <p className="text-xs text-muted-foreground">{a.local ? `📍 ${a.local} · ` : ""}{(a.status || "").replace(/_/g, " ")} · {a.percentualConcluido ?? 0}%</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delAtiv.mutate({ id: a.id })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
            </CardContent></Card>
            <Card><CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Adicionar atividade</p>
              <Input placeholder="Descrição *" value={novaAtiv.descricao} onChange={(e) => setNovaAtiv({ ...novaAtiv, descricao: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="Local" value={novaAtiv.local} onChange={(e) => setNovaAtiv({ ...novaAtiv, local: e.target.value })} />
                <Select value={novaAtiv.status} onValueChange={(v) => setNovaAtiv({ ...novaAtiv, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_iniciada">Não iniciada</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="% concluído" value={novaAtiv.percentualConcluido} onChange={(e) => setNovaAtiv({ ...novaAtiv, percentualConcluido: e.target.value })} />
              </div>
              <Button size="sm" className="gap-1.5" disabled={!novaAtiv.descricao || addAtiv.isPending}
                onClick={() => addAtiv.mutate({ diarioId: diarioId!, descricao: novaAtiv.descricao, local: novaAtiv.local || undefined, status: novaAtiv.status as any, percentualConcluido: novaAtiv.percentualConcluido ? parseInt(novaAtiv.percentualConcluido) : undefined })}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </CardContent></Card>
          </TabsContent>

          {/* Mão de obra */}
          <TabsContent value="mao-obra" className="space-y-3 mt-4">
            <Card><CardContent className="pt-4 space-y-4">
              <MaoDeObraSelector value={maoDeObra} onChange={setMaoDeObra} />
              <Button className="gap-2" disabled={saveMao.isPending}
                onClick={() => saveMao.mutate({ diarioId: diarioId!, data: new Date(diario.data).toISOString().split("T")[0], maoDeObra })}>
                <Save className="w-4 h-4" /> {saveMao.isPending ? "Salvando..." : "Salvar mão de obra"}
              </Button>
            </CardContent></Card>
          </TabsContent>

          {/* Equipamentos */}
          <TabsContent value="equipamentos" className="space-y-3 mt-4">
            <Card><CardContent className="pt-4 space-y-2">
              {equipamentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum equipamento. Adicione abaixo.</p> :
                equipamentos.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{e.nome}</p>
                      <p className="text-xs text-muted-foreground">Qtd: {e.quantidade}{e.horasUso ? ` · ${e.horasUso}h de uso` : ""}{e.observacoes ? ` · ${e.observacoes}` : ""}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delEquip.mutate({ id: e.id })}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
            </CardContent></Card>
            <Card><CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Adicionar equipamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Nome *" value={novoEquip.nome} onChange={(e) => setNovoEquip({ ...novoEquip, nome: e.target.value })} />
                <Input type="number" placeholder="Quantidade" value={novoEquip.quantidade} onChange={(e) => setNovoEquip({ ...novoEquip, quantidade: e.target.value })} />
                <Input placeholder="Horas de uso" value={novoEquip.horasUso} onChange={(e) => setNovoEquip({ ...novoEquip, horasUso: e.target.value })} />
                <Input placeholder="Observações" value={novoEquip.observacoes} onChange={(e) => setNovoEquip({ ...novoEquip, observacoes: e.target.value })} />
              </div>
              <Button size="sm" className="gap-1.5" disabled={!novoEquip.nome || addEquip.isPending}
                onClick={() => addEquip.mutate({ diarioId: diarioId!, nome: novoEquip.nome, quantidade: parseInt(novoEquip.quantidade) || 1, horasUso: novoEquip.horasUso || undefined, observacoes: novoEquip.observacoes || undefined })}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </CardContent></Card>
          </TabsContent>

          {/* Fotos */}
          <TabsContent value="fotos" className="space-y-3 mt-4">
            <Card><CardContent className="pt-4 space-y-3">
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-xl py-6 cursor-pointer hover:bg-muted/40">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{enviandoFoto ? "Enviando..." : "Clique para adicionar fotos"}</span>
                <span className="text-xs text-muted-foreground">Máximo 5 MB por foto</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddFotos} disabled={enviandoFoto} />
              </label>
              {fotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(fotos as any[]).map((f) => (
                    <div key={f.id} className="relative group rounded-lg overflow-hidden border">
                      <img src={f.caminhoArmazenamento} alt={f.nomeOriginal || "foto"} className="w-full h-28 object-cover" />
                      <Button variant="destructive" size="icon" className="h-7 w-7 absolute top-1 right-1 opacity-80" onClick={() => delFoto.mutate({ id: f.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
