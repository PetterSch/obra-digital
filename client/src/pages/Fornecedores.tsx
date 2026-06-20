import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Truck, Search, Download, Building2, User, Mail, MapPin, Phone, FileText } from "lucide-react";

type Fornecedor = {
  id: number; nome: string; nomeFantasia?: string; tipo?: string;
  cpfCnpj?: string; inscEstadual?: string; inscMunicipal?: string;
  endereco?: string; complemento?: string; numero?: string; bairro?: string;
  cidade?: string; uf?: string; cep?: string; referencia?: string;
  email?: string; telefone?: string; observacao?: string;
};

const EMPTY: Omit<Fornecedor, "id"> = {
  nome: "", nomeFantasia: "", tipo: "juridica", cpfCnpj: "", inscEstadual: "",
  inscMunicipal: "", endereco: "", complemento: "", numero: "", bairro: "",
  cidade: "", uf: "", cep: "", referencia: "", email: "", telefone: "", observacao: "",
};

function FornecedorForm({
  form, onChange,
}: {
  form: Omit<Fornecedor, "id">;
  onChange: (f: Omit<Fornecedor, "id">) => void;
}) {
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-sm">Nome / Razão Social *</Label>
          <Input value={form.nome} onChange={set("nome")} placeholder="Nome completo ou razão social" autoFocus />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-sm">Nome Fantasia</Label>
          <Input value={form.nomeFantasia} onChange={set("nomeFantasia")} placeholder="Nome fantasia" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Tipo</Label>
          <select
            value={form.tipo}
            onChange={set("tipo")}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="juridica">Jurídica</option>
            <option value="fisica">Física</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{form.tipo === "fisica" ? "CPF" : "CNPJ"}</Label>
          <Input value={form.cpfCnpj} onChange={set("cpfCnpj")} placeholder={form.tipo === "fisica" ? "000.000.000-00" : "00.000.000/0000-00"} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Insc. Estadual</Label>
          <Input value={form.inscEstadual} onChange={set("inscEstadual")} placeholder="Inscrição estadual" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Insc. Municipal</Label>
          <Input value={form.inscMunicipal} onChange={set("inscMunicipal")} placeholder="Inscrição municipal" />
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Endereço</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm">Logradouro</Label>
            <Input value={form.endereco} onChange={set("endereco")} placeholder="Rua, Avenida, Quadra..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Número</Label>
            <Input value={form.numero} onChange={set("numero")} placeholder="Nº" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Complemento</Label>
            <Input value={form.complemento} onChange={set("complemento")} placeholder="Apto, Sala..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Bairro</Label>
            <Input value={form.bairro} onChange={set("bairro")} placeholder="Bairro" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">CEP</Label>
            <Input value={form.cep} onChange={set("cep")} placeholder="00000-000" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Cidade</Label>
            <Input value={form.cidade} onChange={set("cidade")} placeholder="Cidade" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">UF</Label>
            <Input value={form.uf} onChange={set("uf")} placeholder="UF" maxLength={2} className="uppercase" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-sm">Referência</Label>
            <Input value={form.referencia} onChange={set("referencia")} placeholder="Referência de localização" />
          </div>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contato</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">E-mail</Label>
            <Input value={form.email} onChange={set("email")} type="email" placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Telefone</Label>
            <Input value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
          </div>
        </div>
      </div>

      <div className="border-t pt-3">
        <Label className="text-sm">Observações</Label>
        <textarea
          value={form.observacao}
          onChange={set("observacao")}
          placeholder="Observações gerais..."
          rows={3}
          className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>
    </div>
  );
}

