"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

export type SearchResult = {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
};

export type SearchAnswer = {
  type: "answer_box" | "ai_overview" | "knowledge_graph" | "synthesized";
  text: string;
  source?: { title: string; link: string };
};

export type Message =
  | { id: string; kind: "query"; content: string }
  | {
      id: string;
      kind: "results";
      query: string;
      answer?: SearchAnswer | null;
      answerError?: string;
      results: SearchResult[];
      error?: string;
    };

function QueryBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3 px-4 py-5 animate-fade-in sm:px-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">
        You
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-medium text-slate-500">You</div>
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">
          {content}
        </div>
      </div>
    </div>
  );
}

function AnswerMarkdown({ text }: { text: string }) {
  return (
    <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-h2:text-lg prose-h3:text-base prose-p:text-[15px] prose-p:leading-relaxed prose-li:text-[15px] prose-li:leading-relaxed prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-medium prose-code:before:hidden prose-code:after:hidden prose-pre:rounded-lg prose-pre:bg-slate-900 prose-pre:p-4 prose-pre:text-[13px] prose-pre:leading-relaxed prose-a:text-blue-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function SourcesFooter({ results }: { results: SearchResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="mt-4 border-t border-slate-200 pt-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Sources
      </div>
      <ol className="space-y-1.5">
        {results.slice(0, 6).map((r, i) => (
          <li key={`${r.link}-${i}`} className="flex gap-2 text-xs">
            <span className="shrink-0 text-slate-400">[{i + 1}]</span>
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-blue-700 hover:underline"
              title={r.title}
            >
              {r.title} <span className="text-slate-500">· {r.displayLink}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ResultsBlock({
  answer,
  answerError,
  results,
  error,
}: {
  query: string;
  answer?: SearchAnswer | null;
  answerError?: string;
  results: SearchResult[];
  error?: string;
}) {
  return (
    <div className="flex gap-3 px-4 py-5 animate-fade-in sm:px-6">
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
      <div className="min-w-0 flex-1">
        <div className="mb-2 text-xs font-medium text-slate-500">Assistant</div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : !answer && results.length === 0 ? (
          <div className="text-sm text-slate-500">No results.</div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {answer ? (
              <AnswerMarkdown text={answer.text} />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {answerError
                  ? `Couldn't generate a text answer: ${answerError}`
                  : "No written answer available."}
              </div>
            )}
            <SourcesFooter results={results} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatMessage({ message }: { message: Message }) {
  if (message.kind === "query") {
    return <QueryBubble content={message.content} />;
  }
  return (
    <ResultsBlock
      query={message.query}
      answer={message.answer}
      answerError={message.answerError}
      results={message.results}
      error={message.error}
    />
  );
}
