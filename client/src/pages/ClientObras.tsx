import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { MapPin, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function ClientObras() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: obras = [], isLoading } = trpc.obras.list.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // All obras are visible to clients in read-only mode
  const clientObras = obras;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Minhas Obras</h1>
          <p className="text-muted-foreground">Acompanhe o progresso de seus projetos em tempo real</p>
        </div>

        {/* Obras Grid */}
        {clientObras.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma obra disponível no momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientObras.map((obra) => {
              const progressPercentage = obra.status === "finalizada" ? 100 : 
                obra.status === "pausada" ? 50 : 
                obra.status === "em_andamento" ? 65 : 0;

              return (
                <Card 
                  key={obra.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/client/obras/${obra.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{obra.nome}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <MapPin className="w-4 h-4" />
                      {obra.cidade}, {obra.estado}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                        obra.status === "finalizada" ? "bg-green-100 text-green-800" :
                        obra.status === "em_andamento" ? "bg-blue-100 text-blue-800" :
                        obra.status === "pausada" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {obra.status === "finalizada" ? "Finalizada" :
                         obra.status === "em_andamento" ? "Em Andamento" :
                         obra.status === "pausada" ? "Pausada" : "Planejamento"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-muted-foreground">Progresso</span>
                        <span className="text-xs font-bold">{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Início: {new Date(obra.dataInicio).toLocaleDateString("pt-BR")}
                      </div>
                      {obra.dataPrevistTermino && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Previsão: {new Date(obra.dataPrevistTermino).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                    </div>

                    {/* View Button */}
                    <Button 
                      variant="outline" 
                      className="w-full mt-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/client/obras/${obra.id}`);
                      }}
                    >
                      Ver Detalhes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
