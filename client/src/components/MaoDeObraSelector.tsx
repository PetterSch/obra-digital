import { useState } from "react";
import { FUNCAO_LABELS } from "@/lib/funcoes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  Check,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

interface MaoDeObraItem {
  equipeId: number;
  operariosPresentes: number[];
}

interface MaoDeObraSelectorProps {
  value: MaoDeObraItem[];
  onChange: (value: MaoDeObraItem[]) => void;
}

const FUNCAO_OPTIONS = Object.entries(FUNCAO_LABELS);

// Ícones por função para diferenciar visualmente
function FuncaoBadge({ funcao }: { funcao: string }) {
  const colors: Record<string, string> = {
    encarregado: "bg-purple-100 text-purple-800 border-purple-200",
    engenheiro:  "bg-blue-100 text-blue-800 border-blue-200",
    eletricista: "bg-yellow-100 text-yellow-800 border-yellow-200",
    bombeiro_hidraulico: "bg-cyan-100 text-cyan-800 border-cyan-200",
    pedreiro:    "bg-orange-100 text-orange-800 border-orange-200",
    armador:     "bg-red-100 text-red-800 border-red-200",
    carpinteiro: "bg-amber-100 text-amber-800 border-amber-200",
    pintor:      "bg-green-100 text-green-800 border-green-200",
    servente:    "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${colors[funcao] ?? "bg-gray-100 text-gray-700"}`}>
      {FUNCAO_LABELS[funcao] ?? funcao}
    </span>
  );
}

