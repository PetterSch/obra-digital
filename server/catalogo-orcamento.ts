/**
 * Catálogo base de serviços de construção civil.
 * Preços de REFERÊNCIA (R$) — aproximados de mercado/SINAPI, editáveis pelo usuário.
 * Servem como ponto de partida; o engenheiro ajusta conforme região/fonte.
 */

export interface CatalogoItem {
  categoria: string;
  descricao: string;
  unidade: string;
  precoReferencia: number;
}

export const CATALOGO_ORCAMENTO: CatalogoItem[] = [
  // ── Serviços Preliminares ──
  { categoria: "Serviços Preliminares", descricao: "Limpeza e preparação do terreno", unidade: "m²", precoReferencia: 4.50 },
  { categoria: "Serviços Preliminares", descricao: "Locação da obra (gabarito)", unidade: "m²", precoReferencia: 12.00 },
  { categoria: "Serviços Preliminares", descricao: "Tapume de madeira/chapa", unidade: "m", precoReferencia: 85.00 },
  { categoria: "Serviços Preliminares", descricao: "Barracão de obra / instalações provisórias", unidade: "m²", precoReferencia: 520.00 },
  { categoria: "Serviços Preliminares", descricao: "Ligação provisória de água e energia", unidade: "vb", precoReferencia: 1500.00 },

  // ── Fundação ──
  { categoria: "Fundação", descricao: "Escavação manual de valas", unidade: "m³", precoReferencia: 75.00 },
  { categoria: "Fundação", descricao: "Lastro de concreto magro", unidade: "m³", precoReferencia: 480.00 },
  { categoria: "Fundação", descricao: "Sapata de concreto armado", unidade: "m³", precoReferencia: 1650.00 },
  { categoria: "Fundação", descricao: "Viga baldrame de concreto armado", unidade: "m³", precoReferencia: 1750.00 },
  { categoria: "Fundação", descricao: "Estaca / broca", unidade: "m", precoReferencia: 95.00 },
  { categoria: "Fundação", descricao: "Impermeabilização de baldrame", unidade: "m²", precoReferencia: 28.00 },

  // ── Estrutura ──
  { categoria: "Estrutura", descricao: "Concreto estrutural fck 25 MPa", unidade: "m³", precoReferencia: 520.00 },
  { categoria: "Estrutura", descricao: "Fôrma de madeira para estrutura", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Estrutura", descricao: "Armação de aço CA-50", unidade: "kg", precoReferencia: 14.50 },
  { categoria: "Estrutura", descricao: "Pilar de concreto armado", unidade: "m³", precoReferencia: 1850.00 },
  { categoria: "Estrutura", descricao: "Viga de concreto armado", unidade: "m³", precoReferencia: 1800.00 },
  { categoria: "Estrutura", descricao: "Laje pré-moldada (com enchimento)", unidade: "m²", precoReferencia: 145.00 },
  { categoria: "Estrutura", descricao: "Laje maciça de concreto", unidade: "m²", precoReferencia: 185.00 },

  // ── Alvenaria ──
  { categoria: "Alvenaria", descricao: "Alvenaria de bloco cerâmico", unidade: "m²", precoReferencia: 78.00 },
  { categoria: "Alvenaria", descricao: "Alvenaria de bloco de concreto", unidade: "m²", precoReferencia: 82.00 },
  { categoria: "Alvenaria", descricao: "Verga e contraverga", unidade: "m", precoReferencia: 35.00 },
  { categoria: "Alvenaria", descricao: "Divisória drywall", unidade: "m²", precoReferencia: 110.00 },

  // ── Cobertura ──
  { categoria: "Cobertura", descricao: "Estrutura de madeira para telhado", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Cobertura", descricao: "Telha cerâmica", unidade: "m²", precoReferencia: 68.00 },
  { categoria: "Cobertura", descricao: "Telha de fibrocimento", unidade: "m²", precoReferencia: 52.00 },
  { categoria: "Cobertura", descricao: "Telha metálica / termoacústica", unidade: "m²", precoReferencia: 110.00 },
  { categoria: "Cobertura", descricao: "Calha e rufo de chapa galvanizada", unidade: "m", precoReferencia: 65.00 },
  { categoria: "Cobertura", descricao: "Forro de PVC / gesso", unidade: "m²", precoReferencia: 75.00 },

  // ── Revestimentos ──
  { categoria: "Revestimentos", descricao: "Chapisco", unidade: "m²", precoReferencia: 14.00 },
  { categoria: "Revestimentos", descricao: "Emboço / massa única", unidade: "m²", precoReferencia: 42.00 },
  { categoria: "Revestimentos", descricao: "Reboco fino", unidade: "m²", precoReferencia: 38.00 },
  { categoria: "Revestimentos", descricao: "Contrapiso", unidade: "m²", precoReferencia: 48.00 },
  { categoria: "Revestimentos", descricao: "Piso cerâmico / porcelanato", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Revestimentos", descricao: "Azulejo de parede", unidade: "m²", precoReferencia: 88.00 },
  { categoria: "Revestimentos", descricao: "Gesso liso em parede", unidade: "m²", precoReferencia: 35.00 },
  { categoria: "Revestimentos", descricao: "Rodapé", unidade: "m", precoReferencia: 22.00 },
  { categoria: "Revestimentos", descricao: "Soleira / peitoril de granito", unidade: "m", precoReferencia: 120.00 },

  // ── Pintura ──
  { categoria: "Pintura", descricao: "Massa corrida / massa acrílica", unidade: "m²", precoReferencia: 24.00 },
  { categoria: "Pintura", descricao: "Pintura látex interna", unidade: "m²", precoReferencia: 28.00 },
  { categoria: "Pintura", descricao: "Pintura acrílica externa", unidade: "m²", precoReferencia: 34.00 },
  { categoria: "Pintura", descricao: "Textura / grafiato", unidade: "m²", precoReferencia: 42.00 },
  { categoria: "Pintura", descricao: "Verniz / esmalte em madeira", unidade: "m²", precoReferencia: 38.00 },

  // ── Instalações Elétricas ──
  { categoria: "Instalações Elétricas", descricao: "Ponto de luz / tomada", unidade: "un", precoReferencia: 95.00 },
  { categoria: "Instalações Elétricas", descricao: "Quadro de distribuição", unidade: "un", precoReferencia: 650.00 },
  { categoria: "Instalações Elétricas", descricao: "Cabeamento (eletroduto + fio)", unidade: "m", precoReferencia: 18.00 },
  { categoria: "Instalações Elétricas", descricao: "Entrada de energia (padrão concessionária)", unidade: "vb", precoReferencia: 2800.00 },

  // ── Instalações Hidráulicas ──
  { categoria: "Instalações Hidráulicas", descricao: "Ponto de água fria", unidade: "un", precoReferencia: 140.00 },
  { categoria: "Instalações Hidráulicas", descricao: "Ponto de esgoto", unidade: "un", precoReferencia: 160.00 },
  { categoria: "Instalações Hidráulicas", descricao: "Caixa d'água (com instalação)", unidade: "un", precoReferencia: 1200.00 },
  { categoria: "Instalações Hidráulicas", descricao: "Tubulação de água/esgoto", unidade: "m", precoReferencia: 32.00 },

  // ── Esquadrias ──
  { categoria: "Esquadrias", descricao: "Porta interna (folha + batente)", unidade: "un", precoReferencia: 580.00 },
  { categoria: "Esquadrias", descricao: "Porta externa de segurança", unidade: "un", precoReferencia: 1450.00 },
  { categoria: "Esquadrias", descricao: "Janela de alumínio", unidade: "m²", precoReferencia: 620.00 },
  { categoria: "Esquadrias", descricao: "Portão de garagem", unidade: "m²", precoReferencia: 780.00 },

  // ── Louças e Metais ──
  { categoria: "Louças e Metais", descricao: "Vaso sanitário com caixa acoplada", unidade: "un", precoReferencia: 680.00 },
  { categoria: "Louças e Metais", descricao: "Lavatório / cuba", unidade: "un", precoReferencia: 380.00 },
  { categoria: "Louças e Metais", descricao: "Pia de cozinha (com bancada)", unidade: "un", precoReferencia: 950.00 },
  { categoria: "Louças e Metais", descricao: "Torneira / misturador", unidade: "un", precoReferencia: 220.00 },
  { categoria: "Louças e Metais", descricao: "Chuveiro / ducha", unidade: "un", precoReferencia: 180.00 },

  // ── Serviços Finais ──
  { categoria: "Serviços Finais", descricao: "Limpeza final da obra", unidade: "m²", precoReferencia: 12.00 },
  { categoria: "Serviços Finais", descricao: "Calçada / passeio externo", unidade: "m²", precoReferencia: 85.00 },
  { categoria: "Serviços Finais", descricao: "Paisagismo / jardim", unidade: "m²", precoReferencia: 65.00 },
];

// Lista de categorias na ordem de exibição
export const CATEGORIAS_ORCAMENTO = [
  "Serviços Preliminares",
  "Fundação",
  "Estrutura",
  "Alvenaria",
  "Cobertura",
  "Revestimentos",
  "Pintura",
  "Instalações Elétricas",
  "Instalações Hidráulicas",
  "Esquadrias",
  "Louças e Metais",
  "Serviços Finais",
];
