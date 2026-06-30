/**
 * Lógica pura (sem I/O) das Ordens de Compra.
 * Mantida isolada para ser facilmente testável e reutilizável entre
 * frontend (resumo/total na tela) e backend (geração das OCs).
 */

export type ItemSelecionadoOC = {
  mapaItemId: number;
  mapaId: number;
  mapaFornecedorId: number;
  fornecedorNome: string;
  descricao: string;
  unidade?: string | null;
  quantidade: number;
  valorUnitario: number;
};

export type GrupoFornecedorOC = {
  fornecedorNome: string;
  itens: ItemSelecionadoOC[];
  /** mapas distintos de onde vieram os itens (para somar fretes) */
  mapaIds: number[];
};

/**
 * Agrupa os itens selecionados por fornecedor escolhido.
 * Cada grupo vira uma OC separada — nunca mistura fornecedores numa mesma OC.
 * Função pura: recebe a lista de itens, retorna a lista de grupos.
 */
export function agruparItensPorFornecedor(itens: ItemSelecionadoOC[]): GrupoFornecedorOC[] {
  const grupos = new Map<string, GrupoFornecedorOC>();
  for (const it of itens) {
    const chave = (it.fornecedorNome ?? "").trim().toLowerCase();
    let g = grupos.get(chave);
    if (!g) {
      g = { fornecedorNome: it.fornecedorNome, itens: [], mapaIds: [] };
      grupos.set(chave, g);
    }
    g.itens.push(it);
    if (!g.mapaIds.includes(it.mapaId)) g.mapaIds.push(it.mapaId);
  }
  return Array.from(grupos.values());
}

/** Soma dos itens (quantidade × valor unitário). */
export function totalItensOC(itens: { quantidade: number; valorUnitario: number }[]): number {
  return itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0);
}

/** Valor total da OC = soma dos itens + frete. */
export function totalOC(itens: { quantidade: number; valorUnitario: number }[], frete: number): number {
  return totalItensOC(itens) + (Number(frete) || 0);
}

/**
 * Próximo número sequencial global, iniciando em 1.
 * Recebe os números já existentes, retorna o maior + 1.
 */
export function proximoNumeroOC(numerosExistentes: number[]): number {
  const max = numerosExistentes.reduce((m, n) => Math.max(m, Number(n) || 0), 0);
  return max + 1;
}

/** Formata o número da OC com 2 dígitos (01, 02, ... 10, 11). */
export function formatNumeroOC(n: number): string {
  return String(n).padStart(2, "0");
}

/** Nome do arquivo do PDF: OC-{numero}-{obra}.pdf */
export function nomeArquivoOC(numero: number, obra: string): string {
  const slugObra = (obra ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")     // remove acentos
    .replace(/[^a-zA-Z0-9]+/g, "-")      // não-alfanumérico vira hífen
    .replace(/^-+|-+$/g, "")             // tira hífens das pontas
    .toUpperCase();
  return `OC-${formatNumeroOC(numero)}-${slugObra || "OBRA"}.pdf`;
}
