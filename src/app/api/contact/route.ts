import { NextResponse } from "next/server";
import { Resend } from "resend";
import { checkContactRateLimit } from "@/lib/rate-limit";

const CONTACT_INBOX = "mafuzur.rahman032@gmail.com";
const MAX_FIELD_LENGTH = 5_000;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: Request) {
  const rateLimit = await checkContactRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.message }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required." },
      { status: 400 }
    );
  }
  if (
    name.length > MAX_FIELD_LENGTH ||
    email.length > MAX_FIELD_LENGTH ||
    message.length > MAX_FIELD_LENGTH
  ) {
    return NextResponse.json({ error: "That field is too long." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Contact form isn't configured yet." },
      { status: 500 }
    );
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "ATSBuddy Contact Form <onboarding@resend.dev>",
      to: CONTACT_INBOX,
      replyTo: email,
      subject: `New contact form message from ${name}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Couldn't send your message. Try again in a moment." },
      { status: 500 }
    );
  }
}
