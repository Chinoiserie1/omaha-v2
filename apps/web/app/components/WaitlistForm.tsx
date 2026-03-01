"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const webhookUrl = process.env["NEXT_PUBLIC_MAKE_WEBHOOK_URL"];
      if (!webhookUrl) throw new Error("Webhook URL not configured");

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error("Request failed");

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4 text-emerald-300">
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>You&apos;re on the list! We&apos;ll be in touch soon.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white placeholder-zinc-500 outline-none transition focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="shrink-0 rounded-lg bg-[linear-gradient(90deg,#091BCD_0%,#123FFC_35%,#0B3FE8_64%,#4571F4_100%)] px-5 py-3 font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {status === "submitting" ? "Joining…" : "Join the Waitlist"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-sm text-red-400">{errorMsg}</p>
      )}
    </form>
  );
}
