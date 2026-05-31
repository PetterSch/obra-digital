// Lista central de funções (mão de obra) usada em toda a aplicação.
// value: chave estável (sem acento) · label: texto exibido.
export const FUNCOES: { value: string; label: string }[] = [
  // Gestão e apoio
  { value: "engenheiro", label: "Engenheiro" },
  { value: "mestre_obras", label: "Mestre de Obras" },
  { value: "encarregado", label: "Encarregado" },
  { value: "tecnico_seguranca", label: "Técnico de Segurança" },
  { value: "apontador", label: "Apontador / Almoxarife" },
  // Estrutura e alvenaria
  { value: "pedreiro", label: "Pedreiro" },
  { value: "servente", label: "Servente / Ajudante" },
  { value: "carpinteiro", label: "Carpinteiro" },
  { value: "armador", label: "Armador (Ferreiro)" },
  { value: "operador_betoneira", label: "Operador de Betoneira" },
  // Instalações
  { value: "bombeiro_hidraulico", label: "Bombeiro Hidráulico" },
  { value: "eletricista", label: "Eletricista" },
  { value: "refrigerista", label: "Refrigerista (Ar-Condicionado)" },
  // Revestimentos e acabamentos
  { value: "ladrilheiro", label: "Ladrilheiro (Azulejista)" },
  { value: "gesseiro", label: "Gesseiro" },
  { value: "pintor", label: "Pintor" },
  { value: "marmorista", label: "Marmorista (Mármore/Granito)" },
  { value: "impermeabilizador", label: "Impermeabilizador" },
  { value: "aplicador_revestimento", label: "Aplicador de Revestimento" },
  // Esquadrias e metais
  { value: "serralheiro", label: "Serralheiro" },
  { value: "soldador", label: "Soldador" },
  { value: "vidraceiro", label: "Vidraceiro" },
  { value: "marceneiro", label: "Marceneiro" },
  { value: "montador_esquadrias", label: "Montador de Esquadrias" },
  // Cobertura e externos
  { value: "telhadista", label: "Telhadista / Montador de Telhado" },
  { value: "jardineiro", label: "Jardineiro / Paisagista" },
  { value: "calceteiro", label: "Calceteiro (Pavimentação)" },
  // Equipamentos
  { value: "operador_maquinas", label: "Operador de Máquinas" },
  { value: "operador_grua", label: "Operador de Grua / Guincheiro" },
  { value: "motorista", label: "Motorista" },
];

export const FUNCAO_LABELS: Record<string, string> = Object.fromEntries(
  FUNCOES.map((f) => [f.value, f.label]),
);

export const funcaoLabel = (value: string) => FUNCAO_LABELS[value] || value;
