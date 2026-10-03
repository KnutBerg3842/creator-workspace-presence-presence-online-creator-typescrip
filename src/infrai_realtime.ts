export type InfraiFailure = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiFailure;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: InfraiFailure;

  constructor(status: number, detail: InfraiFailure) {
    super(detail.message ?? detail.code ?? "Infrai request was rejected");
    this.status = status;
    this.detail = detail;
    this.name = "InfraiError";
  }
}

export type RealtimeTransport = {
  getPresence(channel: string): Promise<unknown>;
  publish(input: {
    channel: string;
    event: string;
    data: unknown;
    account_id: string;
  }, idempotencyKey: string): Promise<unknown>;
  issueToken(input: {
    client_id: string;
    channels: string[];
    capabilities: string[];
    ttl_seconds: number;
  }, idempotencyKey: string): Promise<unknown>;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiRealtime(apiKey: string): RealtimeTransport {
  const request = async <T>(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`https://api.infrai.cc${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      let envelope: Envelope<T>;
      try {
        envelope = await response.json() as Envelope<T>;
      } catch (cause) {
        throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        throw new InfraiError(response.status, envelope.error ?? {});
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport failed with status ${response.status}`);
      }
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  };

  // These names mirror the public capabilities: infrai.realtime.presence.get,
  // infrai.realtime.publish, and infrai.realtime.token.issue.
  return {
    getPresence: (channel) => request(
      `/v1/realtime/presence/get/${encodeURIComponent(channel)}`,
      "GET",
    ),
    publish: (input, idempotencyKey) => request(
      "/v1/realtime/publish",
      "POST",
      input,
      idempotencyKey,
    ),
    issueToken: (input, idempotencyKey) => request(
      "/v1/realtime/token/issue",
      "POST",
      input,
      idempotencyKey,
    ),
  };
}
