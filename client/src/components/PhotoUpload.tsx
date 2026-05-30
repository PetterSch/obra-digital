import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

interface PhotoUploadProps {
  diarioId: number;
  obraId: number;
}

export function PhotoUpload({ diarioId, obraId }: PhotoUploadProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const { data: fotos = [], isLoading: fotosLoading, refetch } = trpc.midia.listByDiario.useQuery(
    { diarioId },
    { enabled: !!diarioId }
  );

  const uploadMutation = trpc.midia.upload.useMutation({
    onSuccess: () => {
      toast.success("Foto enviada com sucesso!");
      setOpen(false);
      setSelectedFile(null);
      setDescription("");
      setPreview(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar foto");
    },
  });

  const deleteMutation = trpc.midia.delete.useMutation({
    onSuccess: () => { toast.success("Foto removida!"); refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao remover foto"),
  });

  const handleDelete = (midiaId: number) => {
    if (confirm("Remover esta foto?")) deleteMutation.mutate({ id: midiaId });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      toast.error("Selecione uma foto");
      return;
    }

    // Convert file to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      uploadMutation.mutate({
        diarioId,
        obraId,
        tipo: "foto" as const,
        descricao: description || undefined,
        arquivo: base64 as any,
        nomeOriginal: selectedFile.name,
        mimeType: selectedFile.type,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  if (fotosLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fotos e Documentos</CardTitle>
          <CardDescription>{fotos.length} arquivo(s)</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Foto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Foto</DialogTitle>
              <DialogDescription>Adicione uma foto ao diário de obra</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="foto">Selecione a foto *</Label>
                <Input
                  id="foto"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  required
                />
              </div>

              {preview && (
                <div className="space-y-2">
                  <Label>Prévia</Label>
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Fundação concluída"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {fotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
            <p>Nenhuma foto adicionada</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {fotos.map((foto: any) => (
              <div key={foto.id} className="relative group">
                <img
                  src={foto.caminhoArmazenamento}
                  alt={foto.descricao || "Foto"}
                  className="w-full h-32 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleDelete(foto.id)}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {foto.descricao && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{foto.descricao}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
