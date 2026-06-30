import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { fmtDataBR, dataISO } from "@/lib/data";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save, X, Plus, Trash2, Upload, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/_core/hooks/useAuth";
import { MaoDeObraSelector } from "@/components/MaoDeObraSelector";
import { useEffect, useRef, useState } from "react";
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

  // ── Cabeçalho ── (inicializa uma vez por diário; não sobrescreve edições em refetch)
  const [header, setHeader] = useState({ clima: "", temperatura: "", umidade: "", observacoesGerais: "" });
  const headerInit = useRef<number | null>(null);
  useEffect(() => {
    if (diario && headerInit.current !== diarioId) {
      setHeader({
        clima: diario.clima ?? "",
        temperatura: diario.temperatura != null ? String(diario.temperatura) : "",
        umidade: diario.umidade != null ? String(diario.umidade) : "",
        observacoesGerais: diario.observacoesGerais ?? "",
      });
      headerInit.current = diarioId;
    }
  }, [diario, diarioId]);

  const updateHeader = trpc.diarios.update.useMutation({
    onSuccess: () => { utils.diarios.getById.invalidate({ id: diarioId! }); },
    onError: (e) => toast.error(e.message || "Erro ao salvar informações"),
  });

  // ── Atividades ──
  const { data: atividades = [] } = trpc.atividades.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const [novaAtiv, setNovaAtiv] = useState({ descricao: "", local: "", status: "em_andamento", percentualConcluido: "" });
  const addAtiv = trpc.atividades.create.useMutation({ onSuccess: () => { setNovaAtiv({ descricao: "", local: "", status: "em_andamento", percentualConcluido: "" }); utils.atividades.listByDiario.invalidate({ diarioId: diarioId! }); }, onError: (e) => toast.error(e.message) });
  const delAtiv = trpc.atividades.delete.useMutation({ onSuccess: () => utils.atividades.listByDiario.invalidate({ diarioId: diarioId! }) });
  const [editAtiv, setEditAtiv] = useState<any | null>(null);
  const updAtiv = trpc.atividades.update.useMutation({
    onSuccess: () => { toast.success("Atividade atualizada!"); setEditAtiv(null); utils.atividades.listByDiario.invalidate({ diarioId: diarioId! }); },
    onError: (e) => toast.error(e.message || "Erro ao atualizar atividade"),
  });

  // ── Ocorrências ──
  const { data: ocorrencias = [] } = trpc.ocorrencias.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const [novaOcor, setNovaOcor] = useState({ descricao: "", tipo: "outro", criticidade: "baixa" });
  const invalOcor = () => utils.ocorrencias.listByDiario.invalidate({ diarioId: diarioId! });
  const addOcor = trpc.ocorrencias.create.useMutation({ onSuccess: () => { setNovaOcor({ descricao: "", tipo: "outro", criticidade: "baixa" }); invalOcor(); }, onError: (e) => toast.error(e.message) });
  const delOcor = trpc.ocorrencias.delete.useMutation({ onSuccess: () => invalOcor() });
  const [editOcor, setEditOcor] = useState<any | null>(null);
  const updOcor = trpc.ocorrencias.update.useMutation({ onSuccess: () => { toast.success("Ocorrência atualizada!"); setEditOcor(null); invalOcor(); }, onError: (e) => toast.error(e.message) });

  // ── Mão de obra (presença por equipe) ──
  const { data: resumo } = trpc.presenca.resumoByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const [maoDeObra, setMaoDeObra] = useState<Array<{ equipeId: number; operariosPresentes: number[] }>>([]);
  const maoInit = useRef<number | null>(null);
  useEffect(() => {
    if (resumo && maoInit.current !== diarioId) {
      setMaoDeObra((resumo as any[]).map((g) => ({ equipeId: g.equipeId, operariosPresentes: g.operarios || [] })));
      maoInit.current = diarioId;
    }
  }, [resumo, diarioId]);
  const saveMao = trpc.presenca.setForDiario.useMutation({
    onSuccess: () => { utils.presenca.resumoByDiario.invalidate({ diarioId: diarioId! }); },
    onError: (e) => toast.error(e.message || "Erro ao salvar mão de obra"),
  });

  const salvandoTudo = updateHeader.isPending || saveMao.isPending;

  const handleSalvarTudo = async () => {
    try {
      await Promise.all([
        updateHeader.mutateAsync({ id: diarioId!, clima: (header.clima || undefined) as any, temperatura: header.temperatura || undefined, umidade: header.umidade ? parseInt(header.umidade) : undefined, observacoesGerais: header.observacoesGerais ?? "" }),
        saveMao.mutateAsync({ diarioId: diarioId!, data: dataISO(diario!.data), maoDeObra }),
      ]);
      toast.success("Diário salvo com sucesso!");
    } catch {
      // erros já tratados individualmente nos onError
    }
  };

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
            <p className="text-muted-foreground mt-1">{fmtDataBR(diario.data)}</p>
          </div>
          <Button variant="outline" onClick={verDiario} className="gap-2"><X className="w-4 h-4" /> Fechar</Button>
          <Button className="gap-2" disabled={salvandoTudo} onClick={handleSalvarTudo}>
            <Save className="w-4 h-4" /> {salvandoTudo ? "Salvando..." : "Salvar"}
          </Button>
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
            </div>
          </CardContent>
        </Card>

        {/* Seções */}
        <Tabs defaultValue="atividades" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="atividades">Atividades ({atividades.length})</TabsTrigger>
            <TabsTrigger value="mao-obra">Mão de Obra</TabsTrigger>
            <TabsTrigger value="ocorrencias">Ocorrências ({ocorrencias.length})</TabsTrigger>
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
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar atividade"
                        onClick={() => setEditAtiv({ id: a.id, descricao: a.descricao || "", local: a.local || "", status: a.status || "em_andamento", percentualConcluido: a.percentualConcluido != null ? String(a.percentualConcluido) : "" })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir atividade" onClick={() => delAtiv.mutate({ id: a.id })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
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

            <Dialog open={!!editAtiv} onOpenChange={(o) => { if (!o) setEditAtiv(null); }}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Editar atividade</DialogTitle></DialogHeader>
                {editAtiv && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Descrição *</Label>
                      <Input value={editAtiv.descricao} onChange={(e) => setEditAtiv({ ...editAtiv, descricao: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Local</Label>
                      <Input value={editAtiv.local} onChange={(e) => setEditAtiv({ ...editAtiv, local: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Status</Label>
                        <Select value={editAtiv.status} onValueChange={(v) => setEditAtiv({ ...editAtiv, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nao_iniciada">Não iniciada</SelectItem>
                            <SelectItem value="em_andamento">Em andamento</SelectItem>
                            <SelectItem value="concluida">Concluída</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">% concluído</Label>
                        <Input type="number" min={0} max={100} value={editAtiv.percentualConcluido} onChange={(e) => setEditAtiv({ ...editAtiv, percentualConcluido: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button className="flex-1 gap-1.5" disabled={!editAtiv.descricao || updAtiv.isPending}
                        onClick={() => updAtiv.mutate({ id: editAtiv.id, descricao: editAtiv.descricao, local: editAtiv.local || undefined, status: editAtiv.status as any, percentualConcluido: editAtiv.percentualConcluido !== "" ? parseInt(editAtiv.percentualConcluido) : undefined })}>
                        <Save className="w-4 h-4" /> {updAtiv.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditAtiv(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Mão de obra */}
          <TabsContent value="mao-obra" className="space-y-3 mt-4">
            <Card><CardContent className="pt-4 space-y-4">
              <MaoDeObraSelector value={maoDeObra} onChange={setMaoDeObra} />
            </CardContent></Card>
          </TabsContent>

          {/* Ocorrências */}
          <TabsContent value="ocorrencias" className="space-y-3 mt-4">
            <Card><CardContent className="pt-4 space-y-2">
              {(ocorrencias as any[]).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ocorrência. Adicione abaixo.</p> :
                (ocorrencias as any[]).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{o.descricao}</p>
                      <p className="text-xs text-muted-foreground">{(o.tipo || "").replace(/_/g, " ")} · {(o.criticidade || "").replace(/_/g, " ")}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar"
                        onClick={() => setEditOcor({ id: o.id, descricao: o.descricao || "", tipo: o.tipo || "outro", criticidade: o.criticidade || "baixa" })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => delOcor.mutate({ id: o.id })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
            </CardContent></Card>
            <Card><CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium">Adicionar ocorrência</p>
              <Input placeholder="Descrição *" value={novaOcor.descricao} onChange={(e) => setNovaOcor({ ...novaOcor, descricao: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select value={novaOcor.tipo} onValueChange={(v) => setNovaOcor({ ...novaOcor, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="atraso_material">Atraso de material</SelectItem>
                    <SelectItem value="falta_equipe">Falta de equipe</SelectItem>
                    <SelectItem value="chuva">Chuva</SelectItem>
                    <SelectItem value="problema_projeto">Problema de projeto</SelectItem>
                    <SelectItem value="acidente">Acidente</SelectItem>
                    <SelectItem value="nao_conformidade">Não conformidade</SelectItem>
                    <SelectItem value="interferencia">Interferência</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={novaOcor.criticidade} onValueChange={(v) => setNovaOcor({ ...novaOcor, criticidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="gap-1.5" disabled={!novaOcor.descricao || addOcor.isPending}
                onClick={() => addOcor.mutate({ diarioId: diarioId!, descricao: novaOcor.descricao, tipo: novaOcor.tipo as any, criticidade: novaOcor.criticidade as any })}>
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </CardContent></Card>

            <Dialog open={!!editOcor} onOpenChange={(o) => { if (!o) setEditOcor(null); }}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Editar ocorrência</DialogTitle></DialogHeader>
                {editOcor && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Descrição *</Label>
                      <Input value={editOcor.descricao} onChange={(e) => setEditOcor({ ...editOcor, descricao: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Tipo</Label>
                        <Select value={editOcor.tipo} onValueChange={(v) => setEditOcor({ ...editOcor, tipo: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atraso_material">Atraso de material</SelectItem>
                            <SelectItem value="falta_equipe">Falta de equipe</SelectItem>
                            <SelectItem value="chuva">Chuva</SelectItem>
                            <SelectItem value="problema_projeto">Problema de projeto</SelectItem>
                            <SelectItem value="acidente">Acidente</SelectItem>
                            <SelectItem value="nao_conformidade">Não conformidade</SelectItem>
                            <SelectItem value="interferencia">Interferência</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Criticidade</Label>
                        <Select value={editOcor.criticidade} onValueChange={(v) => setEditOcor({ ...editOcor, criticidade: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button className="flex-1 gap-1.5" disabled={!editOcor.descricao || updOcor.isPending}
                        onClick={() => updOcor.mutate({ id: editOcor.id, descricao: editOcor.descricao, tipo: editOcor.tipo as any, criticidade: editOcor.criticidade as any })}>
                        <Save className="w-4 h-4" /> {updOcor.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button variant="outline" onClick={() => setEditOcor(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
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
