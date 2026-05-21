import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

let clientPromise: Promise<Client> | null = null;

export function getMcpClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [path.join(process.cwd(), "mcp-server", "google-search.mjs")],
        env: {
          ...process.env,
          SERPAPI_API_KEY: process.env.SERPAPI_API_KEY ?? "",
        },
      });
      const client = new Client(
        { name: "chat-app", version: "0.1.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      return client;
    })().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
