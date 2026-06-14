import { useState } from "react";
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
import { Plus, Pencil, Trash2, Tags, Download } from "lucide-react";

export default function CategoriasInsumo() {
  const utils = trpc.useUtils();
  const { data: lista = [], isLoading } = trpc.insumoCategorias.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [delId, setDelId] = useState<number | null>(null);

  const inval = () => utils.insumoCategorias.list.invalidate();
  const createMut = trpc.insumoCategorias.create.useMutation({ onSuccess: () => { toast.success("Categoria salva!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.insumoCategorias.update.useMutation({ onSuccess: () => { toast.success("Categoria atualizada!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.insumoCategorias.delete.useMutation({ onSuccess: () => { toast.success("Categoria excluída"); setDelId(null); inval(); }, onError: (e) => toast.error(e.message) });
  const seedMut = trpc.insumoCategorias.seed.useMutation({
    onSuccess: (r) => { toast.success(`${r.inseridas} categorias importadas!`); inval(); },
    onError: (e) => toast.error(e.message),
  });

  const abrirNovo = () => { setEditId(null); setNome(""); setSigla(""); setOpen(true); };
  const abrirEdicao = (c: any) => { setEditId(c.id); setNome(c.nome); setSigla(c.sigla || ""); setOpen(true); };
  const salvar = () => {
    if (!nome.trim()) return;
    const payload = { nome: nome.trim(), sigla: sigla.trim().toUpperCase() || undefined };
    editId ? updateMut.mutate({ id: editId, ...payload }) : createMut.mutate(payload);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl space-y-4">
        <PageHeader
          breadcrumb={[{ label: "Cadastros" }, { label: "Categorias de Insumos" }]}
          title="Categorias de Insumos"
          description="Agrupe os insumos por categoria. A sigla é usada para gerar o código automático (ex: HID1, HID2)."
          icon={Tags}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                <Download className="w-4 h-4" /> Carregar Padrão
              </Button>
              <Button className="gap-1.5" onClick={abrirNovo}><Plus className="w-4 h-4" /> Nova Categoria</Button>
            </div>
          }
        />

        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : (lista as any[]).length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <Tags className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Nenhuma categoria. Clique em <b>Carregar Padrão</b> para importar as 50 categorias, ou em <b>Nova Categoria</b> para criar manualmente.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {(lista as any[]).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-14 text-center">
                    <span className="text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {c.sigla || "—"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.totalInsumos} insumo(s)</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => abrirEdicao(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => setDelId(c.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Sigla *</Label>
              <Input value={sigla} onChange={(e) => setSigla(e.target.value.toUpperCase())} placeholder="Ex: HID" maxLength={10} autoFocus onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} />
              <p className="text-xs text-muted-foreground">Usada no código automático dos insumos (ex: HID1, HID2...)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Hidráulicos" onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={!nome.trim() || createMut.isPending || updateMut.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir categoria?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Os insumos dessa categoria ficam sem categoria (não são excluídos).</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMut.isPending} onClick={() => delId && deleteMut.mutate({ id: delId })}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