export default function Fornecedores() {
  const utils = trpc.useUtils();
  const { data: lista = [], isLoading } = trpc.fornecedores.list.useQuery();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Fornecedor, "id">>(EMPTY);
  const [delId, setDelId] = useState<number | null>(null);
  const [delNome, setDelNome] = useState("");

  const inval = () => utils.fornecedores.list.invalidate();
  const createMut = trpc.fornecedores.create.useMutation({ onSuccess: () => { toast.success("Fornecedor cadastrado!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.fornecedores.update.useMutation({ onSuccess: () => { toast.success("Fornecedor atualizado!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.fornecedores.delete.useMutation({ onSuccess: () => { toast.success("Fornecedor excluído"); setDelId(null); inval(); }, onError: (e) => toast.error(e.message) });
  const seedMut = trpc.fornecedores.seed.useMutation({ onSuccess: (r) => { toast.success(`${r.inseridos} fornecedores importados!`); inval(); }, onError: (e) => toast.error(e.message) });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return lista as Fornecedor[];
    return (lista as Fornecedor[]).filter((f) =>
      f.nome.toLowerCase().includes(q) ||
      (f.nomeFantasia ?? "").toLowerCase().includes(q) ||
      (f.cpfCnpj ?? "").includes(q) ||
      (f.cidade ?? "").toLowerCase().includes(q)
    );
  }, [lista, busca]);

  const abrirNovo = () => { setEditId(null); setForm(EMPTY); setOpen(true); };
  const abrirEdicao = (f: Fornecedor) => {
    setEditId(f.id);
    setForm({ nome: f.nome ?? "", nomeFantasia: f.nomeFantasia ?? "", tipo: f.tipo ?? "juridica", cpfCnpj: f.cpfCnpj ?? "", inscEstadual: f.inscEstadual ?? "", inscMunicipal: f.inscMunicipal ?? "", endereco: f.endereco ?? "", complemento: f.complemento ?? "", numero: f.numero ?? "", bairro: f.bairro ?? "", cidade: f.cidade ?? "", uf: f.uf ?? "", cep: f.cep ?? "", referencia: f.referencia ?? "", email: f.email ?? "", telefone: f.telefone ?? "", observacao: f.observacao ?? "" });
    setOpen(true);
  };
  const salvar = () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    const payload = {
      ...form,
      nome: form.nome.trim(),
      nomeFantasia: form.nomeFantasia?.trim() || null,
      cpfCnpj: form.cpfCnpj?.trim() || null,
      inscEstadual: form.inscEstadual?.trim() || null,
      inscMunicipal: form.inscMunicipal?.trim() || null,
      endereco: form.endereco?.trim() || null,
      complemento: form.complemento?.trim() || null,
      numero: form.numero?.trim() || null,
      bairro: form.bairro?.trim() || null,
      cidade: form.cidade?.trim() || null,
      uf: form.uf?.trim().toUpperCase() || null,
      cep: form.cep?.trim() || null,
      referencia: form.referencia?.trim() || null,
      email: form.email?.trim() || null,
      telefone: form.telefone?.trim() || null,
      observacao: form.observacao?.trim() || null,
    };
    const tipoVal = (payload.tipo === "fisica" || payload.tipo === "juridica") ? payload.tipo : "juridica" as const;
    const payloadFinal = { ...payload, tipo: tipoVal } as const;
    if (editId) {
      updateMut.mutate({ id: editId, nome: payloadFinal.nome, nomeFantasia: payloadFinal.nomeFantasia, tipo: tipoVal, cpfCnpj: payloadFinal.cpfCnpj, inscEstadual: payloadFinal.inscEstadual, inscMunicipal: payloadFinal.inscMunicipal, endereco: payloadFinal.endereco, complemento: payloadFinal.complemento, numero: payloadFinal.numero, bairro: payloadFinal.bairro, cidade: payloadFinal.cidade, uf: payloadFinal.uf, cep: payloadFinal.cep, referencia: payloadFinal.referencia, email: payloadFinal.email, telefone: payloadFinal.telefone, observacao: payloadFinal.observacao });
    } else {
      createMut.mutate({ nome: payloadFinal.nome, nomeFantasia: payloadFinal.nomeFantasia, tipo: tipoVal, cpfCnpj: payloadFinal.cpfCnpj, inscEstadual: payloadFinal.inscEstadual, inscMunicipal: payloadFinal.inscMunicipal, endereco: payloadFinal.endereco, complemento: payloadFinal.complemento, numero: payloadFinal.numero, bairro: payloadFinal.bairro, cidade: payloadFinal.cidade, uf: payloadFinal.uf, cep: payloadFinal.cep, referencia: payloadFinal.referencia, email: payloadFinal.email, telefone: payloadFinal.telefone, observacao: payloadFinal.observacao });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-4">
        <PageHeader
          breadcrumb={[{ label: "Cadastros" }, { label: "Fornecedores" }]}
          title="Fornecedores"
          description="Gerencie o cadastro de fornecedores e prestadores de serviço."
          icon={Truck}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                <Download className="w-4 h-4" /> Carregar Base
              </Button>
              <Button className="gap-1.5" onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
            </div>
          }
        />

        {/* Barra de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, fantasia, CNPJ/CPF ou cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (lista as any[]).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              Nenhum fornecedor cadastrado. Clique em <b>Carregar Base</b> para importar a base padrão, ou em <b>Novo Fornecedor</b> para cadastrar manualmente.
            </CardContent>
          </Card>
        ) : filtrados.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum fornecedor encontrado para "<b>{busca}</b>"
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{filtrados.length} fornecedor(es){busca ? ` encontrado(s) para "${busca}"` : ""}</p>
            {filtrados.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {f.tipo === "fisica"
                      ? <User className="w-5 h-5 text-muted-foreground" />
                      : <Building2 className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{f.nome}</p>
                    {f.nomeFantasia && f.nomeFantasia !== f.nome && (
                      <p className="text-xs text-muted-foreground truncate">{f.nomeFantasia}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {f.cpfCnpj && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {f.cpfCnpj}
                        </span>
                      )}
                      {(f.cidade || f.uf) && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {[f.cidade, f.uf].filter(Boolean).join(" - ")}
                        </span>
                      )}
                      {f.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {f.email}
                        </span>
                      )}
                      {f.telefone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {f.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => abrirEdicao(f)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => { setDelId(f.id); setDelNome(f.nome); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal cadastro/edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <FornecedorForm form={form} onChange={setForm} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.nome.trim() || createMut.isPending || updateMut.isPending}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal confirmação exclusão */}
      <Dialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir fornecedor?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir <b>{delNome}</b>? Esta ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMut.isPending} onClick={() => delId && deleteMut.mutate({ id: delId })}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
