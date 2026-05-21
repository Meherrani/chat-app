import { getMcpClient } from "@/lib/mcp-client";

export const runtime = "nodejs";
export const maxDuration = 30;

type InboundMessage = { role: "user" | "assistant"; content: string };

type SearchResult = {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
};

type SearchAnswer = {
  type: "answer_box" | "ai_overview" | "knowledge_graph" | "synthesized";
  text: string;
  source?: { title: string; link: string };
};

async function synthesizeAnswer(
  query: string,
  results: SearchResult[],
): Promise<{ answer: SearchAnswer | null; error?: string }> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return { answer: null, error: "GROQ_API_KEY not set in .env.local" };
  }
  if (results.length === 0) return { answer: null };

  const sources = results
    .slice(0, 6)
    .map(
      (r, i) => `[${i + 1}] ${r.title} — ${r.displayLink}\n${r.snippet}`,
    )
    .join("\n\n");

  const system = `You are a helpful AI assistant answering a user's question using the provided web search snippets as grounding.

Format your reply as rich markdown:
- Open with a warm, direct one-sentence answer.
- Use **bold** for key terms and concepts.
- Use \`##\` headings for sections when the answer has more than one part.
- Use numbered lists or bullet points where structure helps.
- Use fenced code blocks with a language tag for any code (\`\`\`python, \`\`\`js, etc.).
- Cite sources inline like [1], [2] matching the numbered snippets when you draw on them.
- Keep it informative but not bloated.

If the snippets don't actually answer the question, say so briefly instead of guessing.`;

  const userMsg = `Query: ${query}\n\nSearch results:\n${sources}`;

  try {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 2000,
          temperature: 0.4,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
        }),
      },
    );

    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      console.error(`[synthesize] ${res.status}:`, body);
      return { answer: null, error: `LLM error ${res.status}: ${body}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!text) return { answer: null, error: "LLM returned empty response" };
    return { answer: { type: "synthesized", text } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[synthesize] threw:`, msg);
    return { answer: null, error: msg };
  }
}

export async function POST(req: Request) {
  let body: { messages?: InboundMessage[]; query?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query =
    body.query?.trim() ||
    body.messages?.filter((m) => m.role === "user").pop()?.content?.trim() ||
    "";

  if (!query) {
    return Response.json(
      { error: "Provide a 'query' or at least one user message." },
      { status: 400 },
    );
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

  try {
    console.log(`[search] query:`, JSON.stringify(query));
    const result = await mcp.callTool({
      name: "google_search",
      arguments: { query, num: 8 },
    });

    const blocks = (result.content ?? []) as Array<{
      type: string;
      text?: string;
    }>;
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");

    if ((result as { isError?: boolean }).isError === true) {
      console.error(`[search] tool error:`, text.slice(0, 300));
      return Response.json(
        { query, error: text || "Search failed.", results: [] },
        { status: 502 },
      );
    }

    let parsed: {
      query: string;
      answer: SearchAnswer | null;
      results: SearchResult[];
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json(
        {
          query,
          error: `MCP returned non-JSON: ${text.slice(0, 200)}`,
          results: [],
        },
        { status: 502 },
      );
    }

    let answer = parsed.answer ?? null;
    let answerError: string | undefined;
    if (!answer) {
      const synth = await synthesizeAnswer(parsed.query, parsed.results);
      answer = synth.answer;
      answerError = synth.error;
    }

    console.log(
      `[search] ${parsed.results.length} results, answer: ${answer?.type ?? "none"}${answerError ? ` (err: ${answerError.slice(0, 80)})` : ""}`,
    );
    return Response.json({
      query: parsed.query,
      answer,
      answerError,
      results: parsed.results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[search] threw:`, msg);
    return Response.json(
      { query, error: msg, results: [] },
      { status: 500 },
    );
  }
}
