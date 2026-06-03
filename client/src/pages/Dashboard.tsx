import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertCircle, CheckCircle2, Clock, Plus, Building2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de obras" value={obraStats.total} icon={Building2} tone="neutral" hint="Todas as suas obras" onClick={() => navigate("/obras")} />
          <StatCard label="Em andamento" value={obraStats.emAndamento} icon={Clock} tone="blue" hint="Obras ativas" />
          <StatCard label="Finalizadas" value={obraStats.finalizada} icon={CheckCircle2} tone="green" hint="Concluídas" />
          <StatCard label="Pausadas" value={obraStats.pausada} icon={AlertCircle} tone="amber" hint="Aguardando ação" />
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
