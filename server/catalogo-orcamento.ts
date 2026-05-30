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
  { categoria: "Serviços Preliminares", descricao: "Demolição de construção existente", unidade: "m²", precoReferencia: 65.00 },
  { categoria: "Serviços Preliminares", descricao: "Locação da obra (gabarito)", unidade: "m²", precoReferencia: 12.00 },
  { categoria: "Serviços Preliminares", descricao: "Tapume de madeira/chapa", unidade: "m", precoReferencia: 85.00 },
  { categoria: "Serviços Preliminares", descricao: "Barracão de obra / instalações provisórias", unidade: "m²", precoReferencia: 520.00 },
  { categoria: "Serviços Preliminares", descricao: "Ligação provisória de água e energia", unidade: "vb", precoReferencia: 1500.00 },
  { categoria: "Serviços Preliminares", descricao: "Placa de obra", unidade: "m²", precoReferencia: 320.00 },
  { categoria: "Serviços Preliminares", descricao: "Aluguel de container/escritório", unidade: "mês", precoReferencia: 950.00 },

  // ── Terraplenagem / Movimentação de Terra ──
  { categoria: "Terraplenagem", descricao: "Escavação mecanizada", unidade: "m³", precoReferencia: 28.00 },
  { categoria: "Terraplenagem", descricao: "Aterro compactado", unidade: "m³", precoReferencia: 45.00 },
  { categoria: "Terraplenagem", descricao: "Corte e nivelamento de terreno", unidade: "m²", precoReferencia: 18.00 },
  { categoria: "Terraplenagem", descricao: "Carga, transporte e bota-fora", unidade: "m³", precoReferencia: 55.00 },
  { categoria: "Terraplenagem", descricao: "Compactação de solo", unidade: "m²", precoReferencia: 14.00 },
  { categoria: "Terraplenagem", descricao: "Muro de arrimo (concreto armado)", unidade: "m²", precoReferencia: 480.00 },

  // ── Fundação ──
  { categoria: "Fundação", descricao: "Escavação manual de valas", unidade: "m³", precoReferencia: 75.00 },
  { categoria: "Fundação", descricao: "Lastro de concreto magro", unidade: "m³", precoReferencia: 480.00 },
  { categoria: "Fundação", descricao: "Sapata de concreto armado", unidade: "m³", precoReferencia: 1650.00 },
  { categoria: "Fundação", descricao: "Bloco de coroamento", unidade: "m³", precoReferencia: 1700.00 },
  { categoria: "Fundação", descricao: "Viga baldrame de concreto armado", unidade: "m³", precoReferencia: 1750.00 },
  { categoria: "Fundação", descricao: "Estaca escavada / broca", unidade: "m", precoReferencia: 95.00 },
  { categoria: "Fundação", descricao: "Estaca hélice contínua", unidade: "m", precoReferencia: 140.00 },
  { categoria: "Fundação", descricao: "Radier de concreto armado", unidade: "m²", precoReferencia: 220.00 },
  { categoria: "Fundação", descricao: "Impermeabilização de baldrame", unidade: "m²", precoReferencia: 28.00 },

  // ── Estrutura ──
  { categoria: "Estrutura", descricao: "Concreto estrutural fck 25 MPa", unidade: "m³", precoReferencia: 520.00 },
  { categoria: "Estrutura", descricao: "Concreto usinado bombeado", unidade: "m³", precoReferencia: 560.00 },
  { categoria: "Estrutura", descricao: "Fôrma de madeira para estrutura", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Estrutura", descricao: "Armação de aço CA-50", unidade: "kg", precoReferencia: 14.50 },
  { categoria: "Estrutura", descricao: "Pilar de concreto armado", unidade: "m³", precoReferencia: 1850.00 },
  { categoria: "Estrutura", descricao: "Viga de concreto armado", unidade: "m³", precoReferencia: 1800.00 },
  { categoria: "Estrutura", descricao: "Laje pré-moldada (com enchimento)", unidade: "m²", precoReferencia: 145.00 },
  { categoria: "Estrutura", descricao: "Laje maciça de concreto", unidade: "m²", precoReferencia: 185.00 },
  { categoria: "Estrutura", descricao: "Laje nervurada", unidade: "m²", precoReferencia: 210.00 },
  { categoria: "Estrutura", descricao: "Escada de concreto armado", unidade: "m³", precoReferencia: 1950.00 },
  { categoria: "Estrutura", descricao: "Estrutura metálica", unidade: "kg", precoReferencia: 22.00 },

  // ── Alvenaria e Vedação ──
  { categoria: "Alvenaria e Vedação", descricao: "Alvenaria de bloco cerâmico", unidade: "m²", precoReferencia: 78.00 },
  { categoria: "Alvenaria e Vedação", descricao: "Alvenaria de bloco de concreto", unidade: "m²", precoReferencia: 82.00 },
  { categoria: "Alvenaria e Vedação", descricao: "Alvenaria de tijolo maciço", unidade: "m²", precoReferencia: 110.00 },
  { categoria: "Alvenaria e Vedação", descricao: "Verga e contraverga", unidade: "m", precoReferencia: 35.00 },
  { categoria: "Alvenaria e Vedação", descricao: "Divisória drywall", unidade: "m²", precoReferencia: 110.00 },
  { categoria: "Alvenaria e Vedação", descricao: "Parede de concreto", unidade: "m²", precoReferencia: 165.00 },

  // ── Cobertura ──
  { categoria: "Cobertura", descricao: "Estrutura de madeira para telhado", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Cobertura", descricao: "Estrutura metálica para telhado", unidade: "m²", precoReferencia: 120.00 },
  { categoria: "Cobertura", descricao: "Telha cerâmica", unidade: "m²", precoReferencia: 68.00 },
  { categoria: "Cobertura", descricao: "Telha de fibrocimento", unidade: "m²", precoReferencia: 52.00 },
  { categoria: "Cobertura", descricao: "Telha metálica / termoacústica", unidade: "m²", precoReferencia: 110.00 },
  { categoria: "Cobertura", descricao: "Telha de concreto", unidade: "m²", precoReferencia: 75.00 },
  { categoria: "Cobertura", descricao: "Laje impermeabilizada (cobertura plana)", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Cobertura", descricao: "Calha e rufo de chapa galvanizada", unidade: "m", precoReferencia: 65.00 },
  { categoria: "Cobertura", descricao: "Domus / clarabóia", unidade: "un", precoReferencia: 850.00 },

  // ── Impermeabilização ──
  { categoria: "Impermeabilização", descricao: "Manta asfáltica", unidade: "m²", precoReferencia: 75.00 },
  { categoria: "Impermeabilização", descricao: "Impermeabilização com argamassa polimérica", unidade: "m²", precoReferencia: 48.00 },
  { categoria: "Impermeabilização", descricao: "Impermeabilização de box/banheiro", unidade: "m²", precoReferencia: 55.00 },
  { categoria: "Impermeabilização", descricao: "Impermeabilização de laje/terraço", unidade: "m²", precoReferencia: 85.00 },
  { categoria: "Impermeabilização", descricao: "Manta líquida (poliuretano)", unidade: "m²", precoReferencia: 62.00 },

  // ── Revestimentos de Parede ──
  { categoria: "Revestimentos de Parede", descricao: "Chapisco", unidade: "m²", precoReferencia: 14.00 },
  { categoria: "Revestimentos de Parede", descricao: "Emboço / massa única", unidade: "m²", precoReferencia: 42.00 },
  { categoria: "Revestimentos de Parede", descricao: "Reboco fino", unidade: "m²", precoReferencia: 38.00 },
  { categoria: "Revestimentos de Parede", descricao: "Azulejo de parede", unidade: "m²", precoReferencia: 88.00 },
  { categoria: "Revestimentos de Parede", descricao: "Revestimento porcelanato parede", unidade: "m²", precoReferencia: 125.00 },
  { categoria: "Revestimentos de Parede", descricao: "Pastilha / mosaico", unidade: "m²", precoReferencia: 145.00 },
  { categoria: "Revestimentos de Parede", descricao: "Revestimento de pedra natural", unidade: "m²", precoReferencia: 180.00 },
  { categoria: "Revestimentos de Parede", descricao: "Gesso liso em parede", unidade: "m²", precoReferencia: 35.00 },

  // ── Revestimentos de Piso ──
  { categoria: "Revestimentos de Piso", descricao: "Contrapiso", unidade: "m²", precoReferencia: 48.00 },
  { categoria: "Revestimentos de Piso", descricao: "Piso cerâmico", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Revestimentos de Piso", descricao: "Porcelanato", unidade: "m²", precoReferencia: 135.00 },
  { categoria: "Revestimentos de Piso", descricao: "Piso vinílico / laminado", unidade: "m²", precoReferencia: 110.00 },
  { categoria: "Revestimentos de Piso", descricao: "Piso de madeira / deck", unidade: "m²", precoReferencia: 220.00 },
  { categoria: "Revestimentos de Piso", descricao: "Piso de granito / mármore", unidade: "m²", precoReferencia: 280.00 },
  { categoria: "Revestimentos de Piso", descricao: "Piso industrial / concreto polido", unidade: "m²", precoReferencia: 85.00 },
  { categoria: "Revestimentos de Piso", descricao: "Rodapé", unidade: "m", precoReferencia: 22.00 },
  { categoria: "Revestimentos de Piso", descricao: "Soleira / peitoril de granito", unidade: "m", precoReferencia: 120.00 },

  // ── Forros ──
  { categoria: "Forros", descricao: "Forro de gesso liso", unidade: "m²", precoReferencia: 75.00 },
  { categoria: "Forros", descricao: "Forro de drywall", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Forros", descricao: "Forro de PVC", unidade: "m²", precoReferencia: 68.00 },
  { categoria: "Forros", descricao: "Forro mineral / modular", unidade: "m²", precoReferencia: 85.00 },
  { categoria: "Forros", descricao: "Sanca de gesso", unidade: "m", precoReferencia: 55.00 },

  // ── Pintura ──
  { categoria: "Pintura", descricao: "Massa corrida / massa acrílica", unidade: "m²", precoReferencia: 24.00 },
  { categoria: "Pintura", descricao: "Selador / fundo preparador", unidade: "m²", precoReferencia: 12.00 },
  { categoria: "Pintura", descricao: "Pintura látex interna", unidade: "m²", precoReferencia: 28.00 },
  { categoria: "Pintura", descricao: "Pintura acrílica externa", unidade: "m²", precoReferencia: 34.00 },
  { categoria: "Pintura", descricao: "Textura / grafiato", unidade: "m²", precoReferencia: 42.00 },
  { categoria: "Pintura", descricao: "Verniz / esmalte em madeira", unidade: "m²", precoReferencia: 38.00 },
  { categoria: "Pintura", descricao: "Pintura epóxi (piso/parede)", unidade: "m²", precoReferencia: 65.00 },
  { categoria: "Pintura", descricao: "Pintura de esquadrias metálicas", unidade: "m²", precoReferencia: 45.00 },

  // ── Esquadrias de Madeira ──
  { categoria: "Esquadrias de Madeira", descricao: "Porta interna (folha + batente)", unidade: "un", precoReferencia: 580.00 },
  { categoria: "Esquadrias de Madeira", descricao: "Porta pivotante de madeira", unidade: "un", precoReferencia: 2200.00 },
  { categoria: "Esquadrias de Madeira", descricao: "Porta de correr embutida", unidade: "un", precoReferencia: 1350.00 },
  { categoria: "Esquadrias de Madeira", descricao: "Guarnição / alizar", unidade: "m", precoReferencia: 28.00 },
  { categoria: "Esquadrias de Madeira", descricao: "Ferragens (dobradiça, fechadura)", unidade: "cj", precoReferencia: 180.00 },

  // ── Esquadrias de Alumínio / Metálicas ──
  { categoria: "Esquadrias de Alumínio", descricao: "Janela de alumínio", unidade: "m²", precoReferencia: 620.00 },
  { categoria: "Esquadrias de Alumínio", descricao: "Porta de alumínio", unidade: "m²", precoReferencia: 720.00 },
  { categoria: "Esquadrias de Alumínio", descricao: "Porta de vidro temperado", unidade: "m²", precoReferencia: 850.00 },
  { categoria: "Esquadrias de Alumínio", descricao: "Porta externa de segurança (aço)", unidade: "un", precoReferencia: 1450.00 },
  { categoria: "Esquadrias de Alumínio", descricao: "Portão de garagem basculante", unidade: "m²", precoReferencia: 780.00 },
  { categoria: "Esquadrias de Alumínio", descricao: "Portão de correr automatizado", unidade: "m²", precoReferencia: 1100.00 },
  { categoria: "Esquadrias de Alumínio", descricao: "Guarda-corpo metálico", unidade: "m", precoReferencia: 380.00 },

  // ── Vidros ──
  { categoria: "Vidros", descricao: "Vidro temperado 8mm", unidade: "m²", precoReferencia: 320.00 },
  { categoria: "Vidros", descricao: "Box de banheiro (vidro)", unidade: "un", precoReferencia: 650.00 },
  { categoria: "Vidros", descricao: "Espelho", unidade: "m²", precoReferencia: 280.00 },
  { categoria: "Vidros", descricao: "Guarda-corpo de vidro", unidade: "m", precoReferencia: 620.00 },
  { categoria: "Vidros", descricao: "Fechamento de varanda (vidro)", unidade: "m²", precoReferencia: 580.00 },

  // ── Instalações Elétricas ──
  { categoria: "Instalações Elétricas", descricao: "Ponto de luz / tomada", unidade: "un", precoReferencia: 95.00 },
  { categoria: "Instalações Elétricas", descricao: "Quadro de distribuição", unidade: "un", precoReferencia: 650.00 },
  { categoria: "Instalações Elétricas", descricao: "Cabeamento (eletroduto + fio)", unidade: "m", precoReferencia: 18.00 },
  { categoria: "Instalações Elétricas", descricao: "Entrada de energia (padrão concessionária)", unidade: "vb", precoReferencia: 2800.00 },
  { categoria: "Instalações Elétricas", descricao: "Ponto de ar-condicionado", unidade: "un", precoReferencia: 220.00 },
  { categoria: "Instalações Elétricas", descricao: "Iluminação de LED embutida (spot)", unidade: "un", precoReferencia: 85.00 },
  { categoria: "Instalações Elétricas", descricao: "Cabeamento de dados/rede", unidade: "m", precoReferencia: 14.00 },
  { categoria: "Instalações Elétricas", descricao: "SPDA (para-raios)", unidade: "vb", precoReferencia: 4500.00 },

  // ── Instalações Hidrossanitárias ──
  { categoria: "Instalações Hidrossanitárias", descricao: "Ponto de água fria", unidade: "un", precoReferencia: 140.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Ponto de água quente", unidade: "un", precoReferencia: 180.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Ponto de esgoto", unidade: "un", precoReferencia: 160.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Caixa d'água (com instalação)", unidade: "un", precoReferencia: 1200.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Tubulação de água/esgoto", unidade: "m", precoReferencia: 32.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Caixa de gordura / inspeção", unidade: "un", precoReferencia: 280.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Fossa séptica / sumidouro", unidade: "vb", precoReferencia: 3500.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Aquecedor a gás (passagem)", unidade: "un", precoReferencia: 1850.00 },
  { categoria: "Instalações Hidrossanitárias", descricao: "Cisterna / reúso de água", unidade: "un", precoReferencia: 2800.00 },

  // ── Instalações de Gás ──
  { categoria: "Instalações de Gás", descricao: "Ponto de gás", unidade: "un", precoReferencia: 220.00 },
  { categoria: "Instalações de Gás", descricao: "Tubulação de gás (cobre)", unidade: "m", precoReferencia: 55.00 },
  { categoria: "Instalações de Gás", descricao: "Central de GLP / abrigo de botijões", unidade: "vb", precoReferencia: 2200.00 },

  // ── Climatização ──
  { categoria: "Climatização", descricao: "Ar-condicionado split (com instalação)", unidade: "un", precoReferencia: 3200.00 },
  { categoria: "Climatização", descricao: "Sistema de ar central (VRF)", unidade: "vb", precoReferencia: 28000.00 },
  { categoria: "Climatização", descricao: "Exaustão / ventilação mecânica", unidade: "un", precoReferencia: 850.00 },
  { categoria: "Climatização", descricao: "Dutos de climatização", unidade: "m", precoReferencia: 180.00 },

  // ── Pressurização e Combate a Incêndio ──
  { categoria: "Pressurização e Incêndio", descricao: "Sistema de pressurização de escada", unidade: "vb", precoReferencia: 32000.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Pressurizador de água (bomba)", unidade: "un", precoReferencia: 4200.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Hidrante completo", unidade: "un", precoReferencia: 1800.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Extintor de incêndio", unidade: "un", precoReferencia: 280.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Sprinkler (chuveiro automático)", unidade: "un", precoReferencia: 320.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Detector de fumaça / alarme", unidade: "un", precoReferencia: 240.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Iluminação de emergência", unidade: "un", precoReferencia: 180.00 },
  { categoria: "Pressurização e Incêndio", descricao: "Sinalização de rota de fuga", unidade: "un", precoReferencia: 95.00 },

  // ── Louças e Metais ──
  { categoria: "Louças e Metais", descricao: "Vaso sanitário com caixa acoplada", unidade: "un", precoReferencia: 680.00 },
  { categoria: "Louças e Metais", descricao: "Lavatório / cuba", unidade: "un", precoReferencia: 380.00 },
  { categoria: "Louças e Metais", descricao: "Pia de cozinha (com bancada)", unidade: "un", precoReferencia: 950.00 },
  { categoria: "Louças e Metais", descricao: "Tanque de lavar", unidade: "un", precoReferencia: 320.00 },
  { categoria: "Louças e Metais", descricao: "Torneira / misturador", unidade: "un", precoReferencia: 220.00 },
  { categoria: "Louças e Metais", descricao: "Chuveiro / ducha", unidade: "un", precoReferencia: 180.00 },
  { categoria: "Louças e Metais", descricao: "Registro / acabamento", unidade: "un", precoReferencia: 120.00 },

  // ── Bancadas e Marcenaria ──
  { categoria: "Bancadas e Marcenaria", descricao: "Bancada de granito / quartzo", unidade: "m", precoReferencia: 520.00 },
  { categoria: "Bancadas e Marcenaria", descricao: "Armário de cozinha planejado", unidade: "m", precoReferencia: 1200.00 },
  { categoria: "Bancadas e Marcenaria", descricao: "Armário de banheiro / gabinete", unidade: "un", precoReferencia: 950.00 },
  { categoria: "Bancadas e Marcenaria", descricao: "Closet / guarda-roupa planejado", unidade: "m²", precoReferencia: 1100.00 },
  { categoria: "Bancadas e Marcenaria", descricao: "Painel ripado / marcenaria decorativa", unidade: "m²", precoReferencia: 680.00 },

  // ── Piscina ──
  { categoria: "Piscina", descricao: "Piscina de concreto armado (escavação + estrutura)", unidade: "m²", precoReferencia: 1450.00 },
  { categoria: "Piscina", descricao: "Piscina de fibra (com instalação)", unidade: "un", precoReferencia: 28000.00 },
  { categoria: "Piscina", descricao: "Revestimento de piscina (pastilha/vinil)", unidade: "m²", precoReferencia: 280.00 },
  { categoria: "Piscina", descricao: "Casa de máquinas / filtragem", unidade: "vb", precoReferencia: 6500.00 },
  { categoria: "Piscina", descricao: "Aquecimento de piscina (solar/bomba)", unidade: "vb", precoReferencia: 8500.00 },
  { categoria: "Piscina", descricao: "Borda / deck de piscina", unidade: "m²", precoReferencia: 320.00 },
  { categoria: "Piscina", descricao: "Iluminação subaquática (LED)", unidade: "un", precoReferencia: 480.00 },

  // ── Sauna ──
  { categoria: "Sauna", descricao: "Sauna seca (cabine completa)", unidade: "vb", precoReferencia: 14000.00 },
  { categoria: "Sauna", descricao: "Sauna a vapor (cabine completa)", unidade: "vb", precoReferencia: 12000.00 },
  { categoria: "Sauna", descricao: "Gerador de calor / vapor", unidade: "un", precoReferencia: 4200.00 },
  { categoria: "Sauna", descricao: "Revestimento de madeira (sauna)", unidade: "m²", precoReferencia: 380.00 },

  // ── Churrasqueira e Área Gourmet ──
  { categoria: "Área Gourmet", descricao: "Churrasqueira de alvenaria", unidade: "un", precoReferencia: 4800.00 },
  { categoria: "Área Gourmet", descricao: "Churrasqueira pré-moldada", unidade: "un", precoReferencia: 2200.00 },
  { categoria: "Área Gourmet", descricao: "Forno de pizza / fogão a lenha", unidade: "un", precoReferencia: 3500.00 },
  { categoria: "Área Gourmet", descricao: "Coifa / exaustão de churrasqueira", unidade: "un", precoReferencia: 1800.00 },
  { categoria: "Área Gourmet", descricao: "Bancada gourmet com cuba", unidade: "m", precoReferencia: 850.00 },
  { categoria: "Área Gourmet", descricao: "Pergolado de madeira/concreto", unidade: "m²", precoReferencia: 420.00 },

  // ── Paisagismo e Áreas Externas ──
  { categoria: "Paisagismo", descricao: "Jardim / plantio de grama", unidade: "m²", precoReferencia: 65.00 },
  { categoria: "Paisagismo", descricao: "Plantio de árvores / arbustos", unidade: "un", precoReferencia: 180.00 },
  { categoria: "Paisagismo", descricao: "Sistema de irrigação automática", unidade: "m²", precoReferencia: 38.00 },
  { categoria: "Paisagismo", descricao: "Iluminação de jardim", unidade: "un", precoReferencia: 220.00 },
  { categoria: "Paisagismo", descricao: "Jardim vertical", unidade: "m²", precoReferencia: 480.00 },

  // ── Pavimentação e Áreas Externas ──
  { categoria: "Pavimentação", descricao: "Calçada / passeio de concreto", unidade: "m²", precoReferencia: 85.00 },
  { categoria: "Pavimentação", descricao: "Piso intertravado (paver)", unidade: "m²", precoReferencia: 110.00 },
  { categoria: "Pavimentação", descricao: "Pavimentação asfáltica", unidade: "m²", precoReferencia: 95.00 },
  { categoria: "Pavimentação", descricao: "Meio-fio / guia", unidade: "m", precoReferencia: 55.00 },
  { categoria: "Pavimentação", descricao: "Muro de divisa (alvenaria)", unidade: "m²", precoReferencia: 220.00 },
  { categoria: "Pavimentação", descricao: "Cerca / alambrado", unidade: "m", precoReferencia: 130.00 },

  // ── Automação e Segurança ──
  { categoria: "Automação e Segurança", descricao: "Câmera de segurança (CFTV)", unidade: "un", precoReferencia: 650.00 },
  { categoria: "Automação e Segurança", descricao: "Interfone / vídeo porteiro", unidade: "un", precoReferencia: 850.00 },
  { categoria: "Automação e Segurança", descricao: "Fechadura digital / biometria", unidade: "un", precoReferencia: 1200.00 },
  { categoria: "Automação e Segurança", descricao: "Alarme / sensores de presença", unidade: "vb", precoReferencia: 2200.00 },
  { categoria: "Automação e Segurança", descricao: "Automação residencial (iluminação/cortinas)", unidade: "vb", precoReferencia: 8500.00 },
  { categoria: "Automação e Segurança", descricao: "Cerca elétrica / concertina", unidade: "m", precoReferencia: 85.00 },

  // ── Energia Solar ──
  { categoria: "Energia Solar", descricao: "Sistema fotovoltaico (placa + instalação)", unidade: "kWp", precoReferencia: 4200.00 },
  { categoria: "Energia Solar", descricao: "Aquecedor solar (boiler + coletores)", unidade: "vb", precoReferencia: 6500.00 },
  { categoria: "Energia Solar", descricao: "Inversor / string box", unidade: "un", precoReferencia: 5200.00 },

  // ── Elevador ──
  { categoria: "Elevador", descricao: "Elevador residencial (com instalação)", unidade: "vb", precoReferencia: 95000.00 },
  { categoria: "Elevador", descricao: "Plataforma elevatória / acessibilidade", unidade: "vb", precoReferencia: 42000.00 },
  { categoria: "Elevador", descricao: "Poço e casa de máquinas (estrutura)", unidade: "vb", precoReferencia: 18000.00 },

  // ── Serviços Finais ──
  { categoria: "Serviços Finais", descricao: "Limpeza final da obra", unidade: "m²", precoReferencia: 12.00 },
  { categoria: "Serviços Finais", descricao: "Limpeza pós-obra pesada", unidade: "m²", precoReferencia: 18.00 },
  { categoria: "Serviços Finais", descricao: "Desmobilização do canteiro", unidade: "vb", precoReferencia: 1500.00 },
  { categoria: "Serviços Finais", descricao: "Vistoria e regularização (habite-se)", unidade: "vb", precoReferencia: 3500.00 },
];

// Lista de categorias na ordem de exibição
export const CATEGORIAS_ORCAMENTO = [
  "Serviços Preliminares",
  "Terraplenagem",
  "Fundação",
  "Estrutura",
  "Alvenaria e Vedação",
  "Cobertura",
  "Impermeabilização",
  "Revestimentos de Parede",
  "Revestimentos de Piso",
  "Forros",
  "Pintura",
  "Esquadrias de Madeira",
  "Esquadrias de Alumínio",
  "Vidros",
  "Instalações Elétricas",
  "Instalações Hidrossanitárias",
  "Instalações de Gás",
  "Climatização",
  "Pressurização e Incêndio",
  "Louças e Metais",
  "Bancadas e Marcenaria",
  "Piscina",
  "Sauna",
  "Área Gourmet",
  "Paisagismo",
  "Pavimentação",
  "Automação e Segurança",
  "Energia Solar",
  "Elevador",
  "Serviços Finais",
];
