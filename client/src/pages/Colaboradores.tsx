import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  Users, Building2, UserPlus, Phone, Mail,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

// ─── Sugestões padrão de função ───────────────────────────────────────────

import { FUNCOES } from "@/lib/funcoes";
const FUNCOES_SUGESTOES = FUNCOES.map((f) => f.label);

// ─── Combobox de função: texto livre + sugestões ──────────────────────────

function FuncaoInput({
  value,
  onChange,
  placeholder = "Ex: Pedreiro, Soldador...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? FUNCOES_SUGESTOES.filter(f => f.toLowerCase().includes(value.toLowerCase()))
    : FUNCOES_SUGESTOES;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Pressione Enter para usar "{value}"
            </p>
          ) : (
            filtered.map(f => (
              <button
                key={f}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onMouseDown={e => { e.preventDefault(); onChange(f); setOpen(false); }}
              >
                {f}
              </button>
            ))
          )}
          {value.trim() && !FUNCOES_SUGESTOES.some(f => f.toLowerCase() === value.toLowerCase()) && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm border-t text-primary font-medium hover:bg-accent transition-colors"
              onMouseDown={e => { e.preventDefault(); setOpen(false); }}
            >
              ✓ Usar "{value}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Funcao = string;

// ─── Formulários padrão ───────────────────────────────────────────────────

const EQUIPE_FORM_DEFAULT = { nome: "", empresa: "", cnpj: "", contato: "", telefone: "", email: "" };
const COLAB_FORM_DEFAULT  = { nome: "", cpf: "", funcao: "", dataAdmissao: "" };

// ─── Componente EquipeCard ────────────────────────────────────────────────

function EquipeCard({
  equipe,
  onEdit,
  onDelete,
}: {
  equipe: any;
  onEdit: (e: any) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [openAdd, setOpenAdd]       = useState(false);
  const [openEditColab, setOpenEditColab] = useState(false);
  const [editingColab, setEditingColab]   = useState<any | null>(null);
  const [colabForm, setColabForm]   = useState(COLAB_FORM_DEFAULT);
  const [editColabForm, setEditColabForm] = useState<{ nome: string; cpf: string; funcao: string; dataAdmissao: string; ativo: boolean }>({ nome: "", cpf: "", funcao: "", dataAdmissao: "", ativo: true });

  const utils = trpc.useUtils();

  const { data: colaboradores = [], refetch: refetchColabs } = trpc.colaboradores.listByEquipe.useQuery(
    { equipeId: equipe.id },
    { enabled: expanded }
  );

  const createColabMutation = trpc.colaboradores.create.useMutation({
    onSuccess: () => {
      toast.success("Colaborador adicionado!");
      setColabForm(COLAB_FORM_DEFAULT);
      setOpenAdd(false);
      refetchColabs();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar colaborador"),
  });

  const updateColabMutation = trpc.colaboradores.update.useMutation({
    onSuccess: () => {
      toast.success("Colaborador atualizado!");
      setOpenEditColab(false);
      setEditingColab(null);
      refetchColabs();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar colaborador"),
  });

  const deleteColabMutation = trpc.colaboradores.delete.useMutation({
    onSuccess: () => {
      toast.success("Colaborador removido!");
      refetchColabs();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover colaborador"),
  });

  const handleAddColab = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!colabForm.nome || !colabForm.funcao) {
      toast.error("Nome e função são obrigatórios");
      return;
    }
    createColabMutation.mutate({
      equipeId: equipe.id,
      nome: colabForm.nome,
      cpf: colabForm.cpf || undefined,
      funcao: colabForm.funcao,
      dataAdmissao: colabForm.dataAdmissao || undefined,
    });
  };

  const handleEditColab = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingColab || !editColabForm.nome || !editColabForm.funcao) {
      toast.error("Nome e função são obrigatórios");
      return;
    }
    updateColabMutation.mutate({
      id: editingColab.id,
      nome: editColabForm.nome,
      cpf: editColabForm.cpf || undefined,
      funcao: editColabForm.funcao,
      dataAdmissao: editColabForm.dataAdmissao || undefined,
      ativo: editColabForm.ativo,
    });
  };

  // Converte Date/string do banco para o formato yyyy-mm-dd do input
  const toDateInput = (val: any): string => {
    if (!val) return "";
    try { return new Date(val).toISOString().split("T")[0]; } catch { return ""; }
  };

  const openEditColaModal = (c: any) => {
    setEditingColab(c);
    setEditColabForm({
      nome: c.nome ?? "",
      cpf: c.cpf ?? "",
      funcao: c.funcao ?? "",
      dataAdmissao: toDateInput(c.dataAdmissao),
      ativo: c.ativo ?? true,
    });
    setOpenEditColab(true);
  };

  const fmtData = (val: any): string => {
    if (!val) return "";
    try { return new Date(val).toLocaleDateString("pt-BR"); } catch { return ""; }
  };

  const ativos   = colaboradores.filter((c: any) => c.ativo !== false);
  const inativos = colaboradores.filter((c: any) => c.ativo === false);

  return (
    <Card className="overflow-hidden border shadow-sm">
      {/* ── Cabeçalho da equipe ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-snug truncate">{equipe.nome}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0 mt-0.5">
              <p className="text-xs text-muted-foreground truncate">{equipe.empresa}</p>
              {equipe.telefone && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" />{equipe.telefone}
                </span>
              )}
              {equipe.email && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3" />{equipe.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-8 px-2.5"
            onClick={() => setExpanded(!expanded)}
          >
            <Users className="w-3.5 h-3.5" />
            {expanded ? "Fechar" : "Ver equipe"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(equipe)}
            title="Editar equipe"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Excluir a equipe "${equipe.nome}"? Isso removerá todos os colaboradores.`)) {
                onDelete(equipe.id);
              }
            }}
            title="Excluir equipe"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Painel de colaboradores (expansível) ── */}
      {expanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4 space-y-3">
            {/* Barra de ação dos colaboradores */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {ativos.length} colaborador{ativos.length !== 1 ? "es" : ""} ativo{ativos.length !== 1 ? "s" : ""}
                {inativos.length > 0 && ` · ${inativos.length} inativo${inativos.length > 1 ? "s" : ""}`}
              </span>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpenAdd(true)}>
                <UserPlus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>

            {/* Lista de colaboradores */}
            {colaboradores.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum colaborador cadastrado.{" "}
                <button className="text-primary underline" onClick={() => setOpenAdd(true)}>
                  Adicionar o primeiro
                </button>
              </div>
            ) : (
              <div className="grid gap-1.5">
                {/* Ativos */}
                {ativos.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-1.5"
                  >
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.nome}</span>
                      <Badge variant="secondary" className="text-[11px] px-1.5 py-0">{c.funcao}</Badge>
                      {c.cpf && <span className="text-xs text-muted-foreground">CPF {c.cpf}</span>}
                      {c.dataAdmissao && <span className="text-xs text-muted-foreground">· Adm. {fmtData(c.dataAdmissao)}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditColaModal(c)}
                        title="Editar colaborador"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remover "${c.nome}" da equipe?`)) {
                            deleteColabMutation.mutate({ id: c.id });
                          }
                        }}
                        title="Remover colaborador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Inativos (colapsados) */}
                {inativos.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground select-none list-none flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" />
                      {inativos.length} inativo{inativos.length > 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 grid gap-2">
                      {inativos.map((c: any) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 opacity-60"
                        >
                          <div>
                            <p className="font-medium text-sm line-through">{c.nome}</p>
                            <Badge variant="outline" className="text-xs mt-0.5">
                              {c.funcao}
                            </Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditColaModal(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm(`Remover "${c.nome}"?`)) deleteColabMutation.mutate({ id: c.id }); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}

      {/* ── Modal: Adicionar colaborador ── */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Colaborador</DialogTitle>
            <DialogDescription>Novo membro para <strong>{equipe.nome}</strong></DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddColab} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={colabForm.nome}
                onChange={e => setColabForm({ ...colabForm, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Função *</Label>
              <FuncaoInput
                value={colabForm.funcao}
                onChange={v => setColabForm({ ...colabForm, funcao: v })}
              />
              <p className="text-xs text-muted-foreground">Escolha uma sugestão ou digite qualquer função</p>
            </div>
            <div className="space-y-1">
              <Label>CPF <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                placeholder="000.000.000-00"
                value={colabForm.cpf}
                onChange={e => setColabForm({ ...colabForm, cpf: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Data de admissão <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                type="date"
                value={colabForm.dataAdmissao}
                onChange={e => setColabForm({ ...colabForm, dataAdmissao: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={createColabMutation.isPending}>
                {createColabMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpenAdd(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editar colaborador ── */}
      <Dialog open={openEditColab} onOpenChange={v => { if (!v) { setOpenEditColab(false); setEditingColab(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
            <DialogDescription>{editingColab?.nome}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditColab} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input
                value={editColabForm.nome}
                onChange={e => setEditColabForm({ ...editColabForm, nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1">
              <Label>Função *</Label>
              <FuncaoInput
                value={editColabForm.funcao}
                onChange={v => setEditColabForm({ ...editColabForm, funcao: v })}
              />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                value={editColabForm.cpf}
                onChange={e => setEditColabForm({ ...editColabForm, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-1">
              <Label>Data de admissão</Label>
              <Input
                type="date"
                value={editColabForm.dataAdmissao}
                onChange={e => setEditColabForm({ ...editColabForm, dataAdmissao: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={editColabForm.ativo ? "ativo" : "inativo"}
                onValueChange={v => setEditColabForm({ ...editColabForm, ativo: v === "ativo" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={updateColabMutation.isPending}>
                {updateColabMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setOpenEditColab(false); setEditingColab(null); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function Colaboradores({ obraId, embedded = false }: { obraId?: number; embedded?: boolean } = {}) {
  const [openCreate, setOpenCreate]   = useState(false);
  const [openEdit, setOpenEdit]       = useState(false);
  const [editingEquipe, setEditingEquipe] = useState<any | null>(null);
  const [equipeForm, setEquipeForm]   = useState(EQUIPE_FORM_DEFAULT);
  const [editEquipeForm, setEditEquipeForm] = useState(EQUIPE_FORM_DEFAULT);
  const [search, setSearch]           = useState("");

  const { data: equipes = [], refetch } = trpc.equipes.list.useQuery(
    obraId != null ? { obraId } : undefined
  );

  const createMutation = trpc.equipes.create.useMutation({
    onSuccess: () => {
      toast.success("Equipe criada!");
      setEquipeForm(EQUIPE_FORM_DEFAULT);
      setOpenCreate(false);
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar equipe"),
  });

  const updateMutation = trpc.equipes.update.useMutation({
    onSuccess: () => {
      toast.success("Equipe atualizada!");
      setOpenEdit(false);
      setEditingEquipe(null);
      refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar equipe"),
  });

  const deleteMutation = trpc.equipes.delete.useMutation({
    onSuccess: () => { toast.success("Equipe excluída!"); refetch(); },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir equipe"),
  });

  const handleCreate = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!equipeForm.nome || !equipeForm.empresa) {
      toast.error("Nome e empresa são obrigatórios");
      return;
    }
    createMutation.mutate({ ...equipeForm, ...(obraId != null && { obraId }) });
  };

  const handleUpdate = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingEquipe || !editEquipeForm.nome || !editEquipeForm.empresa) {
      toast.error("Nome e empresa são obrigatórios");
      return;
    }
    updateMutation.mutate({ id: editingEquipe.id, ...editEquipeForm });
  };

  const openEditModal = (equipe: any) => {
    setEditingEquipe(equipe);
    setEditEquipeForm({
      nome: equipe.nome ?? "",
      empresa: equipe.empresa ?? "",
      cnpj: equipe.cnpj ?? "",
      contato: equipe.contato ?? "",
      telefone: equipe.telefone ?? "",
      email: equipe.email ?? "",
    });
    setOpenEdit(true);
  };

  const filtered = equipes.filter(e =>
    e.nome.toLowerCase().includes(search.toLowerCase()) ||
    e.empresa?.toLowerCase().includes(search.toLowerCase())
  );

  const conteudo = (
    <>
      <div className={embedded ? "space-y-6" : "space-y-6 max-w-4xl"}>

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            {!embedded && <h1 className="text-3xl font-bold tracking-tight">Equipes & Colaboradores</h1>}
            <p className="text-muted-foreground mt-1">
              {embedded ? "Equipes e colaboradores desta obra" : "Gerencie suas equipes e os colaboradores de cada uma"}
            </p>
          </div>
          <Button className="gap-2 self-start sm:self-auto" onClick={() => setOpenCreate(true)}>
            <Plus className="w-4 h-4" />
            Nova Equipe
          </Button>
        </div>

        {/* ── Busca ── */}
        {equipes.length > 0 && (
          <Input
            placeholder="Buscar por equipe ou empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
        )}

        {/* ── Lista de equipes ── */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="pt-6 py-16 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground mb-4">
                {search ? "Nenhuma equipe encontrada" : "Nenhuma equipe cadastrada"}
              </p>
              {!search && (
                <Button onClick={() => setOpenCreate(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Primeira Equipe
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map(equipe => (
              <EquipeCard
                key={equipe.id}
                equipe={equipe}
                onEdit={openEditModal}
                onDelete={id => deleteMutation.mutate({ id })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal: Criar equipe ── */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Equipe</DialogTitle>
            <DialogDescription>Cadastre uma nova equipe ou empresa de trabalho</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nome da equipe *</Label>
                <Input
                  placeholder="Ex: Equipe A, Hidráulica Norte"
                  value={equipeForm.nome}
                  onChange={e => setEquipeForm({ ...equipeForm, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Empresa *</Label>
                <Input
                  placeholder="Ex: RN Hidráulica Ltda"
                  value={equipeForm.empresa}
                  onChange={e => setEquipeForm({ ...equipeForm, empresa: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>CNPJ <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  placeholder="00.000.000/0001-00"
                  value={equipeForm.cnpj}
                  onChange={e => setEquipeForm({ ...equipeForm, cnpj: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  placeholder="(11) 9 9999-9999"
                  value={equipeForm.telefone}
                  onChange={e => setEquipeForm({ ...equipeForm, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Contato <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  placeholder="Nome do responsável"
                  value={equipeForm.contato}
                  onChange={e => setEquipeForm({ ...equipeForm, contato: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input
                  placeholder="contato@empresa.com"
                  type="email"
                  value={equipeForm.email}
                  onChange={e => setEquipeForm({ ...equipeForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar equipe"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Editar equipe ── */}
      <Dialog open={openEdit} onOpenChange={v => { if (!v) { setOpenEdit(false); setEditingEquipe(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Equipe</DialogTitle>
            <DialogDescription>{editingEquipe?.nome}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nome da equipe *</Label>
                <Input
                  value={editEquipeForm.nome}
                  onChange={e => setEditEquipeForm({ ...editEquipeForm, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Empresa *</Label>
                <Input
                  value={editEquipeForm.empresa}
                  onChange={e => setEditEquipeForm({ ...editEquipeForm, empresa: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>CNPJ</Label>
                <Input
                  value={editEquipeForm.cnpj}
                  onChange={e => setEditEquipeForm({ ...editEquipeForm, cnpj: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  value={editEquipeForm.telefone}
                  onChange={e => setEditEquipeForm({ ...editEquipeForm, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Contato</Label>
                <Input
                  value={editEquipeForm.contato}
                  onChange={e => setEditEquipeForm({ ...editEquipeForm, contato: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editEquipeForm.email}
                  onChange={e => setEditEquipeForm({ ...editEquipeForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setOpenEdit(false); setEditingEquipe(null); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );

  return embedded ? conteudo : <DashboardLayout>{conteudo}</DashboardLayout>;
}
