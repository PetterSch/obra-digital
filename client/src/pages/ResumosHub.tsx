import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { FileText, Building2, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

export default function ResumosHub() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: obras = [], isLoading } = trpc.obras.list.useQuery();

  const filtradas = obras.filter((o: any) =>
    o.nome.toLowerCase().includes(search.toLowerCase()) ||
    o.cliente?.toLowerCase().includes(search.toLowerCase()) ||
    o.codigo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Resumos Periódicos
          </h1>
          <p className="text-muted-foreground mt-1">
            Escolha a obra para gerar um resumo semanal, quinzenal ou mensal
          </p>
        </div>

        {obras.length > 3 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar obra..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? "Nenhuma obra encontrada" : "Nenhuma obra cadastrada ainda"}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtradas.map((obra: any) => (
              <Card
                key={obra.id}
                className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
                onClick={() => navigate(`/obras/${obra.id}/resumos`)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{obra.nome}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {obra.codigo} · {obra.cliente}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
