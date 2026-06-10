import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";

export default function Insumos() {
  const utils = trpc.useUtils();
  const { data: lista = [], isLoading } = trpc.insumos.list.useQuery();
  const { data: categorias = [] } = trpc.insumoCategorias.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ categoriaId: "", codigo: "", nome: "", unidade: "" });
  const [delId, setDelId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState("todas");

  const inval = () => utils.insumos.list.invalidate();
  const createMut = trpc.insumos.create.useMutation({ onSuccess: () => { toast.success("Insumo salvo!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.insumos.update.useMutation({ onSuccess: () => { toast.success("Insumo atualizado!"); setOpen(false); inval(); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.insumos.delete.useMutation({ onSuccess: () => { toast.success("Insumo excluído"); setDelId(null); inval(); }, onError: (e) => toast.error(e.message) });

  const abrirNovo = () => { setEditId(null); setForm({ categoriaId: "", codigo: "", nome: "", unidade: "" }); setOpen(true); };
  const abrirEdicao = (it: any) => { setEditId(it.id); setForm({ categoriaId: it.categoriaId ? String(it.categoriaId) : "", codigo: it.codigo || "", nome: it.nome || "", unidade: it.unidade || "" }); setOpen(true); };
  const salvar = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload = { categoriaId: form.categoriaId ? parseInt(form.categoriaId) : undefined, codigo: form.codigo || undefined, nome: form.nome.trim(), unidade: form.unidade || undefined };
    editId ? updateMut.mutate({ id: editId, ...payload }) : createMut.mutate(payload);
  };

  const filtrada = (lista as any[]).filter((i) =>
    (catFiltro === "todas" || String(i.categoriaId) === catFiltro) &&
    (!busca.trim() || `${i.codigo || ""} ${i.nome} ${i.categoriaNome || ""}`.toLowerCase().includes(busca.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-4">
        <PageHeader
          breadcrumb={[{ label: "Cadastros" }, { label: "Insumos" }]}
          title="Insumos"
          description="Itens que aparecem no Pedido de Compra (somente os cadastrados)"
          icon={Package}
          actions={<Button className="gap-1.5" onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Insumo</Button>}
        />

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por código, nome ou categoria..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)} className="h-10 px-3 border border-input rounded-md bg-background text-sm">
            <option value="todas">Todas as categorias</option>
            {(categorias as any[]).map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
          </select>
        </div>

        {isLoading ? <div className="flex justify-center py-10"><Spinner /></div> : filtrada.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            {(lista as any[]).length === 0 ? <>Nenhum insumo cadastrado. Clique em <b>Novo Insumo</b>.</> : "Nenhum insumo encontrado."}
          </CardContent></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <th className="text-left p-2.5 w-24">Código</th><th className="text-left p-2.5">Insumo</th><th className="text-left p-2.5 w-40">Categoria</th><th className="text-left p-2.5 w-20">Unid.</th><th className="w-20"></th>
              </tr></thead>
              <tbody>
                {filtrada.map((i) => (
                  <tr key={i.id} className="border-t hover:bg-muted/20">
                    <td className="p-2.5 text-muted-foreground">{i.codigo || "—"}</td>
                    <td className="p-2.5 font-medium">{i.nome}</td>
                    <td className="p-2.5">{i.categoriaNome || <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2.5">{i.unidade || "—"}</td>
                    <td className="p-2.5">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => abrirEdicao(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => setDelId(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar insumo" : "Novo insumo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5"><Label className="text-xs">Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: 001" /></div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Unidade</Label><Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} placeholder="UND, SC 50kg, m³..." /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Nome / Descrição *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Tubo PVC soldável 25mm" autoFocus />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Categoria</Label>
              <Select value={form.categoriaId || "__none"} onValueChange={(v) => setForm({ ...form, categoriaId: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem categoria</SelectItem>
                  {(categorias as any[]).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={!form.nome.trim() || createMut.isPending || updateMut.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Excluir insumo?</DialogTitle></DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMut.isPending} onClick={() => delId && deleteMut.mutate({ id: delId })}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
