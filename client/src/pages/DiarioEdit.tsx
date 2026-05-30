import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Save, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

import { useAuth } from "@/_core/hooks/useAuth";


export default function DiarioEdit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/obras/:obraId/diario/:diarioId/edit");
  const diarioId = params?.diarioId ? parseInt(params.diarioId) : null;
  const obraId = params?.obraId ? parseInt(params.obraId) : null;

  const { data: diario, isLoading } = trpc.diarios.getById.useQuery(
    { id: diarioId! },
    { enabled: !!diarioId }
  );

  const { data: acessos = [] } = trpc.acessoObra.getByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  const acesso = acessos.find(a => a.usuarioId === user?.id);

  // Admin e engenheiro podem editar; demais precisam de acesso "editar"/"admin" na obra
  const canEdit =
    user?.role === "admin" ||
    user?.role === "engenheiro" ||
    user?.role === "auxiliar" ||
    acesso?.permissao === "editar" ||
    acesso?.permissao === "admin";

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Spinner />
        </div>
      </DashboardLayout>
    );
  }

  if (!diario) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Diário não encontrado</p>
          <Button onClick={() => navigate(`/obras/${obraId}`)}>Voltar</Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!canEdit) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Você não tem permissão para editar este diário</p>
          <Button onClick={() => navigate(`/obras/${obraId}/diario/${diarioId}`)}>Ver Diário</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/obras/${obraId}/diario/${diarioId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Editar Diário de Obra</h1>
            <p className="text-muted-foreground mt-1">{new Date(diario.data).toLocaleDateString("pt-BR")}</p>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate(`/obras/${obraId}/diario/${diarioId}`)}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
        </div>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Diário</CardTitle>
            <CardDescription>Edite os dados do diário de obra</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Clima</label>
                  <input
                    type="text"
                    defaultValue={diario.clima || ""}
                    placeholder="Ex: Ensolarado, Nublado, Chuva"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Temperatura (°C)</label>
                  <input
                    type="number"
                    defaultValue={diario.temperatura || ""}
                    placeholder="Ex: 25"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Umidade (%)</label>
                  <input
                    type="number"
                    defaultValue={diario.umidade || ""}
                    placeholder="Ex: 60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Observações Gerais</label>
                <textarea
                  defaultValue={diario.observacoesGerais || ""}
                  placeholder="Descreva as observações gerais do dia..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex gap-2">
                <Button className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </Button>
                <Button variant="outline">
                  Descartar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Sections */}
        <Tabs defaultValue="atividades" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="mao-obra">Mão de Obra</TabsTrigger>
            <TabsTrigger value="equipamentos">Equipamentos</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Atividades Executadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Edição de atividades em desenvolvimento</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mao-obra" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mão de Obra</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Edição de mão de obra em desenvolvimento</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipamentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Equipamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Edição de equipamentos em desenvolvimento</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fotos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Fotos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Upload de fotos em desenvolvimento</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
