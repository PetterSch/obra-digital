import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, CalendarCheck, Users, UserCheck } from "lucide-react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const z2 = (n: number) => String(n).padStart(2, "0");

export default function Presenca() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/obras/:obraId/presenca");
  const obraId = params?.obraId ? parseInt(params.obraId) : null;
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1); // 1-12
  const [equipeSel, setEquipeSel] = useState<string>("");
  const [operarioSel, setOperarioSel] = useState<string>("");

  const { data: obra } = trpc.obras.getById.useQuery({ id: obraId! }, { enabled: !!obraId });
  const { data, isLoading } = trpc.presenca.calendario.useQuery({ obraId: obraId!, ano, mes }, { enabled: !!obraId });

  const equipes = (data?.equipes || []) as any[];
  const dias = (data?.dias || []) as any[];
  const equipeAtual = equipes.find((e) => String(e.id) === equipeSel);
  const operarios = equipeAtual?.colaboradores || [];

  const mudarMes = (delta: number) => {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMes(m); setAno(a);
  };

  // Média de presença por equipe (média de presentes nos dias em que a equipe teve registro)
  const mediaEquipe = (eqId: number) => {
    const diasEq = dias.filter((d) => d.porEquipe[eqId]);
    if (!diasEq.length) return 0;
    return diasEq.reduce((s, d) => s + d.porEquipe[eqId].presentes, 0) / diasEq.length;
  };

  // Monta a grade do calendário
  const primeiroDia = new Date(ano, mes - 1, 1).getDay(); // 0=Dom
  const totalDias = new Date(ano, mes, 0).getDate();
  const celulas: (number | null)[] = [];
  for (let i = 0; i < primeiroDia; i++) celulas.push(null);
  for (let d = 1; d <= totalDias; d++) celulas.push(d);

  const diaPresente = (dia: number): { presente: boolean; qtd: number } => {
    if (!equipeSel) return { presente: false, qtd: 0 };
    const dataStr = `${ano}-${z2(mes)}-${z2(dia)}`;
    const reg = dias.find((d) => d.data === dataStr);
    const pe = reg?.porEquipe?.[Number(equipeSel)];
    if (!pe) return { presente: false, qtd: 0 };
    if (operarioSel) {
      return { presente: pe.operarios.includes(Number(operarioSel)), qtd: 1 };
    }
    return { presente: pe.presentes > 0, qtd: pe.presentes };
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        <PageHeader
          breadcrumb={[{ label: "Obras", href: "/obras" }, { label: obra?.nome || "Obra", href: `/obras/${obraId}` }, { label: "Calendário de Presença" }]}
          title="Calendário de Presença"
          description="Média e dias de presença das equipes por mês"
          icon={CalendarCheck}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="font-medium min-w-[140px] text-center">{MESES[mes - 1]} / {ano}</span>
              <Button variant="outline" size="icon" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : equipes.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Nenhum registro de presença neste mês.
          </CardContent></Card>
        ) : (
          <>
            {/* Médias por equipe */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipes.map((e) => {
                const media = mediaEquipe(e.id);
                return (
                  <StatCard
                    key={e.id}
                    label={e.nome}
                    value={`${media.toFixed(1).replace(".0", "")} de ${e.totalColaboradores}`}
                    icon={UserCheck}
                    tone={equipeSel === String(e.id) ? "green" : "neutral"}
                    hint={`Média de presença · ${e.empresa || ""}`}
                    onClick={() => { setEquipeSel(String(e.id)); setOperarioSel(""); }}
                  />
                );
              })}
            </div>

            {/* Filtros */}
            <Card><CardContent className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Equipe</label>
                  <Select value={equipeSel} onValueChange={(v) => { setEquipeSel(v); setOperarioSel(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma equipe" /></SelectTrigger>
                    <SelectContent>
                      {equipes.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Funcionário (opcional)</label>
                  <Select value={operarioSel || "__all"} onValueChange={(v) => setOperarioSel(v === "__all" ? "" : v)} disabled={!equipeSel}>
                    <SelectTrigger><SelectValue placeholder="Toda a equipe" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Toda a equipe</SelectItem>
                      {operarios.map((o: any) => <SelectItem key={o.id} value={String(o.id)}>{o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent></Card>

            {/* Calendário */}
            <Card><CardContent className="py-4">
              {!equipeSel ? (
                <p className="text-sm text-muted-foreground text-center py-8">Selecione uma equipe (acima ou nos cartões) para ver os dias de presença.</p>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {DIAS_SEMANA.map((d) => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {celulas.map((dia, i) => {
                      if (dia === null) return <div key={i} />;
                      const { presente, qtd } = diaPresente(dia);
                      return (
                        <div key={i} className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-sm ${presente ? "bg-emerald-500 text-white border-emerald-600 font-semibold" : "bg-muted/30 text-muted-foreground"}`}>
                          <span>{dia}</span>
                          {presente && !operarioSel && <span className="text-[10px] opacity-90">{qtd}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-500" /> {operarioSel ? "Operário presente" : "Equipe presente (nº = presentes)"}</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-muted" /> Sem registro</span>
                  </div>
                </>
              )}
            </CardContent></Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
