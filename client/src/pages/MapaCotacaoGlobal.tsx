import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ClipboardList, CheckCircle2, Map, Building2, ArrowRight } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  rascunho: "Rascunho",
};
const STATUS_COR: Record<string, string> = {
  em_andamento: "bg-blue-100 text-blue-700",
  concluido: "bg-green-100 text-green-700",
  rascunho: "bg-gray-100 text-gray-600",
};

export default function MapaCotacaoGlobal() {
  const [, navigate] = useLocation();
  const { data: mapas = [], isLoading } = trpc.mapaCotacao.listAll.useQuery();

  // Agrupar por obra
  const porObra = mapas.reduce((acc: Record<number, { obraNome: string; obraId: number; mapas: any[] }>, m: any) => {
    if (!acc[m.obraId]) acc[m.obraId] = { obraNome: m.obraNome, obraId: m.obraId, mapas: [] };
    acc[m.obraId].mapas.push(m);
    return acc;
  }, {});
  const grupos = Object.values(porObra);

  const emAndamento = mapas.filter((m: any) => m.status !== "concluido").length;
  const concluidos = mapas.filter((m: any) => m.status === "concluido").length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Map className="w-6 h-6" /> Mapa de Cotação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral de todos os mapas de cotação por obra</p>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
              <Map className="w-8 h-8 text-slate-500" />
              <p className="text-2xl font-bold">{mapas.length}</p>
              <p className="text-xs text-muted-foreground">Total de Mapas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
              <ClipboardList className="w-8 h-8 text-amber-500" />
              <p className="text-2xl font-bold">{emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-2xl font-bold">{concluidos}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista por obra */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : grupos.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <Map className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum mapa de cotação criado ainda.</p>
              <p className="text-sm mt-1">Acesse uma obra e clique na aba <strong>Mapa de Cotação</strong> para criar o primeiro.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {grupos.map(({ obraId, obraNome, mapas: ms }) => (
              <div key={obraId}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {obraNome}
                  </h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/obras/${obraId}`)}>
                    Ir para a Obra <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {ms.map((m: any) => (
                    <div key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Mapa #{m.numero}</span>
                          {m.titulo && <span className="text-sm text-muted-foreground">— {m.titulo}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COR[m.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[m.status] ?? m.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{m.totalItens} itens</span>
                          {m.criadoPor && <span className="text-xs text-muted-foreground">por {m.criadoPor}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0"
                        onClick={() => navigate(`/obras/${obraId}`)}>
                        Abrir <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
