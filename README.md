# Chat App

A Next.js search-chat app: ask a question, the app runs a live Google search via SerpAPI, then an LLM reads the snippets and writes a markdown answer with inline citations.

## How it works

```
Browser  →  Next.js API route  →  MCP server (stdio)  →  SerpAPI (Google)
                  ↓
              Groq Llama 3.3 70B  ←  search snippets
                  ↓
              Markdown answer + [1][2] citations
                  ↓
              Browser (renders markdown + Sources footer)
```

- `src/app/page.tsx` — chat UI
- `src/app/api/chat/route.ts` — orchestrates search + LLM
- `src/lib/mcp-client.ts` — spawns the MCP server over stdio
- `mcp-server/google-search.mjs` — MCP server that calls SerpAPI

## Prerequisites

- Node.js 18.17 or newer (Next.js 15 requirement)
- A free [SerpAPI](https://serpapi.com/) account (100 searches/month)
- A free [Groq](https://console.groq.com/) account (Llama 3.3 70B, generous free tier)

## Step 1 — Clone and install

```bash
git clone <your-repo-url> chat-app
cd chat-app
npm install
```

## Step 2 — Configure API keys

Copy the example env file:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```dotenv
SERPAPI_API_KEY=your_serpapi_key_here
GROQ_API_KEY=your_groq_key_here
```

Where to get the keys:

- **SerpAPI:** sign up at https://serpapi.com/ → copy from https://serpapi.com/manage-api-key
- **Groq:** sign up at https://console.groq.com/ → create a key at https://console.groq.com/keys

## Step 3 — Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 and type a query. You should see a markdown answer at the top, followed by a numbered list of source links.

## Step 4 — Build for production

```bash
npm run build
npm start
```

## Customizing the model

The LLM call lives in `src/app/api/chat/route.ts` inside `synthesizeAnswer()`. To swap providers (OpenAI, Anthropic, Gemini, OpenRouter), change the `fetch` URL, the `Authorization` header, and the request body to match that provider's API. The function's contract — `(query, results) → { answer, error }` — stays the same.

To tune the answer's style (longer, shorter, more code, different tone), edit the `system` prompt in the same function.

## Tech stack

- **Next.js 15** (App Router, React 19)
- **Tailwind CSS** + `@tailwindcss/typography` for the answer markdown
- **react-markdown** + `remark-gfm` + `rehype-highlight` for rendering
- **@modelcontextprotocol/sdk** for the local MCP server pattern
- **SerpAPI** for Google search results
- **Groq** (Llama 3.3 70B) for answer synthesis

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `SerpAPI error 401` | `SERPAPI_API_KEY` missing or wrong |
| `LLM error 401` | `GROQ_API_KEY` missing or wrong |
| `Couldn't generate a text answer` warning under results | LLM call failed — check the dev server console for the specific error |
| Only link cards show, no answer | Search returned zero results, or the LLM step failed silently — check dev console |
| Port 3000 in use | Another Next dev server is running. Stop it or Next will fall back to 3001 |

## Security note

`.env.local` contains live API keys and is gitignored by default. Never commit it. If a key ever lands in a commit, screenshot, or chat log, rotate it immediately at the provider's console.
