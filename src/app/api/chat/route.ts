import { getMcpClient } from "@/lib/mcp-client";

export const runtime = "nodejs";
export const maxDuration = 300;

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT = `You are a helpful research assistant grounded in live Google Search results.

Rules:
1. For any question that depends on current events, specific facts, recent releases, news, or authoritative sources, you MUST call the google_search tool before answering. Do not answer from prior knowledge for these.
2. After the tool returns, synthesize a clear answer grounded ONLY in those results. Cite sources inline as markdown links like [source title](url).
3. If the google_search tool returns an error (e.g. "Google Search API error", "Search is not configured"), do NOT invent information or fall back to your training data. Instead, reply with exactly:
   "I couldn't search the web. The search tool returned: <verbatim error from the tool>."
4. Never fabricate URLs, dates, version numbers, or news headlines. If you do not have a search result for a claim, omit it.

Keep answers focused, well-structured, and brief.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "google_search",
      description:
        "Search Google for current information on any topic. Returns a list of web results with titles, URLs, and snippets. Use whenever the user asks about recent events or anything requiring authoritative sources.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
          num: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Number of results to return (1-10). Default 5.",
          },
        },
        required: ["query"],
      },
    },
  },
];

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> | string };
  }>;
  name?: string;
};

type OllamaChatResponse = {
  message?: ChatMessage;
  done?: boolean;
  error?: string;
};

async function callOllama(messages: ChatMessage[]): Promise<ChatMessage> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      tools: TOOLS,
      options: { temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  if (data.error) throw new Error(`Ollama error: ${data.error}`);
  if (!data.message)
    throw new Error("Ollama response missing 'message' field");
  return data.message;
}

function parseArgs(
  raw: Record<string, unknown> | string,
): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inboundMessages = body.messages ?? [];
  if (inboundMessages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  let mcp;
  try {
    mcp = await getMcpClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Failed to start MCP server: ${msg}` },
      { status: 500 },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...inboundMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const assistantMsg = await callOllama(messages);
      messages.push(assistantMsg);

      const toolCalls = assistantMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return Response.json({ text: assistantMsg.content ?? "" });
      }

      for (const call of toolCalls) {
        const name = call.function.name;
        const args = parseArgs(call.function.arguments);

        if (name !== "google_search") {
          messages.push({
            role: "tool",
            name,
            content: `Error: unknown tool '${name}'.`,
          });
          continue;
        }

        try {
          console.log(`[chat] tool call: ${name}`, JSON.stringify(args));
          const result = await mcp.callTool({
            name: "google_search",
            arguments: args,
          });
          const blocks = (result.content ?? []) as Array<{
            type: string;
            text?: string;
          }>;
          const text = blocks
            .filter((b) => b.type === "text")
            .map((b) => b.text ?? "")
            .join("\n");
          const isErr = (result as { isError?: boolean }).isError === true;
          console.log(
            `[chat] tool result (isError=${isErr}, ${text.length} chars):`,
            text.slice(0, 500),
          );
          messages.push({
            role: "tool",
            name,
            content: isErr ? `TOOL_ERROR: ${text}` : text,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[chat] tool threw:`, msg);
          messages.push({
            role: "tool",
            name,
            content: `TOOL_ERROR: ${msg}`,
          });
        }
      }
    }

    return Response.json(
      { error: "Tool loop exceeded max iterations" },
      { status: 500 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
