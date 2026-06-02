import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { fmtDataBR } from "@/lib/data";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Calendar, Download, Loader2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { exportResumoToExcel } from "@/lib/exportUtils";
import { exportResumoPDF } from "@/lib/pdfExport";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ResumosPeriodicos() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/obras/:obraId/resumos");
  const obraId = params?.obraId ? parseInt(params.obraId) : null;
  const isReadOnly = user?.role === "cliente";
  const [periodo, setPeriodo] = useState<"semanal" | "quinzenal" | "mensal">("semanal");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resumoGerado, setResumoGerado] = useState<any>(null);

  const { data: obra } = trpc.obras.getById.useQuery(
    { id: obraId! },
    { enabled: !!obraId }
  );

  const { data: diarios = [] } = trpc.diarios.listByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  // Calculate end date based on period
  const calcularDataFim = (inicio: string, tipo: "semanal" | "quinzenal" | "mensal") => {
    const date = new Date(inicio);
    if (tipo === "semanal") {
      date.setDate(date.getDate() + 7);
    } else if (tipo === "quinzenal") {
      date.setDate(date.getDate() + 15);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date.toISOString().split("T")[0];
  };

  const dataFim = useMemo(() => calcularDataFim(dataInicio, periodo), [dataInicio, periodo]);

  // Get consolidation data
  const { data: consolidacao, isLoading: isLoadingConsolidacao } = trpc.consolidacao.getPeriodo.useQuery(
    {
      obraId: obraId!,
      dataInicio,
      dataFim,
    },
    { enabled: !!obraId && !!resumoGerado }
  );

  // Get midias
  const { data: midias = [] } = trpc.consolidacao.getMidias.useQuery(
    {
      obraId: obraId!,
      dataInicio,
      dataFim,
    },
    { enabled: !!obraId && !!resumoGerado }
  );

  // Generate LLM summary
  const gerarResumoMutation = trpc.consolidacao.gerarResumoLLM.useMutation();

  const handleGerarResumo = async () => {
    if (!dataInicio) {
      toast.error("Selecione uma data");
      return;
    }

    setIsGenerating(true);
    try {
      const resultado = await gerarResumoMutation.mutateAsync({
        obraId: obraId!,
        dataInicio,
        dataFim,
        tipo: periodo,
      });

      setResumoGerado({
        resumo: resultado.resumo,
        consolidacao: resultado.consolidacao,
      });

      toast.success("Resumo gerado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar resumo:", error);
      toast.error(error.message || "Erro ao gerar resumo");
    } finally {
      setIsGenerating(false);
    }
  };

  const calcularPeriodo = () => {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (periodo === "semanal") {
      return `${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`;
    } else if (periodo === "quinzenal") {
      return `${inicio.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`;
    } else {
      return `${inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
    }
  };

  const diariosDoPeriodo = diarios.filter(d => {
    const dataD = new Date(d.data);
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    return dataD >= inicio && dataD <= fim;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/obras")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Resumos Periódicos</h1>
            <p className="text-muted-foreground mt-1">{obra?.nome || "Obra"}</p>
          </div>
        </div>

        {/* Seleção de Período */}
        <Card>
          <CardHeader>
            <CardTitle>Gerar Resumo</CardTitle>
            <CardDescription>Selecione o período e a data inicial para gerar um resumo consolidado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Período</label>
                <div className="flex gap-2">
                  {["semanal", "quinzenal", "mensal"].map((p) => (
                    <Button
                      key={p}
                      variant={periodo === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPeriodo(p as any)}
                      className="flex-1"
                    >
                      {p === "semanal" ? "Semana" : p === "quinzenal" ? "Quinzena" : "Mês"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">{calcularPeriodo()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGerarResumo}
                disabled={isGenerating || gerarResumoMutation.isPending}
                className="gap-2"
              >
                {isGenerating || gerarResumoMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Gerar Resumo
                  </>
                )}
              </Button>
              <span className="text-sm text-muted-foreground py-2">
                {diariosDoPeriodo.length} diário(s) encontrado(s)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Gerado */}
        {resumoGerado && (
          <div className="space-y-4">
            {/* Resumo Narrativo */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo Narrativo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <Streamdown>{resumoGerado.resumo}</Streamdown>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total de Diários</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{resumoGerado.consolidacao?.totalDiarios || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Atividades</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{resumoGerado.consolidacao?.totalAtividades || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ocorrências</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{resumoGerado.consolidacao?.totalOcorrencias || 0}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Fotos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{resumoGerado.consolidacao?.totalFotos || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Clima Predominante */}
            {resumoGerado.consolidacao?.climaPredominate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Clima Predominante</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold capitalize">{resumoGerado.consolidacao.climaPredominate}</p>
                </CardContent>
              </Card>
            )}

            {/* Principais Atividades */}
            {resumoGerado.consolidacao?.principaisAtividades && resumoGerado.consolidacao.principaisAtividades.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Principais Atividades Concluídas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {resumoGerado.consolidacao.principaisAtividades.map((ativ: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <span className="text-blue-600 font-bold">✓</span>
                        <span>{ativ}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Principais Ocorrências */}
            {resumoGerado.consolidacao?.principaisOcorrencias && resumoGerado.consolidacao.principaisOcorrencias.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Ocorrências de Alta Criticidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {resumoGerado.consolidacao.principaisOcorrencias.map((ocor: string, idx: number) => (
                      <li key={idx} className="flex gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span>{ocor}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Equipamentos Utilizados */}
            {resumoGerado.consolidacao?.equipamentosUtilizados && resumoGerado.consolidacao.equipamentosUtilizados.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Equipamentos Utilizados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {resumoGerado.consolidacao.equipamentosUtilizados.map((equip: string, idx: number) => (
                      <div key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {equip}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Galeria de Fotos */}
            {midias && midias.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Fotos do Período ({midias.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {midias.map((midia: any, idx: number) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={midia.url || midia.caminhoArmazenamento}
                          alt={midia.descricao || "Foto"}
                          className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botões de Ação */}
            {!isReadOnly && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    if (resumoGerado?.consolidacao) {
                      exportResumoPDF(
                        obra?.nome || "Obra",
                        periodo,
                        dataInicio,
                        dataFim,
                        resumoGerado.resumo,
                        {
                          totalDiarios: resumoGerado.consolidacao.totalDiarios,
                          totalAtividades: resumoGerado.consolidacao.totalAtividades,
                          totalOcorrencias: resumoGerado.consolidacao.totalOcorrencias,
                          totalFotos: resumoGerado.consolidacao.totalFotos,
                          maoDeObraTotal: resumoGerado.consolidacao.maoDeObraTotal,
                          climaPredominante: resumoGerado.consolidacao.climaPredominate,
                          principaisAtividades: resumoGerado.consolidacao.principaisAtividades || [],
                          principaisOcorrencias: resumoGerado.consolidacao.principaisOcorrencias || [],
                        }
                      );
                      toast.success("PDF gerado! Confirme a impressão.");
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    if (resumoGerado?.consolidacao) {
                      exportResumoToExcel(
                        obra?.nome || "Obra",
                        periodo,
                        dataInicio,
                        dataFim,
                        resumoGerado.resumo,
                        resumoGerado.consolidacao
                      );
                      toast.success("Relatório exportado com sucesso!");
                    }
                  }}
                >
                  <Download className="w-4 h-4" />
                  Exportar Excel
                </Button>
              </div>
            )}
            {isReadOnly && (
              <div className="text-sm text-muted-foreground italic">
                Modo somente leitura para clientes
              </div>
            )}
          </div>
        )}

        {/* Diários do Período */}
        {!resumoGerado && diariosDoPeriodo.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Diários do Período</CardTitle>
              <CardDescription>{diariosDoPeriodo.length} diário(s) encontrado(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {diariosDoPeriodo.map((diario) => (
                  <div key={diario.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{fmtDataBR(diario.data)}</p>
                      <p className="text-sm text-muted-foreground capitalize">{diario.clima || "Sem clima"}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/obras/${obraId}/diario/${diario.id}`)}
                    >
                      Ver
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!resumoGerado && diariosDoPeriodo.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum diário encontrado no período selecionado</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
