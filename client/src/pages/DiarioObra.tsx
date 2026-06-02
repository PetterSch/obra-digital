import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { fmtDataBR } from "@/lib/data";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { PhotoUpload } from "@/components/PhotoUpload";

export default function DiarioObra() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/obras/:obraId/diario/:diarioId");
  const diarioId = params?.diarioId ? parseInt(params.diarioId) : null;
  const obraId = params?.obraId ? parseInt(params.obraId) : null;

  const { data: diario, isLoading } = trpc.diarios.getById.useQuery(
    { id: diarioId! },
    { enabled: !!diarioId }
  );

  const { data: atividades = [] } = trpc.atividades.listByDiario.useQuery(
    { diarioId: diarioId! },
    { enabled: !!diarioId }
  );

  const { data: maoDeObra = [] } = trpc.maoDeObra.listByDiario.useQuery(
    { diarioId: diarioId! },
    { enabled: !!diarioId }
  );

  const { data: equipamentos = [] } = trpc.equipamentos.listByDiario.useQuery(
    { diarioId: diarioId! },
    { enabled: !!diarioId }
  );

  const { data: ocorrencias = [] } = trpc.ocorrencias.listByDiario.useQuery(
    { diarioId: diarioId! },
    { enabled: !!diarioId }
  );

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/obras/${obraId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Diário de Obra</h1>
            <p className="text-muted-foreground mt-1">{fmtDataBR(diario.data)}</p>
          </div>
        </div>

        {/* Clima e Condições */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Clima</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{diario.clima || "Não informado"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Temperatura</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{diario.temperatura ? `${diario.temperatura}°C` : "Não informado"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Umidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{diario.umidade ? `${diario.umidade}%` : "Não informado"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Observações Gerais */}
        {diario.observacoesGerais && (
          <Card>
            <CardHeader>
              <CardTitle>Observações Gerais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{diario.observacoesGerais}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="atividades" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="atividades">Atividades ({atividades.length})</TabsTrigger>
            <TabsTrigger value="mao-obra">Mão de Obra ({maoDeObra.length})</TabsTrigger>
            <TabsTrigger value="equipamentos">Equipamentos ({equipamentos.length})</TabsTrigger>
            <TabsTrigger value="ocorrencias">Ocorrências ({ocorrencias.length})</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Atividades Executadas</h3>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
            {atividades.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhuma atividade registrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {atividades.map(ativ => (
                  <Card key={ativ.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{ativ.descricao}</p>
                          {ativ.local && <p className="text-sm text-muted-foreground">Local: {ativ.local}</p>}
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{ativ.status}</span>
                            {ativ.percentualConcluido && <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">{ativ.percentualConcluido}%</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mao-obra" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Mão de Obra</h3>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
            {maoDeObra.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhum registro de mão de obra</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {maoDeObra.map(mao => (
                  <Card key={mao.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{mao.funcao}</p>
                          <p className="text-sm text-muted-foreground">Quantidade: {mao.quantidade}</p>
                        </div>
                        <div className="text-right text-sm">
                          {mao.horasTrabalhadas && <p>Horas: {mao.horasTrabalhadas}</p>}
                          {mao.faltas && <p className="text-red-600">Faltas: {mao.faltas}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="equipamentos" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Equipamentos</h3>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
            {equipamentos.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhum equipamento registrado</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {equipamentos.map(equip => (
                  <Card key={equip.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{equip.nome}</p>
                          <p className="text-sm text-muted-foreground">Quantidade: {equip.quantidade}</p>
                        </div>
                        {equip.horasUso && <p className="text-sm">Horas: {equip.horasUso}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ocorrencias" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Ocorrências</h3>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
            {ocorrencias.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-muted-foreground">Nenhuma ocorrência registrada</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {ocorrencias.map(ocor => (
                  <Card key={ocor.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{ocor.tipo}</p>
                          <p className="text-sm">{ocor.descricao}</p>
                          <div className="flex gap-2 mt-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              ocor.criticidade === "critica" ? "bg-red-100 text-red-700" :
                              ocor.criticidade === "alta" ? "bg-orange-100 text-orange-700" :
                              "bg-yellow-100 text-yellow-700"
                            }`}>
                              {ocor.criticidade}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{ocor.status}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="fotos" className="space-y-4">
            {obraId && diarioId && <PhotoUpload diarioId={diarioId} obraId={obraId} />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
