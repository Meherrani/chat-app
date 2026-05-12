"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatRole = "user" | "assistant";

export type Message = {
  id: string;
  role: ChatRole;
  content: string;
};

function Avatar({ role }: { role: ChatRole }) {
  if (role === "user") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-700">
        You
      </div>
    );
  }
  return (
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
  );
}

export default function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className="group flex gap-3 px-4 py-5 animate-fade-in sm:px-6">
      <Avatar role={message.role} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-xs font-medium text-slate-500">
          {isUser ? "You" : "Assistant"}
        </div>
        {isUser ? (
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">
            {message.content}
          </div>
        ) : (
          <div className="prose-chat text-[15px] text-slate-800">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
