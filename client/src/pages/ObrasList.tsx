import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Plus, Search, MapPin, Calendar } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z, ZodError } from "zod";

const createObraSchema = z.object({
  codigo: z.string().min(1, "Código é obrigatório"),
  nome: z.string().min(1, "Nome é obrigatório"),
  cliente: z.string().min(1, "Cliente é obrigatório"),
  endereco: z.string().min(1, "Endereço é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().length(2, "Estado deve ter 2 caracteres"),
  cep: z.string().min(1, "CEP é obrigatório"),
  responsavelTecnico: z.string().min(1, "Responsável técnico é obrigatório"),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
  dataPrevistTermino: z.string().min(1, "Data prevista de término é obrigatória"),
});

export default function ObrasList() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    cliente: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    responsavelTecnico: "",
    dataInicio: "",
    dataPrevistTermino: "",
  });

  const { data: obras = [], refetch } = trpc.obras.list.useQuery();
  const createMutation = trpc.obras.create.useMutation({
    onSuccess: () => {
      toast.success("Obra criada com sucesso!");
      setOpen(false);
      setFormData({
        codigo: "",
        nome: "",
        cliente: "",
        endereco: "",
        cidade: "",
        estado: "",
        cep: "",
        responsavelTecnico: "",
        dataInicio: "",
        dataPrevistTermino: "",
      });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar obra");
    },
  });

  const filteredObras = obras.filter(obra =>
    obra.nome.toLowerCase().includes(search.toLowerCase()) ||
    obra.cliente.toLowerCase().includes(search.toLowerCase()) ||
    obra.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      createObraSchema.parse(formData);
      createMutation.mutate(formData);
    } catch (error) {
      if (error instanceof ZodError) {
        error.issues.forEach((issue: any) => {
          toast.error(`${issue.path.join(".")}: ${issue.message}`);
        });
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Obras</h1>
            <p className="text-muted-foreground mt-1">Gerencie todas as suas obras</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Obra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Nova Obra</DialogTitle>
                <DialogDescription>Preencha os dados da nova obra</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      placeholder="Ex: OBR-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Obra *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Edifício Comercial"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente *</Label>
                  <Input
                    id="cliente"
                    value={formData.cliente}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço *</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    placeholder="Rua, número"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade *</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado *</Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel">Responsável Técnico *</Label>
                  <Input
                    id="responsavel"
                    value={formData.responsavelTecnico}
                    onChange={(e) => setFormData({ ...formData, responsavelTecnico: e.target.value })}
                    placeholder="Nome do engenheiro"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio">Data de Início *</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={formData.dataInicio}
                      onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataTermino">Data Prevista de Término *</Label>
                    <Input
                      id="dataTermino"
                      type="date"
                      value={formData.dataPrevistTermino}
                      onChange={(e) => setFormData({ ...formData, dataPrevistTermino: e.target.value })}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Obra"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cliente ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Obras Grid */}
        {filteredObras.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground mb-4">Nenhuma obra encontrada</p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>Criar primeira obra</Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredObras.map(obra => (
              <Card key={obra.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/obras/${obra.id}`)}>
                <CardHeader>
                  <CardTitle className="line-clamp-2">{obra.nome}</CardTitle>
                  <CardDescription>{obra.codigo}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{obra.cidade}, {obra.estado}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(obra.dataInicio).toLocaleDateString("pt-BR")} - {new Date(obra.dataPrevistTermino).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">Progresso</span>
                      <span className="text-xs font-medium">{obra.percentualAndamento}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${obra.percentualAndamento}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      obra.status === "em_andamento" ? "bg-blue-100 text-blue-700" :
                      obra.status === "finalizada" ? "bg-green-100 text-green-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {obra.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
