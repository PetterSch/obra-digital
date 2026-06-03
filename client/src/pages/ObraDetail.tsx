import { useState } from "react";
import { fmtDataBR } from "@/lib/data";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Plus, Calendar, MapPin, User, Eye, Edit, Trash2, Activity, ClipboardList, AlertTriangle, CheckCircle2, Building2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { DiarioForm } from "@/components/DiarioForm";
import EquipesColaboradores from "@/pages/Colaboradores";
import { PendenciasForm } from "@/components/PendenciasForm";
import { MateriaisForm } from "@/components/MateriaisForm";
import { MaterialesList } from "@/components/MaterialesList";
import { MovimentacaoMateriais } from "@/components/MovimentacaoMateriais";

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{obra.cliente}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Localização</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-sm">{obra.cidade}, {obra.estado}</p>
              <p className="text-xs text-muted-foreground">{obra.endereco}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Responsável</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-sm">{obra.responsavelTecnico}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                obra.status === "em_andamento" ? "bg-blue-100 text-blue-700" :
                obra.status === "finalizada" ? "bg-green-100 text-green-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                {obra.status}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Progresso */}
        <Card>
          <CardHeader>
            <CardTitle>Progresso da Obra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{obra.percentualAndamento}% concluído</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${obra.percentualAndamento}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="diarios" className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="diarios" className="flex-1">Diários ({diarios.length})</TabsTrigger>
            <TabsTrigger value="colaboradores" className="flex-1">Equipes & Colaboradores</TabsTrigger>
            <TabsTrigger value="pendencias" className="flex-1">Pendências ({pendencias.length})</TabsTrigger>
            <TabsTrigger value="materiais" className="flex-1">Materiais</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">Informações</TabsTrigger>
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
                  <Card key={diario.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{fmtDataBR(diario.data)}</p>
                            <p className="text-sm text-muted-foreground">{diario.clima || "Sem informação de clima"}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="gap-2"
                            onClick={() => navigate(`/obras/${obraId}/diario/${diario.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                            Ver
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-2"
                            onClick={() => navigate(`/obras/${obraId}/diario/${diario.id}?edit=true`)}
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-destructive hover:text-destructive"
                            onClick={() => setDiarioToDelete(diario)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Deletar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                {pendencias.map(pend => (
                  <Card key={pend.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{pend.titulo}</p>
                          <p className="text-sm text-muted-foreground">{pend.descricao}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          pend.status === "aberta" ? "bg-red-100 text-red-700" :
                          pend.status === "em_andamento" ? "bg-blue-100 text-blue-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {pend.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="materiais" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Materiais</h3>
              <MateriaisForm obraId={obra.id} onSuccess={() => refetch()} />
            </div>
            <MaterialesList obraId={obra.id} />
            <MovimentacaoMateriais obraId={obra.id} />
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Obra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Data de Início</p>
                    <p className="font-semibold">{new Date(obra.dataInicio).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Data Prevista de Término</p>
                    <p className="font-semibold">{new Date(obra.dataPrevistTermino).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CEP</p>
                    <p className="font-semibold">{obra.cep}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CREA</p>
                    <p className="font-semibold">{obra.crea || "Não informado"}</p>
                  </div>
                </div>
                {obra.descricao && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Descrição</p>
                    <p className="font-semibold">{obra.descricao}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

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
