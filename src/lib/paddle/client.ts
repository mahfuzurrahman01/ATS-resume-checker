import { Environment, LogLevel, Paddle, type PaddleOptions } from "@paddle/paddle-node-sdk";

let client: Paddle | null = null;

/** Lazily creates the Paddle server SDK client so a missing key doesn't crash imports. */
export function getPaddleInstance(): Paddle {
  if (client) return client;
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is not set");
  }
  const options: PaddleOptions = {
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? Environment.production
        : Environment.sandbox,
    logLevel: LogLevel.error,
  };
  client = new Paddle(apiKey, options);
  return client;
}
