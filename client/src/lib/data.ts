// Formatação de datas segura contra fuso horário.
// As datas de diário são "date" (sem hora). Converter com new Date(x).toLocaleDateString
// no fuso do Brasil (UTC-3) recua um dia. Aqui extraímos a data-calendário diretamente.

export function fmtDataBR(val: any): string {
  if (!val) return "—";
  const s = typeof val === "string" ? val : val instanceof Date ? val.toISOString() : String(val);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// Data de hoje no calendário LOCAL no formato YYYY-MM-DD (para defaults de input date)
export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Extrai YYYY-MM-DD de um valor de data (sem deslocar o dia)
export function dataISO(val: any): string {
  if (!val) return "";
  const s = typeof val === "string" ? val : val instanceof Date ? val.toISOString() : String(val);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}
