import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";

/**
 * Shared Gemini client: timeout wrapper, zod-validated JSON responses with a
 * single retry, and friendly error mapping. All AI calls in the app go
 * through `generateJson` so every response is guaranteed to match its schema
 * before it reaches the rest of the codebase.
 */

export const MODEL_VERSION = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

/** Lazily creates the Gemini client so a missing key doesn't crash imports. */
function getClient(): GoogleGenAI {
  if (client) return client;
  // Server-only key. NEXT_PUBLIC_ prefix kept as a fallback for backward
  // compatibility with existing .env files.
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

/** Thrown when an AI call fails. `userMessage` is safe to show to the user. */
export class AiError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = "AiError";
    this.userMessage = userMessage;
  }
}

/** Rejects if the given promise does not settle within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timed out")), ms)
    ),
  ]);
}

/** Maps raw provider/network errors to short, human-readable messages. */
export function friendlyAiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "The analysis took too long this time. Please try again.";
  }
  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    const m =
      msg.match(/retry in ([0-9.]+)s/i) ||
      msg.match(/retryDelay[":\s]+"?(\d+)s/i);
    const secs = m ? Math.ceil(parseFloat(m[1])) : null;
    return `Our AI is very busy right now and we've hit a temporary usage limit. Please try again${
      secs ? ` in about ${secs} seconds` : " in a minute"
    }. You were not charged.`;
  }
  if (
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("overloaded")
  ) {
    return "The AI service is temporarily unavailable. Please try again in a moment. You were not charged.";
  }
  if (
    lower.includes("api key") ||
    lower.includes("permission") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "The analysis service is temporarily unavailable. Please try again later.";
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return "We couldn't analyze this document. Please try a different file.";
  }
  return "Something went wrong while analyzing this request. Please try again.";
}

/** Strips markdown code fences the model sometimes wraps JSON in. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

async function callOnce(systemPrompt: string, userText: string): Promise<string> {
  const response = await getClient().models.generateContent({
    model: MODEL_VERSION,
    contents: [{ text: `${systemPrompt}\n\n${userText}` }],
    config: {
      temperature: 0,
      topP: 1,
      responseMimeType: "application/json",
    },
  });
  return response.text || "";
}

export interface GenerateJsonOptions<T> {
  systemPrompt: string;
  userText: string;
  schema: ZodType<T>;
  timeoutMs: number;
}

/**
 * Calls Gemini and validates the JSON response against `schema`. On a
 * validation failure the call is retried exactly once; if the retry also
 * fails, throws an AiError with a user-safe message. Network/provider errors
 * are also mapped to AiError. Never returns unvalidated data.
 */
export async function generateJson<T>(
  options: GenerateJsonOptions<T>
): Promise<T> {
  const { systemPrompt, userText, schema, timeoutMs } = options;

  const attempt = async (): Promise<T> => {
    const raw = await withTimeout(
      callOnce(systemPrompt, userText),
      timeoutMs
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch (cause) {
      throw new Error("The AI response was not valid JSON.", { cause });
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `The AI response did not match the expected shape: ${result.error.message}`
      );
    }
    return result.data;
  };

  try {
    return await attempt();
  } catch (firstError) {
    console.error("Gemini call failed (attempt 1/2), retrying:", firstError);
    try {
      return await attempt();
    } catch (secondError) {
      console.error("Gemini call failed (attempt 2/2), giving up:", secondError);
      throw new AiError(friendlyAiError(secondError), { cause: secondError });
    }
  }
}
