// llm.ts — OpenAI direta (sem Manus)
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant";
export type Message = { role: Role; content: string };

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
};

export type InvokeResult = {
  choices: Array<{ message: { content: string } }>;
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  if (!ENV.openaiApiKey) {
    // Retorna stub quando não há chave configurada
    return {
      choices: [{
        message: {
          content: "⚠️ Configure OPENAI_API_KEY no .env para habilitar resumos com IA."
        }
      }]
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: ENV.openaiModel,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1500,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM error: ${response.status} — ${err}`);
  }

  return response.json() as Promise<InvokeResult>;
}
