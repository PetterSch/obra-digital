import DashboardLayout from "@/components/DashboardLayout";
import { funcaoLabel } from "@/lib/funcoes";
import { fmtHoraBR, dataISO, fmtDataBR } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Edit, FileDown, Trash2, Sun, Cloud, CloudRain, Wind, Zap, Thermometer, Droplets, Clock, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/_core/hooks/useAuth";
import { exportDiarioPDF } from "@/lib/pdfExport";
import { PDFConfigModal } from "@/components/PDFConfigModal";
import { PhotoUpload } from "@/components/PhotoUpload";
import { useState } from "react";

const CLIMA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ensolarado: { label: "Ensolarado", icon: <Sun className="w-5 h-5" />, color: "text-yellow-600 bg-yellow-50" },
  nublado: { label: "Nublado", icon: <Cloud className="w-5 h-5" />, color: "text-gray-600 bg-gray-50" },
  chuvoso: { label: "Chuvoso", icon: <CloudRain className="w-5 h-5" />, color: "text-blue-600 bg-blue-50" },
  tempestade: { label: "Tempestade", icon: <Zap className="w-5 h-5" />, color: "text-purple-600 bg-purple-50" },
  ventania: { label: "Ventania", icon: <Wind className="w-5 h-5" />, color: "text-cyan-600 bg-cyan-50" },
};

const STATUS_COLORS: Record<string, string> = {
  concluida: "bg-green-100 text-green-700 border-green-200",
  em_andamento: "bg-blue-100 text-blue-700 border-blue-200",
  nao_iniciada: "bg-gray-100 text-gray-600 border-gray-200",
};

const CRITICIDADE_COLORS: Record<string, string> = {
  critica: "bg-red-100 text-red-700 border-red-200",
  alta: "bg-orange-100 text-orange-700 border-orange-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-green-100 text-green-700 border-green-200",
};

// Parse robusto de data: extrai a parte YYYY-MM-DD e fixa meio-dia local
// (evita deslocamento de fuso horário que muda o dia)
function parseData(val: any): Date {
  let s: string;
  if (val instanceof Date) {
    s = val.toISOString().split("T")[0];
  } else {
    s = String(val ?? "").split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + "T12:00:00");
  return new Date(String(val));
}

