"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessage, { type Message } from "./ChatMessage";

const SUGGESTED_PROMPTS = [
  "What were the major tech news headlines this week?",
  "Summarize the latest research on Mediterranean diet and longevity.",
  "What's the current status of the James Webb Space Telescope?",
  "Explain the recent changes to EU AI regulation in plain English.",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: Message = { id: uid(), role: "user", content: text };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setError(null);
      setIsSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }
        const assistantMsg: Message = {
          id: uid(),
          role: "assistant",
          content: data.text || "(no response)",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        setIsSending(false);
      }
    },
    [messages],
  );

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isSending) return;
    void send(text);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Search Chat
            </div>
            <div className="text-[11px] text-slate-500">
              Grounded in live Google results via MCP
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          {!hasMessages ? (
            <div className="px-4 pt-16 sm:px-6">
              <div className="text-center">
                <h1 className="text-2xl font-semibold text-slate-900">
                  What would you like to know?
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Ask anything — I&apos;ll search Google when current information
                  is needed.
                </p>
              </div>
              <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    disabled={isSending}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {isSending && (
                <div className="flex gap-3 px-4 py-5 sm:px-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4"
                      aria-hidden
                    >
                      <path d="M12 2a1 1 0 0 1 1 1v2.07a7.002 7.002 0 0 1 5.93 5.93H21a1 1 0 1 1 0 2h-2.07a7.002 7.002 0 0 1-5.93 5.93V21a1 1 0 1 1-2 0v-2.07A7.002 7.002 0 0 1 5.07 13H3a1 1 0 1 1 0-2h2.07A7.002 7.002 0 0 1 11 5.07V3a1 1 0 0 1 1-1Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 pt-3">
                    <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-slate-400" />
                    <span
                      className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-slate-400"
                      style={{ animationDelay: "0.16s" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-slate-400"
                      style={{ animationDelay: "0.32s" }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mx-4 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6">
              {error}
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isSending}
      />
    </div>
  );
}