// Card de uma equipe com seus operários — query independente por equipe
function EquipeCard({
  item,
  equipe,
  onToggleOperario,
  onSelectAll,
  onDeselectAll,
  onRemove,
}: {
  item: MaoDeObraItem;
  equipe: { id: number; nome: string; empresa: string } | undefined;
  onToggleOperario: (equipeId: number, operarioId: number) => void;
  onSelectAll: (equipeId: number, ids: number[]) => void;
  onDeselectAll: (equipeId: number) => void;
  onRemove: (equipeId: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [openNewOperario, setOpenNewOperario] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newFuncao, setNewFuncao] = useState("");

  const { data: operarios = [], refetch } = trpc.colaboradores.listByEquipe.useQuery(
    { equipeId: item.equipeId },
    { enabled: true }
  );

  const createMutation = trpc.colaboradores.create.useMutation({
    onSuccess: () => {
      toast.success("Operário adicionado");
      setNewNome("");
      setNewFuncao("");
      setOpenNewOperario(false);
      refetch();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar operário"),
  });

  const deleteMutation = trpc.colaboradores.delete.useMutation({
    onSuccess: () => { toast.success("Operário removido"); refetch(); },
    onError: (err: any) => toast.error(err.message || "Erro ao remover operário"),
  });

  const presentes = item.operariosPresentes.length;
  const total = operarios.length;
  const todosPresentes = total > 0 && presentes === total;
  const algumPresente = presentes > 0 && presentes < total;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Cabeçalho da equipe */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-muted/40 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          }
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">
              {equipe?.nome ?? `Equipe #${item.equipeId}`}
            </div>
            <div className="text-xs text-muted-foreground truncate">{equipe?.empresa}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Contador de presença */}
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
            presentes === 0
              ? "bg-gray-100 text-gray-600"
              : presentes === total
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          }`}>
            {presentes === 0
              ? <UserX className="w-3.5 h-3.5" />
              : <UserCheck className="w-3.5 h-3.5" />
            }
            {presentes}/{total} presentes
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            title="Remover equipe do diário"
            onClick={() => onRemove(item.equipeId)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Conteúdo expansível */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {/* Barra de ação rápida */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => onSelectAll(item.equipeId, operarios.map((o) => o.id))}
                disabled={total === 0}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Todos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => onDeselectAll(item.equipeId)}
                disabled={presentes === 0}
              >
                <Square className="w-3.5 h-3.5" />
                Nenhum
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => setOpenNewOperario(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Novo operário
            </Button>
          </div>

          {/* Lista de operários */}
          {total === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Nenhum operário cadastrado nessa equipe.
              <br />
              <button
                type="button"
                className="text-primary underline mt-1 text-xs"
                onClick={() => setOpenNewOperario(true)}
              >
                Adicionar operário
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {operarios.map((op) => {
                const presente = item.operariosPresentes.includes(op.id);
                return (
                  <div
                    key={op.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      presente
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                        : "border-border hover:bg-muted/40"
                    }`}
                    onClick={() => onToggleOperario(item.equipeId, op.id)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${presente ? "bg-green-600 border-green-600 text-white" : "border-input bg-background"}`}>
                        {presente && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <span className="font-normal text-sm truncate block">{op.nome}</span>
                        <FuncaoBadge funcao={op.funcao} />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 ml-1 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remover ${op.nome} da equipe permanentemente?`)) {
                          deleteMutation.mutate({ id: op.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialog — novo operário */}
      <Dialog open={openNewOperario} onOpenChange={setOpenNewOperario}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo operário</DialogTitle>
            <DialogDescription>
              Adicionar à equipe <strong>{equipe?.nome}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor={`nome-${item.equipeId}`} className="text-sm">Nome *</Label>
              <Input
                id={`nome-${item.equipeId}`}
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Nome completo"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor={`funcao-${item.equipeId}`} className="text-sm">Função *</Label>
              <Select value={newFuncao} onValueChange={setNewFuncao}>
                <SelectTrigger id={`funcao-${item.equipeId}`} className="mt-1">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  {FUNCAO_OPTIONS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                className="flex-1"
                disabled={!newNome.trim() || !newFuncao || createMutation.isPending}
                onClick={() => {
                  if (!newNome.trim() || !newFuncao) { toast.error("Preencha todos os campos"); return; }
                  createMutation.mutate({ equipeId: item.equipeId, nome: newNome.trim(), funcao: newFuncao as any });
                }}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Adicionar
              </Button>
              <Button type="button" variant="outline" onClick={() => { setOpenNewOperario(false); setNewNome(""); setNewFuncao(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function MaoDeObraSelector({ value, onChange }: MaoDeObraSelectorProps) {
  const [openNovaEquipe, setOpenNovaEquipe] = useState(false);
  const [novaEquipeNome, setNovaEquipeNome] = useState("");
  const [novaEquipeEmpresa, setNovaEquipeEmpresa] = useState("");

  const { data: equipes = [], refetch: refetchEquipes } = trpc.equipes.list.useQuery();

  const createEquipeMutation = trpc.equipes.create.useMutation({
    onSuccess: (novaEquipe) => {
      toast.success("Equipe criada e adicionada ao diário");
      setNovaEquipeNome("");
      setNovaEquipeEmpresa("");
      setOpenNovaEquipe(false);
      refetchEquipes().then(() => {
        // Já adicionar ao diário automaticamente
        onChange([...value, { equipeId: novaEquipe.id, operariosPresentes: [] }]);
      });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar equipe"),
  });

  const equipesDisponiveis = equipes.filter((e) => !value.some((v) => v.equipeId === e.id));

  const handleAddEquipe = (equipeId: number) => {
    if (!equipeId || value.some((v) => v.equipeId === equipeId)) {
      if (equipeId) toast.warning("Equipe já adicionada");
      return;
    }
    onChange([...value, { equipeId, operariosPresentes: [] }]);
  };

  const totalPresentes = value.reduce((sum, v) => sum + v.operariosPresentes.length, 0);
  const totalEquipes = value.length;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      {totalEquipes > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {totalEquipes} equipe{totalEquipes !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-green-600" />
            <span className="text-green-700 font-medium">{totalPresentes}</span> operário{totalPresentes !== 1 ? "s" : ""} presente{totalPresentes !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Seletor de equipes (select nativo — evita loop do Radix Presence) */}
      <div className="flex gap-2">
        <select
          value=""
          onChange={(e) => { if (e.target.value) handleAddEquipe(Number(e.target.value)); }}
          disabled={equipesDisponiveis.length === 0}
          className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm disabled:opacity-60"
        >
          <option value="">
            {equipesDisponiveis.length === 0
              ? equipes.length === 0
                ? "Nenhuma equipe cadastrada"
                : "Todas as equipes já adicionadas"
              : "Adicionar equipe ao diário..."}
          </option>
          {equipesDisponiveis.map((equipe) => (
            <option key={equipe.id} value={equipe.id}>
              {equipe.nome}{equipe.empresa ? ` — ${equipe.empresa}` : ""}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={() => setOpenNovaEquipe(true)}
        >
          <Plus className="w-4 h-4" />
          Nova equipe
        </Button>
      </div>

      {/* Cards das equipes adicionadas */}
      {value.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma equipe adicionada ao diário.</p>
          <p className="text-xs mt-1">Use o seletor acima para adicionar uma equipe e marcar os presentes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((item) => (
            <EquipeCard
              key={item.equipeId}
              item={item}
              equipe={equipes.find((e) => e.id === item.equipeId)}
              onToggleOperario={(equipeId, operarioId) => {
                onChange(value.map((v) => {
                  if (v.equipeId !== equipeId) return v;
                  const isSelected = v.operariosPresentes.includes(operarioId);
                  return {
                    ...v,
                    operariosPresentes: isSelected
                      ? v.operariosPresentes.filter((id) => id !== operarioId)
                      : [...v.operariosPresentes, operarioId],
                  };
                }));
              }}
              onSelectAll={(equipeId, ids) => {
                onChange(value.map((v) => v.equipeId === equipeId ? { ...v, operariosPresentes: ids } : v));
              }}
              onDeselectAll={(equipeId) => {
                onChange(value.map((v) => v.equipeId === equipeId ? { ...v, operariosPresentes: [] } : v));
              }}
              onRemove={(equipeId) => {
                onChange(value.filter((v) => v.equipeId !== equipeId));
              }}
            />
          ))}
        </div>
      )}

      {/* Dialog — nova equipe */}
      <Dialog open={openNovaEquipe} onOpenChange={setOpenNovaEquipe}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova equipe</DialogTitle>
            <DialogDescription>Crie uma equipe e ela será adicionada automaticamente ao diário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Nome da equipe *</Label>
              <Input
                value={novaEquipeNome}
                onChange={(e) => setNovaEquipeNome(e.target.value)}
                placeholder="Ex: Equipe de Concretagem"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm">Empresa / Empreiteira *</Label>
              <Input
                value={novaEquipeEmpresa}
                onChange={(e) => setNovaEquipeEmpresa(e.target.value)}
                placeholder="Ex: Construtora Delta Ltda"
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                className="flex-1"
                disabled={!novaEquipeNome.trim() || !novaEquipeEmpresa.trim() || createEquipeMutation.isPending}
                onClick={() => {
                  if (!novaEquipeNome.trim() || !novaEquipeEmpresa.trim()) { toast.error("Preencha todos os campos"); return; }
                  createEquipeMutation.mutate({ nome: novaEquipeNome.trim(), empresa: novaEquipeEmpresa.trim() });
                }}
              >
                {createEquipeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar e adicionar
              </Button>
              <Button type="button" variant="outline" onClick={() => { setOpenNovaEquipe(false); setNovaEquipeNome(""); setNovaEquipeEmpresa(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