export default function DiarioView() {
  const { user } = useAuth();
  const [pdfConfigOpen, setPdfConfigOpen] = useState(false);
  const [, navigate] = useLocation();
  const [, params] = useRoute("/obras/:obraId/diario/:diarioId");
  const diarioId = params?.diarioId ? parseInt(params.diarioId) : null;
  const obraId = params?.obraId ? parseInt(params.obraId) : null;

  const { data: diario, isLoading } = trpc.diarios.getById.useQuery(
    { id: diarioId! },
    { enabled: !!diarioId }
  );
  const { data: obra } = trpc.obras.getById.useQuery({ id: obraId! }, { enabled: !!obraId });

  // Navegação entre diários da obra (ordenados por data)
  const { data: diariosObra = [] } = trpc.diarios.listByObra.useQuery({ obraId: obraId! }, { enabled: !!obraId });
  const ordenados = [...(diariosObra as any[])].sort((a, b) => dataISO(a.data).localeCompare(dataISO(b.data)));
  const idxAtual = ordenados.findIndex((d) => d.id === diarioId);
  const diarioAnterior = idxAtual > 0 ? ordenados[idxAtual - 1] : null;
  const diarioProximo = idxAtual >= 0 && idxAtual < ordenados.length - 1 ? ordenados[idxAtual + 1] : null;

  const deleteMutation = trpc.diarios.delete.useMutation({
    onSuccess: () => { toast.success("Diário deletado com sucesso"); navigate(`/obras/${obraId}`); },
    onError: (error) => toast.error(error.message || "Erro ao deletar diário"),
  });

  const { data: atividades = [] } = trpc.atividades.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const { data: maoDeObra = [] } = trpc.maoDeObra.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const { data: maoObraResumo = [] } = trpc.presenca.resumoByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });
  const { data: ocorrencias = [] } = trpc.ocorrencias.listByDiario.useQuery({ diarioId: diarioId! }, { enabled: !!diarioId });

  const handleExportPDF = () => {
    if (!diario || !obra) { toast.error("Dados ainda carregando"); return; }
    exportDiarioPDF({
      obra: {
        nome: obra.nome,
        codigo: obra.codigo,
        cliente: obra.cliente,
        endereco: `${obra.endereco}, ${obra.cidade} - ${obra.estado}`,
        responsavelTecnico: obra.responsavelTecnico,
      },
      diario: {
        id: diario.id,
        data: parseData(diario.data).toISOString().split("T")[0],
        horarioInicio: diario.horarioInicio ?? undefined,
        horarioFim: diario.horarioFim ?? undefined,
        criadoEm: (diario as any).criadoEm ?? undefined,
        clima: diario.clima ?? undefined,
        temperatura: diario.temperatura ?? undefined,
        umidade: diario.umidade ?? undefined,
        observacoesGerais: diario.observacoesGerais ?? undefined,
      },
      atividades: atividades.map((a) => ({
        descricao: a.descricao,
        local: a.local ?? undefined,
        status: a.status ?? undefined,
        percentualConcluido: a.percentualConcluido ?? undefined,
        prioridade: a.prioridade ?? undefined,
      })),
      maoDeObra: (maoObraResumo as any[]).map((g) => ({
        equipeNome: g.equipeNome,
        empresa: g.empresa,
        presentes: g.presentes,
        funcoes: Object.entries(g.funcoes || {}).map(([f, n]) => `${funcaoLabel(f)} (${n})`).join(", "),
      })),
      ocorrencias: ocorrencias.map((o) => ({
        descricao: o.descricao,
        tipo: o.tipo ?? undefined,
        criticidade: o.criticidade ?? undefined,
        responsavel: o.responsavel ?? undefined,
      })),
    });
    toast.success("PDF gerado! Confirme a impressão na janela que abriu.");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
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

  const climaConfig = diario.clima ? CLIMA_CONFIG[diario.clima] : null;
  const dataObj = parseData(diario.data);
  const dataFormatada = isNaN(dataObj.getTime())
    ? "Data não informada"
    : dataObj.toLocaleDateString("pt-BR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl">
        <PageHeader
          breadcrumb={[{ label: "Obras", href: "/obras" }, { label: obra?.nome || "Obra", href: `/obras/${obraId}` }, { label: `Diário ${fmtDataBR(diario?.data)}` }]}
          title="Diário de Obra"
          description={dataFormatada}
          icon={ClipboardList}
          actions={<>
            <Button variant="outline" className="gap-1" disabled={!diarioAnterior}
              title={diarioAnterior ? `Diário de ${fmtDataBR(diarioAnterior.data)}` : "Não há diário anterior"}
              onClick={() => diarioAnterior && navigate(`/obras/${obraId}/diario/${diarioAnterior.id}`)}>
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <Button variant="outline" className="gap-1" disabled={!diarioProximo}
              title={diarioProximo ? `Diário de ${fmtDataBR(diarioProximo.data)}` : "Não há próximo diário"}
              onClick={() => diarioProximo && navigate(`/obras/${obraId}/diario/${diarioProximo.id}`)}>
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {user?.role !== "cliente" && (
              <>
                <Button variant="default" className="gap-2" onClick={() => navigate(`/obras/${obraId}/diario/${diarioId}/edit`)}>
                  <Edit className="w-4 h-4" />
                  <span className="hidden sm:inline">Editar</span>
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button variant="ghost" size="icon" title="Configurar PDF" onClick={() => setPdfConfigOpen(true)}>
                  <Settings2 className="w-4 h-4" />
                </Button>
                <Button variant="destructive" className="gap-2" onClick={() => { if (confirm("Deletar este diário?")) deleteMutation.mutate({ id: diarioId! }); }} disabled={deleteMutation.isPending}>
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Deletar</span>
                </Button>
              </>
            )}
          </>}
        />

        {/* Horário + Clima */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="w-4 h-4" /> Horário
              </div>
              {diario.horarioInicio
                ? <p className="font-semibold">{diario.horarioInicio} às {diario.horarioFim ?? "—"}</p>
                : <p className="font-semibold">Registrado às {fmtHoraBR((diario as any).criadoEm)}</p>}
            </CardContent>
          </Card>

          <Card className={`col-span-2 sm:col-span-1 ${climaConfig ? "" : ""}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                Clima
              </div>
              {climaConfig ? (
                <div className={`flex items-center gap-2 font-semibold ${climaConfig.color} rounded-md px-2 py-1 w-fit`}>
                  {climaConfig.icon}
                  {climaConfig.label}
                </div>
              ) : (
                <p className="font-semibold text-muted-foreground">Não informado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Thermometer className="w-4 h-4" /> Temperatura
              </div>
              <p className="font-semibold">{diario.temperatura ? `${diario.temperatura}°C` : "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Droplets className="w-4 h-4" /> Umidade
              </div>
              <p className="font-semibold">{diario.umidade ? `${diario.umidade}%` : "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Observações */}
        {diario.observacoesGerais && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Observações Gerais</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{diario.observacoesGerais}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="atividades" className="w-full">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="atividades" className="flex-1 text-xs sm:text-sm">Atividades {atividades.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{atividades.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="mao-obra" className="flex-1 text-xs sm:text-sm">Mão de Obra {maoObraResumo.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{maoObraResumo.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="ocorrencias" className="flex-1 text-xs sm:text-sm">Ocorrências {ocorrencias.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{ocorrencias.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="fotos" className="flex-1 text-xs sm:text-sm">Fotos</TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="space-y-2 mt-4">
            {atividades.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma atividade registrada</CardContent></Card>
            ) : atividades.map((ativ) => (
              <div key={ativ.id} className="rounded-xl border bg-card px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-tight">{ativ.descricao}</p>
                    {ativ.local && <p className="text-xs text-muted-foreground mt-0.5">📍 {ativ.local}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {ativ.status && (
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[ativ.status] ?? ""}`}>
                        {ativ.status.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {ativ.percentualConcluido != null && (
                      <Badge variant="outline" className="text-xs bg-muted/50">{ativ.percentualConcluido}%</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="mao-obra" className="space-y-3 mt-4">
            {maoObraResumo.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma equipe/presença registrada neste diário</CardContent></Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Equipe</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Empresa</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Funções</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">Presentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(maoObraResumo as any[]).map((g) => (
                      <tr key={g.equipeId} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{g.equipeNome}</td>
                        <td className="py-2 px-3 text-muted-foreground">{g.empresa ?? "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">{Object.entries(g.funcoes || {}).map(([f, n]) => `${funcaoLabel(f)} (${n})`).join(", ") || "—"}</td>
                        <td className="py-2 px-3 text-center font-semibold">{g.presentes}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/20">
                      <td colSpan={3} className="py-2 px-3 text-right font-semibold">Total de presentes</td>
                      <td className="py-2 px-3 text-center font-bold text-primary">{(maoObraResumo as any[]).reduce((s, g) => s + (g.presentes || 0), 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ocorrencias" className="space-y-3 mt-4">
            {ocorrencias.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma ocorrência registrada</CardContent></Card>
            ) : ocorrencias.map((ocor) => (
              <Card key={ocor.id} className={`border-l-4 ${ocor.criticidade === "critica" || ocor.criticidade === "alta" ? "border-l-red-400" : ocor.criticidade === "media" ? "border-l-yellow-400" : "border-l-gray-300"}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{ocor.tipo ?? "Ocorrência"}</p>
                      <p className="text-sm mt-1">{ocor.descricao}</p>
                      {ocor.responsavel && <p className="text-xs text-muted-foreground mt-1">Responsável: {ocor.responsavel}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {ocor.criticidade && (
                        <Badge variant="outline" className={CRITICIDADE_COLORS[ocor.criticidade] ?? ""}>
                          {ocor.criticidade}
                        </Badge>
                      )}
                      {ocor.status && (
                        <Badge variant="outline">{ocor.status.replace(/_/g, " ")}</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="fotos" className="mt-4">
            {obraId && diarioId && <PhotoUpload diarioId={diarioId} obraId={obraId} />}
          </TabsContent>
        </Tabs>
      </div>
      <PDFConfigModal open={pdfConfigOpen} onClose={() => setPdfConfigOpen(false)} />
    </DashboardLayout>
  );
}
