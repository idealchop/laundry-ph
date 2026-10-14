import { GoogleGenAI, type Content, type FunctionDeclaration, type GenerateContentResponse } from "@google/genai";

export const MODEL = process.env.COMPANION_MODEL || "gemini-2.5-flash-lite";
/** USD per 1M tokens (Vertex AI list price for the flash-lite tier). */
const PRICE_IN = 0.1, PRICE_OUT = 0.4;
export const USD_PHP = 58;

let _ai: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ vertexai: true, project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "mylaundryph", location: process.env.COMPANION_VERTEX_LOCATION || "global" });
  return _ai;
}

export interface Usage { tokensIn: number; tokensOut: number; costUsd: number; costPhp: number; calls: number }
export const emptyUsage = (): Usage => ({ tokensIn: 0, tokensOut: 0, costUsd: 0, costPhp: 0, calls: 0 });
export function addUsage(u: Usage, r: GenerateContentResponse) {
  const i = r.usageMetadata?.promptTokenCount ?? 0;
  const o = (r.usageMetadata?.candidatesTokenCount ?? 0) + (r.usageMetadata?.thoughtsTokenCount ?? 0);
  u.tokensIn += i; u.tokensOut += o; u.calls++;
  u.costUsd = Math.round(((u.tokensIn * PRICE_IN + u.tokensOut * PRICE_OUT) / 1e6) * 1e6) / 1e6;
  u.costPhp = Math.round(u.costUsd * USD_PHP * 10000) / 10000;
}

export async function generate(system: string, contents: Content[], tools?: FunctionDeclaration[], json = false) {
  return ai().models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: system,
      temperature: 0.6,
      maxOutputTokens: 1024,
      ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  });
}
