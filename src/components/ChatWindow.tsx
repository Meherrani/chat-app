"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import ChatMessage, {
  type Message,
  type SearchAnswer,
  type SearchResult,
} from "./ChatMessage";

const SUGGESTED_QUERIES = [
  "Major tech news this week",
  "Mediterranean diet and longevity",
  "James Webb Space Telescope current mission",
  "EU AI Act 2026 changes",
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isSearching]);

  const search = useCallback(async (query: string) => {
    const queryMsg: Message = { id: uid(), kind: "query", content: query };
    setMessages((prev) => [...prev, queryMsg]);
    setInput("");
    setIsSearching(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = (await res.json()) as {
        query?: string;
        answer?: SearchAnswer | null;
        answerError?: string;
        results?: SearchResult[];
        error?: string;
      };

      const resultsMsg: Message = {
        id: uid(),
        kind: "results",
        query: data.query ?? query,
        answer: data.answer ?? null,
        answerError: data.answerError,
        results: data.results ?? [],
        error: !res.ok
          ? data.error ?? `Request failed (${res.status})`
          : undefined,
      };
      setMessages((prev) => [...prev, resultsMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          kind: "results",
          query,
          results: [],
          error: msg,
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || isSearching) return;
    void search(text);
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
              MCP Search
            </div>
            <div className="text-[11px] text-slate-500">
              Live Google results via your local MCP server
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
                  Search the web
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Type a query and get the top results from Google, via a local
                  MCP server.
                </p>
              </div>
              <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => search(q)}
                    disabled={isSearching}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              {isSearching && (
                <div className="flex gap-3 px-4 py-5 sm:px-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
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
          <div className="h-4" />
        </div>
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={isSearching}
      />
    </div>
  );
}
