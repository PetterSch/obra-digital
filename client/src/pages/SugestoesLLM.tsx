import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ArrowLeft, Check, X, Edit2, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Streamdown } from "streamdown";

export default function SugestoesLLM() {
  const [, navigate] = useLocation();
  const [filtroAprovadas, setFiltroAprovadas] = useState<boolean | undefined>(false);
  const [sugestaoEmEdicao, setSugestaoEmEdicao] = useState<any>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Get suggestions
  const { data: sugestoes = [], isLoading, refetch } = trpc.sugestoesLLM.list.useQuery({
    aprovada: filtroAprovadas,
  });

  // Mutations
  const aprovarMutation = trpc.sugestoesLLM.aprovar.useMutation();
  const rejeitarMutation = trpc.sugestoesLLM.rejeitar.useMutation();
  const atualizarMutation = trpc.sugestoesLLM.atualizar.useMutation();

  const handleAprovar = async (id: number, texto: string) => {
    try {
      await aprovarMutation.mutateAsync({
        id,
        textoFinal: texto,
      });
      toast.success("Sugestão aprovada!");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao aprovar sugestão");
    }
  };

  const handleRejeitar = async (id: number) => {
    try {
      await rejeitarMutation.mutateAsync({ id });
      toast.success("Sugestão rejeitada!");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao rejeitar sugestão");
    }
  };

  const handleSalvarEdicao = async () => {
    if (!sugestaoEmEdicao) return;

    try {
      await atualizarMutation.mutateAsync({
        id: sugestaoEmEdicao.id,
        sugestao: textoEditado,
      });
      toast.success("Sugestão atualizada!");
      setIsEditDialogOpen(false);
      setSugestaoEmEdicao(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar sugestão");
    }
  };

  const abrirEdicao = (sugestao: any) => {
    setSugestaoEmEdicao(sugestao);
    setTextoEditado(sugestao.sugestao);
    setIsEditDialogOpen(true);
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      resumo_diario: "Resumo do Diário",
      sugestao_ocorrencia: "Sugestão de Ocorrência",
      analise_produtividade: "Análise de Produtividade",
    };
    return labels[tipo] || tipo;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Sugestões do LLM</h1>
            <p className="text-muted-foreground mt-1">Revise e aprove sugestões geradas automaticamente</p>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={filtroAprovadas === false ? "default" : "outline"}
                onClick={() => setFiltroAprovadas(false)}
              >
                Pendentes
              </Button>
              <Button
                variant={filtroAprovadas === true ? "default" : "outline"}
                onClick={() => setFiltroAprovadas(true)}
              >
                Aprovadas
              </Button>
              <Button
                variant={filtroAprovadas === undefined ? "default" : "outline"}
                onClick={() => setFiltroAprovadas(undefined)}
              >
                Todas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Sugestões */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ) : sugestoes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma sugestão encontrada</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sugestoes.map((sugestao: any) => (
              <Card key={sugestao.id} className={sugestao.aprovada ? "opacity-75" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                          {getTipoLabel(sugestao.tipo)}
                        </span>
                        {sugestao.aprovada && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Aprovada
                          </span>
                        )}
                      </div>
                      <CardDescription>
                        {sugestao.diarioId && `Diário #${sugestao.diarioId}`}
                        {sugestao.ocorrenciaId && `Ocorrência #${sugestao.ocorrenciaId}`}
                        {new Date(sugestao.criadoEm).toLocaleString("pt-BR")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Sugestão */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Sugestão:</p>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Streamdown>{sugestao.sugestao}</Streamdown>
                    </div>
                  </div>

                  {/* Texto Final (se aprovada) */}
                  {sugestao.textofinal && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-green-700 mb-2">Texto Final Aprovado:</p>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <Streamdown>{sugestao.textofinal}</Streamdown>
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  {!sugestao.aprovada && (
                    <div className="flex gap-2 pt-4 border-t">
                      <Dialog open={isEditDialogOpen && sugestaoEmEdicao?.id === sugestao.id} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => abrirEdicao(sugestao)}
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Editar Sugestão</DialogTitle>
                            <DialogDescription>
                              Revise e edite a sugestão antes de aprovar
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              value={textoEditado}
                              onChange={(e) => setTextoEditado(e.target.value)}
                              className="min-h-[200px]"
                              placeholder="Edite a sugestão aqui..."
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => setIsEditDialogOpen(false)}
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={() => handleAprovar(sugestao.id, textoEditado)}
                                disabled={atualizarMutation.isPending || aprovarMutation.isPending}
                                className="gap-2"
                              >
                                {atualizarMutation.isPending || aprovarMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Aprovando...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Aprovar
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Button
                        onClick={() => handleAprovar(sugestao.id, sugestao.sugestao)}
                        disabled={aprovarMutation.isPending}
                        size="sm"
                        className="gap-2"
                      >
                        {aprovarMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Aprovando...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Aprovar
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => handleRejeitar(sugestao.id)}
                        disabled={rejeitarMutation.isPending}
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                      >
                        {rejeitarMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Rejeitando...
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            Rejeitar
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
