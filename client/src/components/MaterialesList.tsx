import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";

interface MateriaisListProps {
  obraId: number;
}

export function MaterialesList({ obraId }: MateriaisListProps) {
  const { data: materiais = [], isLoading, error, refetch } = trpc.materiais.listByObra.useQuery(
    { obraId },
    { enabled: !!obraId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8">
          <p className="text-red-600 mb-4">Erro ao carregar materiais</p>
          <button
            onClick={() => refetch()}
            className="text-blue-600 hover:underline text-sm"
          >
            Tentar novamente
          </button>
        </CardContent>
      </Card>
    );
  }

  if (materiais.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8">
          <p className="text-muted-foreground">Nenhum material cadastrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estoque de Materiais</CardTitle>
        <CardDescription>{materiais.length} material(is) cadastrado(s)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiais.map((material) => (
                <TableRow key={material.id}>
                  <TableCell className="font-medium">{material.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{material.unidade}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {parseFloat(material.quantidade || "0").toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {material.observacoes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
