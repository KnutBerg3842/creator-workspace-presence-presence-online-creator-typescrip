import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createInfraiRealtime, InfraiError } from "./infrai_realtime.js";
import {
  completeDelivery,
  deliveryRequestSchema,
  issueWorkspaceToken,
  tokenRequestSchema,
} from "./delivery_workflow.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const realtime = createInfraiRealtime(apiKey);

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/deliveries/complete") {
      const input = deliveryRequestSchema.parse(await readJson(request));
      json(response, 200, await completeDelivery(realtime, input));
      return;
    }
    if (request.method === "POST" && request.url === "/workspace-token") {
      const input = tokenRequestSchema.parse(await readJson(request));
      json(response, 200, await issueWorkspaceToken(realtime, input));
      return;
    }
    json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "Invalid request body", issues: error.issues });
      return;
    }
    if (error instanceof SyntaxError) {
      json(response, 400, { error: "Request body must be JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.detail });
      return;
    }
    console.error(error);
    json(response, 502, { error: "Upstream request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Creator workspace service listening on ${port}`));
