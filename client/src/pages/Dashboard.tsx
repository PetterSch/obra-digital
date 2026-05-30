import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, CheckCircle2, Clock, Plus } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: obras = [] } = trpc.obras.list.useQuery();

  const obraStats = {
    total: obras.length,
    emAndamento: obras.filter(o => o.status === "em_andamento").length,
    finalizada: obras.filter(o => o.status === "finalizada").length,
    pausada: obras.filter(o => o.status === "pausada").length,
  };

  const chartData = [
    { name: "Em Andamento", value: obraStats.emAndamento, color: "#3b82f6" },
    { name: "Finalizadas", value: obraStats.finalizada, color: "#10b981" },
    { name: "Pausadas", value: obraStats.pausada, color: "#f59e0b" },
  ];

  const progressData = obras.map(obra => ({
    name: obra.nome.substring(0, 15),
    progresso: obra.percentualAndamento || 0,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Bem-vindo, {user?.name}! Aqui está um resumo das suas obras.</p>
          </div>
          <Button onClick={() => navigate("/obras")} size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Obra
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Obras</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{obraStats.total}</div>
              <p className="text-xs text-muted-foreground">Todas as suas obras</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{obraStats.emAndamento}</div>
              <p className="text-xs text-muted-foreground">Obras ativas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Finalizadas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{obraStats.finalizada}</div>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pausadas</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{obraStats.pausada}</div>
              <p className="text-xs text-muted-foreground">Aguardando ação</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status das Obras</CardTitle>
              <CardDescription>Distribuição por status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progresso das Obras</CardTitle>
              <CardDescription>Percentual de andamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="progresso" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Obras */}
        <Card>
          <CardHeader>
            <CardTitle>Obras Recentes</CardTitle>
            <CardDescription>Suas obras mais recentes</CardDescription>
          </CardHeader>
          <CardContent>
            {obras.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhuma obra criada ainda.</p>
                <Button onClick={() => navigate("/obras")} variant="outline" className="mt-4">
                  Criar primeira obra
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {obras.slice(0, 5).map(obra => (
                  <div key={obra.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/obras/${obra.id}`)}>
                    <div className="flex-1">
                      <p className="font-medium">{obra.nome}</p>
                      <p className="text-sm text-muted-foreground">{obra.cliente}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{obra.percentualAndamento}%</p>
                        <p className="text-xs text-muted-foreground">{obra.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
