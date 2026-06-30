import { describe, it, expect } from "vitest";
import {
  agruparItensPorFornecedor,
  totalItensOC,
  totalOC,
  proximoNumeroOC,
  formatNumeroOC,
  nomeArquivoOC,
  type ItemSelecionadoOC,
} from "@shared/ordensCompra";

function item(p: Partial<ItemSelecionadoOC>): ItemSelecionadoOC {
  return {
    mapaItemId: 1, mapaId: 1, mapaFornecedorId: 1, fornecedorNome: "Atlas",
    descricao: "Cimento", unidade: "sc", quantidade: 1, valorUnitario: 10, ...p,
  };
}

describe("agruparItensPorFornecedor", () => {
  it("agrupa itens do mesmo fornecedor numa OC só", () => {
    const grupos = agruparItensPorFornecedor([
      item({ mapaItemId: 1, fornecedorNome: "Atlas" }),
      item({ mapaItemId: 2, fornecedorNome: "Atlas" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].itens).toHaveLength(2);
  });

  it("gera um grupo por fornecedor distinto", () => {
    const grupos = agruparItensPorFornecedor([
      item({ mapaItemId: 1, fornecedorNome: "Atlas" }),
      item({ mapaItemId: 2, fornecedorNome: "Tijolão" }),
    ]);
    expect(grupos).toHaveLength(2);
  });

  it("trata o nome do fornecedor ignorando caixa e espaços", () => {
    const grupos = agruparItensPorFornecedor([
      item({ mapaItemId: 1, fornecedorNome: "Atlas" }),
      item({ mapaItemId: 2, fornecedorNome: "  atlas " }),
    ]);
    expect(grupos).toHaveLength(1);
  });

  it("coleta os mapas distintos de cada grupo (para somar fretes)", () => {
    const grupos = agruparItensPorFornecedor([
      item({ mapaItemId: 1, mapaId: 10, fornecedorNome: "Atlas" }),
      item({ mapaItemId: 2, mapaId: 20, fornecedorNome: "Atlas" }),
      item({ mapaItemId: 3, mapaId: 10, fornecedorNome: "Atlas" }),
    ]);
    expect(grupos[0].mapaIds.sort()).toEqual([10, 20]);
  });
});

describe("totais", () => {
  it("soma itens por quantidade × valor unitário", () => {
    expect(totalItensOC([
      { quantidade: 2, valorUnitario: 10 },
      { quantidade: 3, valorUnitario: 5 },
    ])).toBe(35);
  });

  it("total da OC inclui o frete", () => {
    expect(totalOC([{ quantidade: 2, valorUnitario: 10 }], 15)).toBe(35);
  });

  it("total da OC trata frete ausente como zero", () => {
    expect(totalOC([{ quantidade: 1, valorUnitario: 10 }], undefined as any)).toBe(10);
  });
});

describe("numeração", () => {
  it("começa em 1 quando não há OCs", () => {
    expect(proximoNumeroOC([])).toBe(1);
  });

  it("retorna o maior + 1", () => {
    expect(proximoNumeroOC([1, 2, 5])).toBe(6);
  });

  it("formata com 2 dígitos", () => {
    expect(formatNumeroOC(1)).toBe("01");
    expect(formatNumeroOC(12)).toBe("12");
  });
});

describe("nomeArquivoOC", () => {
  it("monta OC-{numero}-{obra}.pdf com obra normalizada", () => {
    expect(nomeArquivoOC(1, "Essence 360")).toBe("OC-01-ESSENCE-360.pdf");
  });

  it("remove acentos e caracteres especiais", () => {
    expect(nomeArquivoOC(3, "Edifício Itatiaia (Papelão)")).toBe("OC-03-EDIFICIO-ITATIAIA-PAPELAO.pdf");
  });
});
