import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { ClipboardList, CheckCircle2, Map, Building2, ArrowRight, Plus, ChevronLeft } from "lucide-react";
import { MapaCotacaoTab } from "@/components/MapaCotacaoTab";

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

type ObraSelecionada = { id: number; nome: string };

export default function MapaCotacaoGlobal() {
  const [dialogObra, setDialogObra] = useState(false);
  const [obraSelecionada, setObraSelecionada] = useState<ObraSelecionada | null>(null);
  const [openMapaId, setOpenMapaId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "em_andamento" | "concluidos">("todos");

  const { data: mapas = [], isLoading } = trpc.mapaCotacao.listAll.useQuery();
  const { data: obras = [], isLoading: carregandoObras } = trpc.obras.list.useQuery();

  // Agrupar por obra
  const porObra = mapas.reduce((acc: Record<number, { obraNome: string; obraId: number; mapas: any[] }>, m: any) => {
    if (!acc[m.obraId]) acc[m.obraId] = { obraNome: m.obraNome, obraId: m.obraId, mapas: [] };
    acc[m.obraId].mapas.push(m);
    return acc;
  }, {});
  const grupos = Object.values(porObra);

  const emAndamento = mapas.filter((m: any) => m.status !== "concluido").length;
  const concluidos = mapas.filter((m: any) => m.status === "concluido").length;

  const gruposFiltrados = grupos.map(g => ({
    ...g,
    mapas: g.mapas.filter((m: any) => {
      if (filtro === "em_andamento") return m.status !== "concluido";
      if (filtro === "concluidos") return m.status === "concluido";
      return true;
    }),
  })).filter(g => g.mapas.length > 0);

  function abrirObra(obraId: number, obraNome: string, mapaId?: number) {
    setObraSelecionada({ id: obraId, nome: obraNome });
    setOpenMapaId(mapaId ?? null);
  }

  function voltar() {
    setObraSelecionada(null);
    setOpenMapaId(null);
  }

  // View: obra selecionada → mostra MapaCotacaoTab inline
  if (obraSelecionada) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={voltar}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Map className="w-5 h-5" /> Mapa de Cotação
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {obraSelecionada.nome}
              </p>
            </div>
          </div>
          <MapaCotacaoTab
            obraId={obraSelecionada.id}
            obraNome={obraSelecionada.nome}
            openMapaId={openMapaId ?? undefined}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Map className="w-6 h-6" /> Mapa de Cotação
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Visão geral de todos os mapas por obra</p>
          </div>
          <Button className="gap-2" onClick={() => setDialogObra(true)}>
            <Plus className="w-4 h-4" /> Montar Novo Mapa
          </Button>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-3 gap-4">
          <Card
            className={`cursor-pointer transition-all ${filtro === "todos" ? "ring-2 ring-slate-500 bg-slate-50" : "hover:bg-muted/40"}`}
            onClick={() => setFiltro(filtro === "todos" ? "todos" : "todos")}>
            <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
              <Map className={`w-8 h-8 ${filtro === "todos" ? "text-slate-700" : "text-slate-500"}`} />
              <p className="text-2xl font-bold">{mapas.length}</p>
              <p className="text-xs text-muted-foreground">Total de Mapas</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${filtro === "em_andamento" ? "ring-2 ring-amber-500 bg-amber-50" : "hover:bg-muted/40"}`}
            onClick={() => setFiltro(f => f === "em_andamento" ? "todos" : "em_andamento")}>
            <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
              <ClipboardList className={`w-8 h-8 ${filtro === "em_andamento" ? "text-amber-600" : "text-amber-500"}`} />
              <p className="text-2xl font-bold">{emAndamento}</p>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${filtro === "concluidos" ? "ring-2 ring-green-500 bg-green-50" : "hover:bg-muted/40"}`}
            onClick={() => setFiltro(f => f === "concluidos" ? "todos" : "concluidos")}>
            <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
              <CheckCircle2 className={`w-8 h-8 ${filtro === "concluidos" ? "text-green-600" : "text-green-500"}`} />
              <p className="text-2xl font-bold">{concluidos}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista por obra */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : gruposFiltrados.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Map className="w-10 h-10 mx-auto opacity-30" />
              <div>
                {grupos.length === 0 ? (
                  <>
                    <p className="text-muted-foreground">Nenhum mapa de cotação criado ainda.</p>
                    <p className="text-sm text-muted-foreground mt-1">Clique em <strong>Montar Novo Mapa</strong> para começar.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Nenhum mapa encontrado para o filtro selecionado.</p>
                )}
              </div>
              {grupos.length === 0 && (
                <Button onClick={() => setDialogObra(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Montar Novo Mapa
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {gruposFiltrados.map(({ obraId, obraNome, mapas: ms }) => (
              <div key={obraId}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {obraNome}
                  </h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => abrirObra(obraId, obraNome)}>
                    Abrir Mapas <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {ms.map((m: any) => (
                    <div key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 hover:shadow-sm transition-shadow cursor-pointer"
                      onClick={() => abrirObra(obraId, obraNome, m.id)}>
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
                      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: selecionar obra */}
      <Dialog open={dialogObra} onOpenChange={setDialogObra}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Obra</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Escolha a obra para montar o mapa de cotação:</p>
          {carregandoObras ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : obras.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma obra encontrada.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(obras as any[]).map((obra: any) => (
                <button key={obra.id}
                  className="w-full text-left rounded-lg border px-4 py-3 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3"
                  onClick={() => { setDialogObra(false); abrirObra(obra.id, obra.nome); }}>
                  <div>
                    <p className="font-medium text-sm">{obra.nome}</p>
                    {obra.endereco && <p className="text-xs text-muted-foreground">{obra.endereco}</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
