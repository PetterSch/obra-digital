import { useState } from "react";
import { fmtDataBR } from "@/lib/data";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Plus, Calendar, MapPin, User, Eye, Edit, Trash2, Activity, ClipboardList, AlertTriangle, CheckCircle2, Building2, FileText, BarChart3, CalendarRange, CalendarCheck, Pencil } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { ActionPanel } from "@/components/ActionPanel";
import { ProtocolosTab } from "@/components/ProtocolosTab";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { DiarioForm } from "@/components/DiarioForm";
import EquipesColaboradores from "@/pages/Colaboradores";
import { PendenciasForm } from "@/components/PendenciasForm";
import { PedidosCompraTab } from "@/components/PedidosCompraTab";

export default function ObraDetail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/obras/:id");
  const obraId = params?.id ? parseInt(params.id) : null;
  const [diarioToDelete, setDiarioToDelete] = useState<any | null>(null);

  const { data: obra, isLoading, refetch: refetchObra } = trpc.obras.getById.useQuery(
    { id: obraId! },
    { enabled: !!obraId }
  );

  const deleteObra = trpc.obras.delete.useMutation({
    onSuccess: () => {
      toast.success("Obra deletada com sucesso");
      navigate("/obras");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar obra");
    },
  });

  const { data: diarios = [], refetch: refetchDiarios } = trpc.diarios.listByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  const { data: pendencias = [], refetch: refetchPendencias } = trpc.pendencias.listByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  const deleteDiarioMutation = trpc.diarios.delete.useMutation({
    onSuccess: () => { toast.success("Diário excluído"); setDiarioToDelete(null); refetchDiarios(); },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir diário"),
  });

  const [pendToDelete, setPendToDelete] = useState<number | null>(null);
  const [pendToEdit, setPendToEdit] = useState<any | null>(null);
  const [editPendForm, setEditPendForm] = useState({ titulo: "", descricao: "", prioridade: "media", dataVencimento: "" });

  const updatePendMut = trpc.pendencias.update.useMutation({
    onSuccess: () => { toast.success("Pendência atualizada"); setPendToEdit(null); refetchPendencias(); },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar pendência"),
  });
  const deletePendMut = trpc.pendencias.delete.useMutation({
    onSuccess: () => { toast.success("Pendência excluída"); setPendToDelete(null); refetchPendencias(); },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir pendência"),
  });

  const abrirEditPend = (pend: any) => {
    setEditPendForm({
      titulo: pend.titulo || "",
      descricao: pend.descricao || "",
      prioridade: pend.prioridade || "media",
      dataVencimento: pend.dataVencimento ? new Date(pend.dataVencimento).toISOString().split("T")[0] : "",
    });
    setPendToEdit(pend);
  };

  const refetch = () => {
    refetchObra();
    refetchDiarios();
    refetchPendencias();
  };

  if (!obra) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Spinner />
        </div>
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
      <div className="space-y-6">
        <PageHeader
          breadcrumb={[{ label: "Obras", href: "/obras" }, { label: obra.nome }]}
          title={obra.nome}
          description={obra.codigo}
          icon={Building2}
          actions={<>
            <Button variant="default" onClick={() => navigate(`/obras/${obraId}/edit`)} className="gap-2"><Edit className="w-4 h-4" /> Editar</Button>
            <Button variant="outline" onClick={() => navigate(`/obras/${obraId}/resumos`)}>Resumos Periódicos</Button>
            <Button variant="destructive" className="gap-2" onClick={() => { if (confirm("Tem certeza que deseja deletar esta obra?")) deleteObra.mutate({ id: obraId! }); }} disabled={deleteObra.isPending}>
              <Trash2 className="w-4 h-4" /> Deletar Obra
            </Button>
          </>}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Andamento da obra" value={`${obra.percentualAndamento || 0}%`} icon={Activity} tone="blue" hint="Percentual concluído" />
          <StatCard label="Diários de obra" value={diarios.length} icon={ClipboardList} tone="green" hint="Registros lançados" />
          <StatCard label="Pendências" value={pendencias.length} icon={AlertTriangle} tone={pendencias.length > 0 ? "amber" : "neutral"} hint="Itens em aberto" />
          <StatCard
            label="Status"
            value={<span className="capitalize">{(obra.status || "").replace("_", " ")}</span>}
            icon={CheckCircle2}
            tone={obra.status === "em_andamento" ? "blue" : obra.status === "finalizada" ? "green" : "amber"}
            hint="Situação atual"
          />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Cliente</p>
            <p className="font-semibold text-sm mt-1">{obra.cliente}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Localização</p>
            <p className="font-semibold text-sm mt-1">{obra.cidade}, {obra.estado}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{obra.endereco}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Responsável</p>
            <p className="font-semibold text-sm mt-1">{obra.responsavelTecnico}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">Status</p>
            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
              obra.status === "em_andamento" ? "bg-blue-100 text-blue-700" :
              obra.status === "finalizada" ? "bg-green-100 text-green-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {(obra.status || "").replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* Progresso */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Progresso da Obra</span>
            <span className="text-sm font-bold text-blue-600">{obra.percentualAndamento}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${obra.percentualAndamento}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
        <Tabs defaultValue="diarios" className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="diarios" className="flex-1">Diários ({diarios.length})</TabsTrigger>
            <TabsTrigger value="colaboradores" className="flex-1">Equipes & Colaboradores</TabsTrigger>
            <TabsTrigger value="pendencias" className="flex-1">Pendências ({pendencias.length})</TabsTrigger>
            <TabsTrigger value="materiais" className="flex-1">Pedido de Compra</TabsTrigger>
            <TabsTrigger value="protocolos" className="flex-1">Protocolos de Envio</TabsTrigger>
          </TabsList>

          <TabsContent value="diarios" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Diários de Obra</h3>
              <DiarioForm obraId={obra.id} onSuccess={() => refetchDiarios()} />
            </div>
            {diarios.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhum diário criado ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {diarios.map(diario => (
                  <div key={diario.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 min-w-0">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-tight">{fmtDataBR(diario.data)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{diario.clima || "Sem informação de clima"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => navigate(`/obras/${obraId}/diario/${diario.id}`)}>
                        <Eye className="w-4 h-4" /> Ver
                      </Button>
                      <Button variant="default" size="sm" className="gap-1.5 h-8" onClick={() => navigate(`/obras/${obraId}/diario/${diario.id}/edit`)}>
                        <Edit className="w-4 h-4" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={() => setDiarioToDelete(diario)}>
                        <Trash2 className="w-4 h-4" /> Deletar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="colaboradores" className="space-y-4">
            <EquipesColaboradores obraId={obra.id} embedded />
          </TabsContent>


          <TabsContent value="pendencias" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pendências</h3>
              <PendenciasForm obraId={obra.id} onSuccess={() => refetchPendencias()} />
            </div>
            {pendencias.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhuma pendência registrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pendencias.map((pend: any) => (
                  <Card key={pend.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{pend.titulo}</p>
                          {pend.descricao && <p className="text-xs text-muted-foreground mt-0.5">{pend.descricao}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                              pend.status === "aberta" ? "bg-red-100 text-red-700" :
                              pend.status === "em_andamento" ? "bg-blue-100 text-blue-700" :
                              pend.status === "resolvida" ? "bg-green-100 text-green-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {pend.status === "aberta" ? "Aberta" : pend.status === "em_andamento" ? "Em andamento" : pend.status === "resolvida" ? "Resolvida" : pend.status}
                            </span>
                            {pend.prioridade && <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                              pend.prioridade === "critica" ? "bg-red-100 text-red-700" :
                              pend.prioridade === "alta" ? "bg-orange-100 text-orange-700" :
                              pend.prioridade === "media" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{pend.prioridade === "critica" ? "Crítica" : pend.prioridade === "alta" ? "Alta" : pend.prioridade === "media" ? "Média" : "Baixa"}</span>}
                            {pend.dataVencimento && <span className="text-[11px] text-muted-foreground">Vence: {fmtDataBR(pend.dataVencimento)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {pend.status !== "resolvida" && (
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => updatePendMut.mutate({ id: pend.id, status: "resolvida" })}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => abrirEditPend(pend)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setPendToDelete(pend.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="materiais" className="space-y-4">
            <PedidosCompraTab obraId={obra.id} obraNome={obra.nome} />
          </TabsContent>

          <TabsContent value="protocolos" className="space-y-4">
            <ProtocolosTab obraId={obra.id} obraNome={obra.nome} />
          </TabsContent>
        </Tabs>
        <ActionPanel title="Ações & Relatórios" actions={[
          { icon: FileText, label: "Resumos periódicos", description: "Semanal, quinzenal, mensal", onClick: () => navigate(`/obras/${obraId}/resumos`) },
          { icon: BarChart3, label: "Relatório completo", description: "Diários do período", onClick: () => navigate(`/relatorios/${obraId}`) },
          { icon: CalendarRange, label: "Cronograma", description: "Linha do tempo da obra", onClick: () => navigate(`/obras/${obraId}/cronograma`) },
          { icon: CalendarCheck, label: "Calendário de Presença", description: "Presença das equipes por mês", onClick: () => navigate(`/obras/${obraId}/presenca`) },
          { icon: Edit, label: "Editar obra", description: "Dados cadastrais", onClick: () => navigate(`/obras/${obraId}/edit`) },
        ]} />
        </div>
      </div>

      {/* Editar pendência */}
      <Dialog open={!!pendToEdit} onOpenChange={(o) => { if (!o) setPendToEdit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Pendência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Título *</Label>
              <Input value={editPendForm.titulo} onChange={(e) => setEditPendForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título da pendência" />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Descrição</Label>
              <Textarea value={editPendForm.descricao} onChange={(e) => setEditPendForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva a pendência..." className="min-h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Prioridade</Label>
                <select value={editPendForm.prioridade} onChange={(e) => setEditPendForm((f) => ({ ...f, prioridade: e.target.value }))} className="w-full h-9 px-3 border border-input rounded-md bg-background text-sm">
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Vencimento</Label>
                <Input type="date" value={editPendForm.dataVencimento} onChange={(e) => setEditPendForm((f) => ({ ...f, dataVencimento: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPendToEdit(null)}>Cancelar</Button>
              <Button disabled={updatePendMut.isPending || !editPendForm.titulo.trim()}
                onClick={() => pendToEdit && updatePendMut.mutate({ id: pendToEdit.id, titulo: editPendForm.titulo, descricao: editPendForm.descricao, prioridade: editPendForm.prioridade as any, dataVencimento: editPendForm.dataVencimento || undefined })}>
                {updatePendMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir pendência */}
      <AlertDialog open={!!pendToDelete} onOpenChange={(o) => { if (!o) setPendToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pendência?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePendMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deletePendMut.isPending}
              onClick={(e) => { e.preventDefault(); if (pendToDelete) deletePendMut.mutate({ id: pendToDelete }); }}>
              {deletePendMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!diarioToDelete} onOpenChange={(o) => { if (!o) setDiarioToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir diário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o diário de{" "}
              <strong>{diarioToDelete ? fmtDataBR(diarioToDelete.data) : ""}</strong>?
              Esta ação não pode ser desfeita e removerá atividades, mão de obra, equipamentos e fotos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDiarioMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteDiarioMutation.isPending}
              onClick={(e) => { e.preventDefault(); if (diarioToDelete) deleteDiarioMutation.mutate({ id: diarioToDelete.id }); }}
            >
              {deleteDiarioMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
