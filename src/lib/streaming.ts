/**
 * Shared NDJSON (newline-delimited JSON) streaming helper for API routes
 * that report real progress instead of a fabricated percentage. Each line
 * written to the response body is one JSON event. Used by both the scan and
 * match pipelines.
 *
 * Fast pre-flight failures (auth, rate limit, bad file) stay as plain JSON
 * responses with real HTTP status codes — nothing to show progress for.
 * Once a route commits to doing the real work, it switches to this stream:
 * every response from that point on (including instant cache hits) is a
 * 200 NDJSON stream ending in exactly one "result" or "error" event, so the
 * client only ever has one response shape to parse.
 */

export interface StageEvent {
  type: "stage";
  stage: string;
  status: "start" | "done";
}

export interface ResultEvent<T> {
  type: "result";
  data: T;
}

export interface ErrorEvent {
  type: "error";
  error: string;
  code?: string;
}

export type StreamEvent<T> = StageEvent | ResultEvent<T> | ErrorEvent;

export interface StreamController<T> {
  stage(stage: string, status: "start" | "done"): void;
  result(data: T): void;
  error(message: string, code?: string): void;
}

/**
 * Builds an NDJSON streaming Response. `run` receives a small controller to
 * emit stage/result/error events; the stream closes automatically after
 * `run` resolves or throws (an uncaught throw is reported as a generic
 * error event so the client never hangs waiting for a final event).
 */
export function ndjsonResponse<T>(
  run: (controller: StreamController<T>) => Promise<void>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (event: StreamEvent<T>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      const streamController: StreamController<T> = {
        stage: (stage, status) => write({ type: "stage", stage, status }),
        result: (data) => write({ type: "result", data }),
        error: (message, code) => write({ type: "error", error: message, code }),
      };

      try {
        await run(streamController);
      } catch (error) {
        console.error("Unhandled error in stream:", error);
        write({ type: "error", error: "Internal server error" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
