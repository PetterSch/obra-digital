import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getPDFConfig, setPDFConfig, type PDFConfig } from "@/lib/pdfExport";
import { Building2, Upload, Trash2, FileText, Eye, Phone, Mail, Globe, Hash, MapPin, User, Award } from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ─── Preview miniatura da capa ────────────────────────────────────────────

function CoverPreview({ config }: { config: PDFConfig }) {
  return (
    <div className="rounded-xl overflow-hidden border shadow-md select-none" style={{ width: "100%", maxWidth: 320 }}>
      {/* Fundo azul */}
      <div className="relative flex flex-col items-center justify-center py-6 px-4 text-white"
        style={{ background: "linear-gradient(145deg,#0f2744,#1e3a5f)" }}>
        {/* Logo */}
        <div className="bg-white rounded-lg px-4 py-2 mb-3 flex items-center gap-2 shadow-lg">
          {config.logoBase64
            ? <img src={config.logoBase64} alt="Logo" className="h-8 max-w-[120px] object-contain" />
            : <span className="font-black text-[#1e3a5f] text-sm">Obra<span className="text-blue-600">Digital</span></span>
          }
        </div>
        <div className="text-[9px] tracking-widest opacity-60 mb-1">REGISTRO DIÁRIO DE OBRA</div>
        <div className="font-bold text-sm text-center">Diário de Obra</div>
      </div>

      {/* Corpo */}
      <div className="bg-white px-4 py-3 space-y-2">
        <div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">EMPRESA EMISSORA</div>
          <div className="font-black text-[#1e3a5f] text-sm leading-tight">
            {config.empresaNome || "Diário de Obras Digital"}
          </div>
          {config.empresaSubtitulo && (
            <div className="text-[10px] text-gray-400">{config.empresaSubtitulo}</div>
          )}
          {(config.cnpj || config.telefone || config.email) && (
            <div className="text-[9px] text-gray-400 mt-1 leading-relaxed">
              {[config.cnpj && `CNPJ: ${config.cnpj}`, config.telefone, config.email].filter(Boolean).join("  ·  ")}
            </div>
          )}
        </div>
        <Separator />
        <div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">OBRA</div>
          <div className="font-bold text-xs text-gray-800">Nome da Obra</div>
          <div className="text-[9px] text-gray-400">Cód. OBR-001</div>
        </div>
        <div className="grid grid-cols-2 gap-1 mt-1">
          {["Cliente", "Responsável"].map(lbl => (
            <div key={lbl} className="border-l-2 border-[#1e3a5f] pl-1.5">
              <div className="text-[7px] font-bold text-[#1e3a5f] uppercase">{lbl}</div>
              <div className="text-[9px] text-gray-500">—</div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="border-t pt-2 flex justify-between items-end mt-1">
          <div className="text-[8px] text-gray-400 leading-tight">
            {config.empresaNome || "Diário de Obras Digital"}<br />
            {config.endereco && <span>{config.endereco}<br /></span>}
            Gerado em {new Date().toLocaleDateString("pt-BR")}
          </div>
          <div className="bg-[#1e3a5f] text-white text-[7px] px-2 py-0.5 rounded font-bold">RDO #1</div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function ConfiguracaoEmpresa() {
  const [config, setConfig] = useState<PDFConfig>({});
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(getPDFConfig());
  }, []);

  function set(field: keyof PDFConfig) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig(c => ({ ...c, [field]: e.target.value }));
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { toast.error("Logo muito grande. Use até 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => setConfig(c => ({ ...c, logoBase64: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  function handleSave() {
    setPDFConfig(config);
    setSaved(true);
    toast.success("Configurações salvas! Serão aplicadas em todos os PDFs exportados.");
    setTimeout(() => setSaved(false), 3000);
  }

  function handleRemoveLogo() {
    setConfig(c => ({ ...c, logoBase64: undefined }));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações da Empresa</h1>
          <p className="text-muted-foreground mt-1">
            Esses dados aparecem na capa e no cabeçalho de todos os PDFs exportados (diários, relatórios e resumos).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Formulário ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Logo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Logo da empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {config.logoBase64 ? (
                  <div className="flex items-center gap-4">
                    <div className="border rounded-lg p-3 bg-white shadow-sm">
                      <img src={config.logoBase64} alt="Logo" className="h-14 max-w-[180px] object-contain" />
                    </div>
                    <div className="space-y-2">
                      <Badge variant="secondary">Logo carregado</Badge>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                          <Upload className="w-3.5 h-3.5 mr-1.5" /> Trocar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemoveLogo}>
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors group"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                    <p className="font-medium text-sm">Clique para enviar o logo</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG · Máx. 5 MB · Use alta resolução (ideal: PNG/SVG com fundo transparente)</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />
              </CardContent>
            </Card>

            {/* Identificação */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Nome da empresa / Razão social
                  </Label>
                  <Input
                    value={config.empresaNome ?? ""}
                    onChange={set("empresaNome")}
                    placeholder="Ex: Construtora Silva Engenharia Ltda"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" /> CNPJ
                    </Label>
                    <Input
                      value={config.cnpj ?? ""}
                      onChange={set("cnpj")}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      Slogan / Especialidade
                    </Label>
                    <Input
                      value={config.empresaSubtitulo ?? ""}
                      onChange={set("empresaSubtitulo")}
                      placeholder="Ex: Construção Civil e Reformas"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contato */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  Contato
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Telefone
                    </Label>
                    <Input
                      value={config.telefone ?? ""}
                      onChange={set("telefone")}
                      placeholder="(11) 9 9999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> E-mail
                    </Label>
                    <Input
                      type="email"
                      value={config.email ?? ""}
                      onChange={set("email")}
                      placeholder="contato@empresa.com.br"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Site
                  </Label>
                  <Input
                    value={config.site ?? ""}
                    onChange={set("site")}
                    placeholder="www.empresa.com.br"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Endereço da empresa
                  </Label>
                  <Input
                    value={config.endereco ?? ""}
                    onChange={set("endereco")}
                    placeholder="Rua, número, cidade – UF"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Responsável técnico */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Responsável Técnico Padrão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Aparece na linha de assinatura dos documentos quando não definido na obra.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Nome do engenheiro
                    </Label>
                    <Input
                      value={config.responsavelPadrao ?? ""}
                      onChange={set("responsavelPadrao")}
                      placeholder="Eng. João da Silva"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" /> CREA
                    </Label>
                    <Input
                      value={config.crea ?? ""}
                      onChange={set("crea")}
                      placeholder="0000000000-0 / SP"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Botão salvar */}
            <div className="flex gap-3">
              <Button onClick={handleSave} className="gap-2" size="lg">
                {saved ? "✓ Salvo!" : "Salvar configurações"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.write(`<p style="font-family:sans-serif;padding:24px">As configurações foram salvas. Exporte um diário para visualizar o PDF completo.</p>`);
                  w.document.close();
                }}
              >
                <Eye className="w-4 h-4" />
                Como aparece no PDF?
              </Button>
            </div>
          </div>

          {/* ── Preview da capa ── */}
          <div className="space-y-4">
            <div className="sticky top-6">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Preview da capa do PDF
              </p>
              <CoverPreview config={config} />
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Atualiza em tempo real conforme você preenche
              </p>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
