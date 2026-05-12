import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_KEY = process.env.GOOGLE_API_KEY;
const CX = process.env.GOOGLE_SEARCH_ENGINE_ID;

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

  if (!API_KEY || !CX) {
    return {
      content: [
        {
          type: "text",
          text: "Search is not configured. Set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env.local.",
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

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", API_KEY);
  url.searchParams.set("cx", CX);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(num));

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    return {
      content: [
        {
          type: "text",
          text: `Google Search API error ${res.status}: ${body.slice(0, 500)}`,
        },
      ],
      isError: true,
    };
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  if (items.length === 0) {
    return {
      content: [{ type: "text", text: `No results for query: ${query}` }],
    };
  }

  const formatted = items
    .map((item, i) => {
      const title = item.title ?? "(no title)";
      const link = item.link ?? "";
      const snippet = (item.snippet ?? "").replace(/\s+/g, " ").trim();
      return `${i + 1}. ${title}\n   URL: ${link}\n   ${snippet}`;
    })
    .join("\n\n");

  return {
    content: [
      {
        type: "text",
        text: `Top ${items.length} Google results for "${query}":\n\n${formatted}`,
      },
    ],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
