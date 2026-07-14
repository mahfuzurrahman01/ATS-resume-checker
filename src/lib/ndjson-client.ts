/**
 * Client-side reader for the NDJSON streaming responses produced by
 * src/lib/streaming.ts. Parses each line as it arrives and invokes the
 * callback — used by ScanClient/MatchClient to drive real stage progress.
 */

export interface NdjsonEvent<T> {
  type: "stage" | "result" | "error";
  stage?: string;
  status?: "start" | "done";
  data?: T;
  error?: string;
  code?: string;
}

export async function readNdjsonStream<T>(
  response: Response,
  onEvent: (event: NdjsonEvent<T>) => void
): Promise<void> {
  if (!response.body) {
    throw new Error("Response has no body to stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep the possibly-incomplete last line

    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line));
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer));
  }
}
