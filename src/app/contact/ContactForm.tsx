"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "submitting" | "sent" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-green-400">
        Message sent — we&apos;ll get back to you within 1-2 business days.
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          type="text"
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
          placeholder="john@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground resize-none"
          placeholder="Tell us about your inquiry..."
        />
      </div>

      {status === "error" && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" className="w-full" disabled={status === "submitting"}>
        <Send className="h-4 w-4 mr-2" />
        {status === "submitting" ? "Sending…" : "Send Message"}
      </Button>
    </form>
  );
}
