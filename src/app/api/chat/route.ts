import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { getMcpClient } from "@/lib/mcp-client";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a helpful research assistant. For any question that depends on current events, specific facts, or authoritative sources, call the google_search tool first, then synthesize a clear answer grounded in those results. Cite sources inline as markdown links like [source](url) when relevant. Keep answers focused and well-structured.`;

const client = new Anthropic();

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
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

  const googleSearch = betaZodTool({
    name: "google_search",
    description:
      "Search Google for current information on any topic. Returns a list of web results with titles, URLs, and snippets. Use whenever the user asks about recent events or anything requiring authoritative sources.",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
      num: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Number of results (1-10), default 5"),
    }),
    run: async ({ query, num }) => {
      const result = await mcp.callTool({
        name: "google_search",
        arguments: { query, num: num ?? 5 },
      });
      const blocks = (result.content ?? []) as Array<{
        type: string;
        text?: string;
      }>;
      return blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n");
    },
  });

  try {
    const finalMessage = await client.beta.messages.toolRunner({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [googleSearch],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = (finalMessage.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");

    return Response.json({ text });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: `${err.name}: ${err.message}` },
        { status: err.status ?? 500 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
