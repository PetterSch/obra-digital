import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getPDFConfig, setPDFConfig, type PDFConfig } from "@/lib/pdfExport";

interface PDFConfigModalProps {
  open: boolean;
  onClose: () => void;
}

export function PDFConfigModal({ open, onClose }: PDFConfigModalProps) {
  const [config, setConfig] = useState<PDFConfig>({});
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const saved = getPDFConfig();
      setConfig(saved);
      setPreview(saved.logoBase64 ?? null);
    }
  }, [open]);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      toast.error("Logo muito grande. Use uma imagem de até 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setPreview(base64);
      setConfig((c) => ({ ...c, logoBase64: base64 }));
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setPreview(null);
    setConfig((c) => ({ ...c, logoBase64: undefined }));
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSave() {
    setPDFConfig(config);
    toast.success("Configurações de PDF salvas.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de PDF</DialogTitle>
          <DialogDescription>
            Personalize a capa e o cabeçalho de todos os PDFs exportados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo da empresa</Label>
            {preview ? (
              <div className="flex items-center gap-3">
                <div className="border rounded-lg p-2 bg-white">
                  <img src={preview} alt="Logo" className="h-12 max-w-[160px] object-contain" />
                </div>
                <Button variant="outline" size="sm" onClick={handleRemoveLogo}>
                  Remover
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <p className="text-sm text-muted-foreground">
                  Clique para enviar PNG, JPG ou SVG (máx. 500 KB)
                </p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {!preview && (
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                Selecionar arquivo
              </Button>
            )}
          </div>

          {/* Nome da empresa */}
          <div className="space-y-2">
            <Label htmlFor="empresaNome">Nome da empresa</Label>
            <Input
              id="empresaNome"
              placeholder="Ex: Construtora Silva Ltda."
              value={config.empresaNome ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, empresaNome: e.target.value }))}
            />
          </div>

          {/* Subtítulo */}
          <div className="space-y-2">
            <Label htmlFor="empresaSub">CNPJ / Slogan (opcional)</Label>
            <Input
              id="empresaSub"
              placeholder="Ex: CNPJ 00.000.000/0001-00"
              value={config.empresaSubtitulo ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, empresaSubtitulo: e.target.value }))}
            />
          </div>

          {/* Preview da capa */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              Preview da capa
            </p>
            <div className="rounded-md overflow-hidden border" style={{ transform: "scale(0.85)", transformOrigin: "top left", width: "117%" }}>
              <div className="bg-gradient-to-br from-[#0f2744] to-[#1e3a5f] p-5 text-white text-center">
                <div className="inline-flex bg-white rounded-lg px-4 py-2 mb-3">
                  {preview
                    ? <img src={preview} alt="Logo" className="h-8 max-w-[120px] object-contain" />
                    : <span className="font-black text-[#1e3a5f] text-base">Obra<span className="text-blue-600">Digital</span></span>
                  }
                </div>
                <div className="text-xs tracking-widest opacity-70 mb-1">REGISTRO DIÁRIO DE OBRA</div>
                <div className="font-bold text-lg">Diário de Obra</div>
              </div>
              <div className="bg-white p-4">
                <div className="font-black text-[#1e3a5f] text-sm">
                  {config.empresaNome || "Diário de Obras Digital"}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {config.empresaSubtitulo || "Sistema Profissional de Gestão de Obras"}
                </div>
                <div className="font-bold text-base mt-2">Nome da Obra</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar configurações</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
