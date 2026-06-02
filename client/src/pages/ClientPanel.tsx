import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { fmtDataBR } from "@/lib/data";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Calendar, MapPin, User, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function ClientPanel() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/client/obras/:id");
  const obraId = params?.id ? parseInt(params.id) : null;

  const { data: obra, isLoading } = trpc.obras.getById.useQuery(
    { id: obraId! },
    { enabled: !!obraId }
  );

  const { data: diarios = [] } = trpc.diarios.listByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  const { data: pendencias = [] } = trpc.pendencias.listByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/client")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Card>
            <CardContent className="pt-6 text-center py-8">
              <p className="text-muted-foreground">Obra não encontrada</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate progress based on diarios and status
  const progressPercentage = obra.status === "finalizada" ? 100 : 
    obra.status === "pausada" ? 50 : 
    obra.status === "em_andamento" ? Math.min(75, diarios.length * 5) : 0;
  const pendenciasAbertas = pendencias.filter(p => p.status === "aberta").length;
  const pendenciasResolvidas = pendencias.filter(p => p.status === "resolvida").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4">
        <Button variant="ghost" onClick={() => navigate("/client")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{obra.nome}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {obra.endereco}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Responsável: {obra.responsavelTecnico}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {new Date(obra.dataInicio).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Progresso da Obra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Conclusão</span>
                <span className="text-sm font-bold">{progressPercentage}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{diarios.length}</p>
                <p className="text-xs text-muted-foreground">Diários Registrados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{pendenciasAbertas}</p>
                <p className="text-xs text-muted-foreground">Pendências Abertas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{pendenciasResolvidas}</p>
                <p className="text-xs text-muted-foreground">Pendências Resolvidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="diarios" className="space-y-4">
          <TabsList>
            <TabsTrigger value="diarios">Diários ({diarios.length})</TabsTrigger>
            <TabsTrigger value="resumos">Resumos</TabsTrigger>
            <TabsTrigger value="pendencias">Pendências ({pendencias.length})</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
          </TabsList>

          {/* Diários Tab */}
          <TabsContent value="diarios" className="space-y-4">
            <h3 className="text-lg font-semibold">Diários de Obra</h3>
            {diarios.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhum diário registrado ainda</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {diarios.map((diario) => (
                  <Card key={diario.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold">
                            {fmtDataBR(diario.data)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {diario.clima && `Clima: ${diario.clima}`}
                            {diario.temperatura && ` | Temp: ${diario.temperatura}°C`}
                          </p>
                        </div>
                      </div>
                      {diario.observacoesGerais && (
                        <p className="text-sm text-foreground">{diario.observacoesGerais}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Resumos Tab */}
          <TabsContent value="resumos" className="space-y-4">
            <h3 className="text-lg font-semibold">Resumos Periódicos</h3>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => navigate(`/obras/${obraId}/resumos?periodo=semanal`)}
              >
                Resumo Semanal
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/obras/${obraId}/resumos?periodo=quinzenal`)}
              >
                Resumo Quinzenal
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/obras/${obraId}/resumos?periodo=mensal`)}
              >
                Resumo Mensal
              </Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Clique em um botão acima para visualizar o resumo consolidado do período selecionado com gráficos, atividades, ocorrências e fotos.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pendências Tab */}
          <TabsContent value="pendencias" className="space-y-4">
            <h3 className="text-lg font-semibold">Pendências e Não-Conformidades</h3>
            {pendencias.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhuma pendência registrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendencias.map((pend) => (
                  <Card key={pend.id} className={pend.status === "aberta" ? "border-orange-200" : ""}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {pend.status === "aberta" && (
                              <AlertCircle className="w-4 h-4 text-orange-600" />
                            )}
                            <h4 className="font-semibold">{pend.titulo}</h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              pend.prioridade === "critica" ? "bg-red-100 text-red-800" :
                              pend.prioridade === "alta" ? "bg-orange-100 text-orange-800" :
                              pend.prioridade === "media" ? "bg-yellow-100 text-yellow-800" :
                              "bg-green-100 text-green-800"
                            }`}>
                              {pend.prioridade === "critica" ? "Crítica" :
                               pend.prioridade === "alta" ? "Alta" :
                               pend.prioridade === "media" ? "Média" : "Baixa"}
                            </span>
                          </div>
                          {pend.descricao && (
                            <p className="text-sm text-muted-foreground mb-2">{pend.descricao}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Status: <strong>{
                              pend.status === "aberta" ? "Aberta" :
                              pend.status === "em_andamento" ? "Em Andamento" :
                              pend.status === "resolvida" ? "Resolvida" : "Cancelada"
                            }</strong></span>
                            {pend.dataVencimento && (
                              <span>Vencimento: {new Date(pend.dataVencimento).toLocaleDateString("pt-BR")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Informações Tab */}
          <TabsContent value="info" className="space-y-4">
            <h3 className="text-lg font-semibold">Informações da Obra</h3>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-semibold">{obra.nome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold capitalize">{obra.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço</p>
                    <p className="font-semibold">{obra.endereco}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Responsável Técnico</p>
                    <p className="font-semibold">{obra.responsavelTecnico}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Início</p>
                    <p className="font-semibold">{new Date(obra.dataInicio).toLocaleDateString("pt-BR")}</p>
                  </div>
                  {obra.dataPrevistTermino && (
                    <div>
                      <p className="text-sm text-muted-foreground">Previsão de Término</p>
                      <p className="font-semibold">{new Date(obra.dataPrevistTermino).toLocaleDateString("pt-BR")}</p>
                    </div>
                  )}
                </div>
                {obra.descricao && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Descrição</p>
                    <p className="text-sm">{obra.descricao}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
