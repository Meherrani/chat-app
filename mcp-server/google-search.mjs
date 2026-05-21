import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.SERPAPI_API_KEY;

const server = new Server(
  { name: "google-search", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "google_search",
      description:
        "Search Google for current, factual information on any topic. Returns a list of web results with titles, URLs, and snippets. Use this whenever the user asks about recent events, specific facts, or anything that may require looking up authoritative sources.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query.",
          },
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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "google_search") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  if (!API_KEY) {
    return {
      content: [
        {
          type: "text",
          text: "Search is not configured. Set SERPAPI_API_KEY in .env.local.",
        },
      ],
      isError: true,
    };
  }

  const args = request.params.arguments ?? {};
  const query = String(args.query ?? "").trim();
  const num = Math.max(1, Math.min(10, Number(args.num) || 5));

  if (!query) {
    return {
      content: [{ type: "text", text: "Query is required." }],
      isError: true,
    };
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(num));

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    return {
      content: [
        {
          type: "text",
          text: `SerpAPI error ${res.status}: ${body.slice(0, 500)}`,
        },
      ],
      isError: true,
    };
  }

  const data = await res.json();
  const items = Array.isArray(data.organic_results)
    ? data.organic_results.slice(0, num)
    : [];

  const results = items.map((item) => ({
    title: item.title ?? "",
    link: item.link ?? "",
    displayLink: item.displayed_link ?? "",
    snippet: (item.snippet ?? "").replace(/\s+/g, " ").trim(),
  }));

  const answer = extractAnswer(data);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ query, answer, results }, null, 2),
      },
    ],
  };
});

function extractAnswer(data) {
  const ab = data.answer_box;
  if (ab) {
    const text =
      ab.answer ||
      ab.result ||
      ab.snippet ||
      (Array.isArray(ab.snippet_highlighted_words)
        ? ab.snippet_highlighted_words.join(", ")
        : "") ||
      ab.title ||
      "";
    if (text) {
      return {
        type: "answer_box",
        text: String(text).trim(),
        source: ab.link
          ? { title: ab.title ?? ab.displayed_link ?? "", link: ab.link }
          : undefined,
      };
    }
  }

  const ai = data.ai_overview;
  if (ai && Array.isArray(ai.text_blocks) && ai.text_blocks.length) {
    const text = ai.text_blocks
      .map((b) => b.snippet || b.text || "")
      .filter(Boolean)
      .join(" ")
      .trim();
    if (text) {
      const ref = Array.isArray(ai.references) ? ai.references[0] : null;
      return {
        type: "ai_overview",
        text,
        source: ref?.link
          ? { title: ref.title ?? ref.source ?? "", link: ref.link }
          : undefined,
      };
    }
  }

  const kg = data.knowledge_graph;
  if (kg && kg.description) {
    return {
      type: "knowledge_graph",
      text: String(kg.description).trim(),
      source: kg.source?.link
        ? { title: kg.source.name ?? kg.title ?? "", link: kg.source.link }
        : undefined,
    };
  }

  return null;
}

const transport = new StdioServerTransport();
await server.connect(transport);
