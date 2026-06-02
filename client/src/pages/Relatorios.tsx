import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { fmtDataBR } from "@/lib/data";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, Download, Calendar, FileText, FileSpreadsheet,
  Sun, Cloud, CloudRain, Wind, Zap, BarChart3, AlertTriangle, Users, Settings2
} from "lucide-react";
import { exportDiariosToExcel } from "@/lib/exportUtils";
import { exportPeriodoPDF } from "@/lib/pdfExport";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { PDFConfigModal } from "@/components/PDFConfigModal";

const CLIMA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ensolarado: { label: "Ensolarado", icon: <Sun className="w-4 h-4" />, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  nublado: { label: "Nublado", icon: <Cloud className="w-4 h-4" />, color: "text-gray-600 bg-gray-50 border-gray-200" },
  chuvoso: { label: "Chuvoso", icon: <CloudRain className="w-4 h-4" />, color: "text-blue-600 bg-blue-50 border-blue-200" },
  tempestade: { label: "Tempestade", icon: <Zap className="w-4 h-4" />, color: "text-purple-600 bg-purple-50 border-purple-200" },
  ventania: { label: "Ventania", icon: <Wind className="w-4 h-4" />, color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
};

export default function Relatorios() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/relatorios/:obraId");
  const obraId = params?.obraId ? parseInt(params.obraId) : null;
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [exporting, setExporting] = useState(false);
  const [pdfConfigOpen, setPdfConfigOpen] = useState(false);

  const { data: obra, isLoading } = trpc.obras.getById.useQuery(
    { id: obraId! },
    { enabled: !!obraId }
  );

  const { data: diarios = [] } = trpc.diarios.listByObra.useQuery(
    { obraId: obraId! },
    { enabled: !!obraId }
  );

  // Load full data for each diario in the filtered range
  const filteredDiarios = diarios.filter(d => {
    if (!dateRange.start || !dateRange.end) return true;
    const diarioDate = new Date(d.data);
    return diarioDate >= new Date(dateRange.start) && diarioDate <= new Date(dateRange.end);
  });

  // Stats
  const totalDiarios = filteredDiarios.length;
  const climaCounts = filteredDiarios.reduce((acc, d) => {
    if (d.clima) acc[d.clima] = (acc[d.clima] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const climaPredominante = Object.entries(climaCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const handleExportExcel = async () => {
    if (filteredDiarios.length === 0) { toast.warning("Nenhum diário no período selecionado"); return; }
    setExporting(true);
    try {
      exportDiariosToExcel(obra?.nome || "Obra", filteredDiarios.map(d => ({
        id: d.id,
        data: d.data,
        clima: d.clima ?? undefined,
        temperatura: d.temperatura ? Number(d.temperatura) : undefined,
        umidade: d.umidade ?? undefined,
        horarioInicio: d.horarioInicio ?? undefined,
        horarioFim: d.horarioFim ?? undefined,
        observacoesGerais: d.observacoesGerais ?? undefined,
      })));
      toast.success("Excel exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = () => {
    if (filteredDiarios.length === 0) { toast.warning("Nenhum diário no período selecionado"); return; }
    if (!obra) { toast.error("Dados da obra não carregados"); return; }

    const dataInicioLabel = dateRange.start
      ? new Date(dateRange.start + "T12:00:00").toLocaleDateString("pt-BR")
      : fmtDataBR(filteredDiarios[filteredDiarios.length - 1].data);
    const dataFimLabel = dateRange.end
      ? new Date(dateRange.end + "T12:00:00").toLocaleDateString("pt-BR")
      : fmtDataBR(filteredDiarios[0].data);

    exportPeriodoPDF({
      obra: {
        nome: obra.nome,
        codigo: obra.codigo,
        cliente: obra.cliente,
        endereco: `${obra.endereco}, ${obra.cidade} - ${obra.estado}`,
        responsavelTecnico: obra.responsavelTecnico,
        percentualAndamento: obra.percentualAndamento,
      },
      periodo: { dataInicio: dataInicioLabel, dataFim: dataFimLabel },
      diarios: filteredDiarios.map(d => ({
        id: d.id,
        data: d.data,
        clima: d.clima ?? undefined,
        temperatura: d.temperatura ?? undefined,
        horarioInicio: d.horarioInicio ?? undefined,
        horarioFim: d.horarioFim ?? undefined,
        observacoesGerais: d.observacoesGerais ?? undefined,
      })),
      stats: {
        totalDiarios,
        climaPredominante: climaPredominante ?? null,
        climaCounts,
      },
    });
    toast.success("PDF gerado — aguarde a janela de impressão!");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen"><Spinner /></div>
      </DashboardLayout>
    );
  }

  if (!obra) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Obra não encontrada</p>
          <Button onClick={() => navigate("/obras")}>Voltar</Button>
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
            <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-muted-foreground mt-1">{obra.nome} · {obra.codigo}</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {obra.status?.replace("_", " ")}
          </Badge>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Filtrar por período
            </CardTitle>
            <CardDescription>
              Selecione o intervalo de datas para gerar relatórios. Sem filtro, todos os diários são incluídos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data inicial</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data final</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {/* Atalhos rápidos */}
              {[
                { label: "Última semana", days: 7 },
                { label: "Último mês", days: 30 },
                { label: "Últimos 3 meses", days: 90 },
              ].map(({ label, days }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - days);
                    setDateRange({
                      start: start.toISOString().split("T")[0],
                      end: end.toISOString().split("T")[0],
                    });
                  }}
                >
                  {label}
                </Button>
              ))}
              {(dateRange.start || dateRange.end) && (
                <Button variant="ghost" size="sm" onClick={() => setDateRange({ start: "", end: "" })}>
                  Limpar filtro
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleExportExcel}
                variant="outline"
                className="gap-2"
                disabled={exporting || filteredDiarios.length === 0}
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Excel
              </Button>
              <Button
                onClick={handleExportPDF}
                variant="outline"
                className="gap-2"
                disabled={filteredDiarios.length === 0}
              >
                <Download className="w-4 h-4" />
                Exportar PDF (período)
              </Button>
              <Button
                onClick={() => navigate(`/obras/${obraId}/resumos`)}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Resumo executivo com IA
              </Button>
              <Button variant="ghost" size="icon" title="Configurar PDF" onClick={() => setPdfConfigOpen(true)}>
                <Settings2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats cards */}
        {filteredDiarios.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Diários</span>
                </div>
                <p className="text-2xl font-bold">{totalDiarios}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Período</span>
                </div>
                <p className="text-sm font-medium">
                  {filteredDiarios.length > 0 && (
                    <>
                      {fmtDataBR(filteredDiarios[filteredDiarios.length - 1].data)}
                      {" → "}
                      {fmtDataBR(filteredDiarios[0].data)}
                    </>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-muted-foreground">Clima predominante</span>
                </div>
                {climaPredominante ? (
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${CLIMA_CONFIG[climaPredominante]?.color}`}>
                    {CLIMA_CONFIG[climaPredominante]?.icon}
                    {CLIMA_CONFIG[climaPredominante]?.label}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-muted-foreground">Progresso da obra</span>
                </div>
                <p className="text-2xl font-bold">{obra.percentualAndamento ?? 0}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de diários */}
        <Card>
          <CardHeader>
            <CardTitle>Diários registrados</CardTitle>
            <CardDescription>
              {filteredDiarios.length} diário(s){" "}
              {dateRange.start && dateRange.end ? "no período selecionado" : "no total"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDiarios.length === 0 ? (
              <div className="text-center py-10">
                <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum diário encontrado</p>
                {(dateRange.start || dateRange.end) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setDateRange({ start: "", end: "" })}
                  >
                    Limpar filtro
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Data</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Clima</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium">Horário</th>
                      <th className="text-left py-2 px-3 text-muted-foreground font-medium hidden md:table-cell">Observações</th>
                      <th className="py-2 px-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiarios.map((diario) => {
                      const climaConf = CLIMA_CONFIG[diario.clima ?? ""];
                      return (
                        <tr
                          key={diario.id}
                          className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                          onClick={() => navigate(`/obras/${obraId}/diario/${diario.id}`)}
                        >
                          <td className="py-2 px-3 font-medium">
                            {fmtDataBR(diario.data)}
                          </td>
                          <td className="py-2 px-3">
                            {climaConf ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${climaConf.color}`}>
                                {climaConf.icon}
                                <span className="hidden sm:inline">{climaConf.label}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-xs">
                            {diario.horarioInicio && diario.horarioFim
                              ? `${diario.horarioInicio} – ${diario.horarioFim}`
                              : "—"}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground hidden md:table-cell max-w-xs">
                            <span className="line-clamp-1">{diario.observacoesGerais || "—"}</span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className="text-xs text-blue-600 hover:underline">Ver</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <PDFConfigModal open={pdfConfigOpen} onClose={() => setPdfConfigOpen(false)} />
    </DashboardLayout>
  );
}
