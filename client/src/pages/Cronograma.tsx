import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Calendar } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useMemo } from "react";

export default function Cronograma() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/obras/:obraId/cronograma");
  const obraId = params?.obraId ? parseInt(params.obraId) : null;

  const { data: obra, isLoading } = trpc.obras.getById.useQuery(
    { id: obraId! },
    { enabled: !!obraId }
  );

  const { data: diarios = [] } = trpc.diarios.listByObra.useQuery(
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
        <div className="max-w-6xl mx-auto">
          <Button variant="ghost" onClick={() => navigate("/obras")} className="mb-4">
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

  // Calculate timeline data
  const timelineData = useMemo(() => {
    const dataInicio = new Date(obra.dataInicio);
    const dataFim = new Date(obra.dataPrevistTermino);
    const totalDays = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24));

    return {
      startDate: dataInicio,
      endDate: dataFim,
      totalDays,
      progress: obra.percentualAndamento || 0,
    };
  }, [obra]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const calculateDaysElapsed = () => {
    const today = new Date();
    const start = new Date(obra.dataInicio);
    const elapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, elapsed);
  };

  const daysElapsed = calculateDaysElapsed();
  const percentageElapsed = Math.min(100, (daysElapsed / timelineData.totalDays) * 100);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4">
        <Button variant="ghost" onClick={() => navigate(`/obras/${obraId}`)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Cronograma - {obra.nome}</h1>
          <p className="text-muted-foreground">Visualize o progresso da obra e o cronograma planejado</p>
        </div>

        {/* Timeline Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Linha do Tempo</CardTitle>
            <CardDescription>Período planejado e progresso atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data de Início</p>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(timelineData.startDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data Prevista de Término</p>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(timelineData.endDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duração Total</p>
                <p className="text-lg font-semibold">{timelineData.totalDays} dias</p>
              </div>
            </div>

            {/* Timeline Bar */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Tempo Decorrido</span>
                  <span className="text-sm font-bold">{daysElapsed} dias ({percentageElapsed.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${percentageElapsed}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progresso da Obra</span>
                  <span className="text-sm font-bold">{obra.percentualAndamento || 0}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all"
                    style={{ width: `${obra.percentualAndamento || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">Status da Obra</p>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    obra.status === "finalizada"
                      ? "bg-green-500"
                      : obra.status === "em_andamento"
                      ? "bg-blue-500"
                      : obra.status === "pausada"
                      ? "bg-yellow-500"
                      : "bg-gray-500"
                  }`}
                />
                <span className="font-semibold capitalize">
                  {obra.status === "em_andamento"
                    ? "Em Andamento"
                    : obra.status === "planejamento"
                    ? "Planejamento"
                    : obra.status === "pausada"
                    ? "Pausada"
                    : "Finalizada"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Diarios Timeline */}
        {diarios.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Linha do Tempo de Diários</CardTitle>
              <CardDescription>{diarios.length} diários registrados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diarios.slice(0, 15).map((diario: any, index: number) => (
                  <div key={diario.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      {index < diarios.length - 1 && (
                        <div className="w-0.5 h-12 bg-muted my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium">{formatDate(new Date(diario.data))}</p>
                      <p className="text-sm text-muted-foreground">
                        {diario.clima && `Clima: ${diario.clima}`}
                        {diario.temperatura && ` | Temp: ${diario.temperatura}°C`}
                      </p>
                      {diario.observacoesGerais && (
                        <p className="text-sm mt-2 line-clamp-2">{diario.observacoesGerais}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {diarios.length > 15 && (
                <p className="text-sm text-muted-foreground pt-4">
                  +{diarios.length - 15} diários não exibidos
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
