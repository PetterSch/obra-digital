import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2, ArrowLeft, FileDown, FileSpreadsheet, CalendarRange } from "lucide-react";
import * as XLSX from "xlsx";
import { getPDFConfig } from "@/lib/pdfExport";

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => { try { return new Date(s + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return s; } };

// ─── Exportações ───────────────────────────────────────────────────────────
function exportarExcel(nome: string, d: any) {
  const wb = XLSX.utils.book_new();
  // EAP
  const eap = [["Código", "Nível", "Descrição", "Responsável"],
    ...(d.eap || []).map((e: any) => [e.codigo, e.nivel, e.descricao, e.responsavel])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eap), "EAP");
  // Cronograma
  const cron = [["ID", "Atividade", "Fase", "Predecessora", "Duração (dias)", "Início", "Fim", "Crítico", "Folga"],
    ...(d.cronograma?.atividades || []).map((a: any) => [a.id, a.descricao, a.fase, a.predecessoras, a.duracaoDias, a.inicio, a.fim, a.critico ? "Sim" : "Não", a.folgaDias])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cron), "Cronograma");
  // Recursos
  const mo = [["Função", "Quantidade", "Regime", "Turnos"],
    ...(d.recursos?.maoDeObra || []).map((m: any) => [m.funcao, m.quantidade, m.regime, m.turnos])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mo), "Mão de Obra");
  const eq = [["Equipamento", "Método", "Período"],
    ...(d.recursos?.equipamentos || []).map((e: any) => [e.nome, e.metodo, e.periodo])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eq), "Equipamentos");
  // Curva S
  const cs = [["Mês", "% no mês", "% acumulado", "Valor acumulado (R$)"],
    ...(d.recursos?.curvaS || []).map((c: any) => [c.mes, c.percentualMes, c.percentualAcumulado, c.valorAcumulado])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cs), "Curva S");
  XLSX.writeFile(wb, `Planejamento_${nome.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
}

function exportarProject(nome: string, d: any) {
  // MS Project XML (MSPDI) — cronograma
  const ativs = d.cronograma?.atividades || [];
  const tasks = ativs.map((a: any, i: number) => {
    const start = a.inicio + "T08:00:00";
    const finish = a.fim + "T17:00:00";
    const horas = (a.duracaoDias || 1) * 8;
    return `    <Task>
      <UID>${i + 1}</UID>
      <ID>${i + 1}</ID>
      <Name>${String(a.descricao).replace(/[<&>]/g, "")}</Name>
      <Type>0</Type>
      <OutlineLevel>1</OutlineLevel>
      <Start>${start}</Start>
      <Finish>${finish}</Finish>
      <Duration>PT${horas}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
    </Task>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${nome}</Name>
  <Tasks>
${tasks}
  </Tasks>
</Project>`;
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `Cronograma_${nome.replace(/[^a-z0-9]/gi, "_")}.xml`;
  a.click(); URL.revokeObjectURL(url);
}

function exportarPDF(nome: string, d: any) {
  const cfg = getPDFConfig();
  const empresa = cfg.empresaNome || "Obra Digital";
  const linha = (txt: string) => `<div style="white-space:pre-wrap;font-size:11px;line-height:1.6;color:#1a1a1a">${txt || "—"}</div>`;
  const tabela = (cols: string[], rows: any[][]) => `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:6px">
    <thead><tr>${cols.map(c => `<th style="background:#1e3a5f;color:#fff;padding:5px;text-align:left">${c}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:5px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const sec = (titulo: string, corpo: string) => `<div style="margin-bottom:18px"><h2 style="font-size:14px;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:3px;margin-bottom:8px">${titulo}</h2>${corpo}</div>`;

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Planejamento ${nome}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a}
  h1{color:#1e3a5f;font-size:22px}@page{margin:1.5cm}</style></head><body>
  <div style="border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:18px">
    <div style="font-size:11px;color:#B45309;font-weight:700">${empresa}</div>
    <h1>Planejamento de Obra</h1><div style="color:#666;font-size:12px">${nome}</div>
  </div>
  ${sec("Resumo Executivo", linha(d.resumoExecutivo))}
  ${sec("1. EAP — Estrutura Analítica do Projeto", tabela(["Código", "Descrição", "Responsável"], (d.eap || []).map((e: any) => [e.codigo, (e.nivel === 1 ? "<b>" + e.descricao + "</b>" : "&nbsp;&nbsp;" + e.descricao), e.responsavel])))}
  ${sec("2. Cronograma de Obras", tabela(["ID", "Atividade", "Fase", "Dur.", "Início", "Fim"], (d.cronograma?.atividades || []).map((a: any) => [a.id, a.descricao, a.fase, a.duracaoDias + "d", fmtData(a.inicio), fmtData(a.fim)]))
    + "<p style='font-size:10px;margin-top:6px'><b>Marcos:</b> " + (d.cronograma?.marcos || []).map((m: any) => `${m.descricao} (${fmtData(m.data)})`).join(" · ") + "</p>")}
  ${sec("3. Planejamento de Recursos", tabela(["Função", "Qtd", "Regime", "Turnos"], (d.recursos?.maoDeObra || []).map((m: any) => [m.funcao, m.quantidade, m.regime, m.turnos]))
    + tabela(["Equipamento", "Método", "Período"], (d.recursos?.equipamentos || []).map((e: any) => [e.nome, e.metodo, e.periodo]))
    + (d.recursos?.curvaS?.length ? "<p style='font-size:11px;margin-top:8px;font-weight:600'>Curva S de desembolso</p>" + tabela(["Mês", "% mês", "% acum.", "Acumulado"], d.recursos.curvaS.map((c: any) => [c.mes, c.percentualMes + "%", c.percentualAcumulado + "%", brl(c.valorAcumulado)])) : ""))}
  ${sec("4. Suprimentos e Compras", linha(d.suprimentos))}
  ${sec("5. Plano de Qualidade", linha(d.qualidade))}
  ${sec("6. Saúde, Segurança e Medicina do Trabalho", linha(d.ssmt))}
  ${sec("7. Plano Ambiental e Resíduos (PGRCC)", linha(d.ambiental))}
  ${sec("8. Mobilização e Canteiro de Obras", linha(d.canteiro))}
  ${sec("9. Linha de Base, Indicadores e Controle", linha(d.controle))}
  ${sec("10. Riscos e Plano de Contingência", linha(d.riscos))}
  <script>window.onload=()=>window.print();window.onafterprint=()=>window.close();</script></body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Permita pop-ups para exportar PDF"); return; }
  w.document.write(html); w.document.close();
}

// ─── Editor ──────────────────────────────────────────────────────────────
function Editor({ id, onBack }: { id: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.planejamento.getById.useQuery({ id });
  const [dados, setDados] = useState<any>(null);
  const save = trpc.planejamento.updateDados.useMutation({
    onSuccess: () => { toast.success("Planejamento salvo!"); utils.planejamento.getById.invalidate({ id }); },
  });

  useEffect(() => { if (data?.dados) setDados(data.dados); }, [data]);

  if (isLoading || !dados) return <div className="flex justify-center py-10"><Spinner /></div>;
  const nome = data?.nome || "Planejamento";
  const setTexto = (campo: string, v: string) => setDados((p: any) => ({ ...p, [campo]: v }));

  const secoesTexto: [string, string, string][] = [
    ["suprimentos", "4. Suprimentos e Compras", dados.suprimentos],
    ["qualidade", "5. Plano de Qualidade", dados.qualidade],
    ["ssmt", "6. SSMT (Segurança)", dados.ssmt],
    ["ambiental", "7. Ambiental / Resíduos", dados.ambiental],
    ["canteiro", "8. Mobilização e Canteiro", dados.canteiro],
    ["controle", "9. Indicadores e Controle", dados.controle],
    ["riscos", "10. Riscos e Contingência", dados.riscos],
  ];

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">{nome}</h3>
          <p className="text-sm text-muted-foreground">Prazo estimado: {dados.prazoTotalDias} dias · {dados.cronograma?.atividades?.length || 0} atividades</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarPDF(nome, dados)}><FileDown className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarExcel(nome, dados)}><FileSpreadsheet className="w-4 h-4" /> Excel</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportarProject(nome, dados)}><CalendarRange className="w-4 h-4" /> Project</Button>
          <Button size="sm" onClick={() => save.mutate({ id, dados })} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="eap" className="text-xs">EAP</TabsTrigger>
          <TabsTrigger value="cronograma" className="text-xs">Cronograma</TabsTrigger>
          <TabsTrigger value="recursos" className="text-xs">Recursos</TabsTrigger>
          <TabsTrigger value="textos" className="text-xs">Planos (4-10)</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4">
          <Card><CardContent className="py-4">
            <Textarea className="min-h-[300px] font-mono text-xs" value={dados.resumoExecutivo}
              onChange={e => setTexto("resumoExecutivo", e.target.value)} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="eap" className="mt-4">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="text-left p-2 pl-4 w-20">Código</th><th className="text-left p-2">Descrição</th><th className="text-left p-2 w-40">Responsável</th>
              </tr></thead>
              <tbody>
                {(dados.eap || []).map((e: any, i: number) => (
                  <tr key={i} className={`border-b last:border-0 ${e.nivel === 1 ? "bg-primary/5 font-semibold" : ""}`}>
                    <td className="p-2 pl-4">{e.codigo}</td>
                    <td className="p-2" style={{ paddingLeft: e.nivel === 1 ? 8 : 28 }}>{e.descricao}</td>
                    <td className="p-2 text-muted-foreground">{e.responsavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cronograma" className="mt-4 space-y-3">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="text-left p-2 pl-4">ID</th><th className="text-left p-2">Atividade</th><th className="text-left p-2">Fase</th>
                <th className="text-center p-2">Dur.</th><th className="text-left p-2">Início</th><th className="text-left p-2">Fim</th>
              </tr></thead>
              <tbody>
                {(dados.cronograma?.atividades || []).map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-2 pl-4">{a.id}</td>
                    <td className="p-2">{a.descricao}</td>
                    <td className="p-2"><Badge variant="secondary" className="text-xs">{a.fase}</Badge></td>
                    <td className="text-center p-2">{a.duracaoDias}d</td>
                    <td className="p-2">{fmtData(a.inicio)}</td>
                    <td className="p-2">{fmtData(a.fim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          {dados.cronograma?.marcos?.length > 0 && (
            <Card><CardContent className="py-3">
              <p className="text-sm font-medium mb-2">Marcos contratuais</p>
              <div className="flex flex-wrap gap-2">
                {dados.cronograma.marcos.map((m: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{m.descricao}: {fmtData(m.data)}</Badge>
                ))}
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="recursos" className="mt-4 space-y-3">
          <Card><CardContent className="p-0 overflow-x-auto">
            <p className="text-sm font-medium p-3 pb-1">Mão de obra</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-4">Função</th><th className="text-center p-2">Qtd</th><th className="text-left p-2">Regime</th><th className="text-left p-2">Turnos</th></tr></thead>
              <tbody>{(dados.recursos?.maoDeObra || []).map((m: any, i: number) => (
                <tr key={i} className="border-b last:border-0"><td className="p-2 pl-4">{m.funcao}</td><td className="text-center p-2">{m.quantidade}</td><td className="p-2">{m.regime}</td><td className="p-2 text-muted-foreground">{m.turnos}</td></tr>
              ))}</tbody>
            </table>
          </CardContent></Card>
          <Card><CardContent className="p-0 overflow-x-auto">
            <p className="text-sm font-medium p-3 pb-1">Equipamentos</p>
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-4">Equipamento</th><th className="text-left p-2">Método</th><th className="text-left p-2">Período</th></tr></thead>
              <tbody>{(dados.recursos?.equipamentos || []).map((e: any, i: number) => (
                <tr key={i} className="border-b last:border-0"><td className="p-2 pl-4">{e.nome}</td><td className="p-2">{e.metodo}</td><td className="p-2 text-muted-foreground">{e.periodo}</td></tr>
              ))}</tbody>
            </table>
          </CardContent></Card>
          {dados.recursos?.curvaS?.length > 0 && (
            <Card><CardContent className="p-0 overflow-x-auto">
              <p className="text-sm font-medium p-3 pb-1">Curva S de desembolso</p>
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/40 text-xs uppercase text-muted-foreground"><th className="text-left p-2 pl-4">Mês</th><th className="text-right p-2">% mês</th><th className="text-right p-2">% acum.</th><th className="text-right p-2 pr-4">Acumulado</th></tr></thead>
                <tbody>{dados.recursos.curvaS.map((c: any, i: number) => (
                  <tr key={i} className="border-b last:border-0"><td className="p-2 pl-4">{c.mes}</td><td className="text-right p-2">{c.percentualMes}%</td><td className="text-right p-2">{c.percentualAcumulado}%</td><td className="text-right p-2 pr-4 font-medium">{brl(c.valorAcumulado)}</td></tr>
                ))}</tbody>
              </table>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="textos" className="mt-4 space-y-4">
          {secoesTexto.map(([campo, titulo, valor]) => (
            <Card key={campo}><CardContent className="py-4">
              <p className="text-sm font-semibold mb-2">{titulo}</p>
              <Textarea className="min-h-[160px] font-mono text-xs" value={valor}
                onChange={e => setTexto(campo, e.target.value)} />
            </CardContent></Card>
          ))}
          <p className="text-xs text-muted-foreground">Edite os textos conforme a obra e clique em "Salvar" no topo.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Modal criar ───────────────────────────────────────────────────────────
function NovoModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const { data: orcamentos = [] } = trpc.planejamento.orcamentosDisponiveis.useQuery(undefined, { enabled: open });
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split("T")[0]);
  const [origem, setOrigem] = useState<"orcamento" | "branco">("orcamento");
  const [orcamentoId, setOrcamentoId] = useState<string>("");

  const createMut = trpc.planejamento.create.useMutation({
    onSuccess: (r: any) => { toast.success("Planejamento criado!"); onCreated(r.id); reset(); },
    onError: (e) => toast.error(e.message || "Erro ao criar"),
  });
  const reset = () => { setNome(""); setOrigem("orcamento"); setOrcamentoId(""); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Planejamento</DialogTitle>
          <DialogDescription>Crie a partir de um orçamento pronto ou em branco.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do planejamento *</Label>
            <Input placeholder="Ex: Planejamento Residência Silva" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Base do planejamento</Label>
            <Select value={origem} onValueChange={v => setOrigem(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="orcamento">📋 A partir de um orçamento pronto</SelectItem>
                <SelectItem value="branco">📄 Começar em branco</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {origem === "orcamento" && (
            <div className="space-y-1.5">
              <Label>Orçamento *</Label>
              {orcamentos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground bg-muted/30">
                  Nenhum orçamento cadastrado ainda. Vá em <strong>Orçamentos → Novo Orçamento</strong>, crie e salve um orçamento — depois ele aparecerá aqui. Ou escolha <strong>"Começar em branco"</strong> acima.
                </div>
              ) : (
                <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o orçamento" /></SelectTrigger>
                  <SelectContent>
                    {(orcamentos as any[]).map(o => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.nome}{o.clienteNome ? ` — ${o.clienteNome}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={createMut.isPending || !nome || (origem === "orcamento" && !orcamentoId)}
              onClick={() => createMut.mutate({ nome, dataInicio, orcamentoId: origem === "orcamento" ? parseInt(orcamentoId) : undefined })}>
              {createMut.isPending ? "Gerando..." : "Criar planejamento"}
            </Button>
            <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────
export default function Planejamento() {
  const [sel, setSel] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const { data: lista = [], isLoading, refetch } = trpc.planejamento.list.useQuery();
  const delMut = trpc.planejamento.delete.useMutation({ onSuccess: () => { toast.success("Excluído"); refetch(); } });

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        {sel ? (
          <Editor id={sel} onBack={() => { setSel(null); refetch(); }} />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ClipboardList className="w-6 h-6 text-primary" /> Planejamento</h1>
                <p className="text-muted-foreground mt-1">Planeje a obra a partir de um orçamento pronto ou do zero</p>
              </div>
              <Button className="gap-2 self-start sm:self-auto" onClick={() => setModal(true)}><Plus className="w-4 h-4" /> Novo Planejamento</Button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (lista as any[]).length === 0 ? (
              <Card><CardContent className="py-12 text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground mb-4">Nenhum planejamento criado ainda</p>
                <Button onClick={() => setModal(true)} className="gap-2"><Plus className="w-4 h-4" /> Criar primeiro planejamento</Button>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {(lista as any[]).map(p => (
                  <Card key={p.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setSel(p.id)}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-sm text-muted-foreground">Início: {p.dataInicio ? fmtData(p.dataInicio) : "—"}{p.orcamentoId ? " · gerado de orçamento" : " · em branco"}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${p.nome}"?`)) delMut.mutate({ id: p.id }); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <NovoModal open={modal} onClose={() => setModal(false)} onCreated={(id) => { setModal(false); refetch(); setSel(id); }} />
    </DashboardLayout>
  );
}
