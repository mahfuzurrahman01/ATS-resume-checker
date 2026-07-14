import { getPaddleInstance } from "@/lib/paddle/client";
import { processEvent } from "@/lib/paddle/process-webhook";

/**
 * Paddle webhook receiver. Only a 2xx response marks a delivery as
 * "received" — every failure mode below (bad signature, unknown price,
 * DB error) must return non-2xx so Paddle retries, since that's the only
 * way an event ever gets a second chance.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ?? "";

  if (!signature || !rawBody) {
    return Response.json({ error: "Missing signature or body" }, { status: 400 });
  }

  try {
    const paddle = getPaddleInstance();
    const event = await paddle.webhooks.unmarshal(rawBody, secret, signature);

    if (event) {
      await processEvent(event);
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error("Paddle webhook error:", e);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
