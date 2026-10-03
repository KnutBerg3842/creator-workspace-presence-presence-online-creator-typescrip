import { z } from "zod";
import type { RealtimeTransport } from "./infrai_realtime.js";

export const deliveryRequestSchema = z.object({
  workspaceId: z.string().min(1),
  assetId: z.string().min(1),
  subscriberId: z.string().min(1),
  rendition: z.enum(["audio", "video", "image"]),
  deliveryId: z.string().uuid(),
}).strict();

export type DeliveryRequest = z.infer<typeof deliveryRequestSchema>;

export type DeliveryResult = {
  channel: string;
  assetId: string;
  state: "ready";
  online: unknown;
};

export async function completeDelivery(
  realtime: RealtimeTransport,
  input: DeliveryRequest,
): Promise<DeliveryResult> {
  const channel = `creator-workspace:${input.workspaceId}`;
  const eventData = {
    assetId: input.assetId,
    subscriberId: input.subscriberId,
    rendition: input.rendition,
    processingState: "ready" as const,
    deliveryId: input.deliveryId,
  };

  await realtime.publish({
    channel,
    event: "asset.delivery.ready",
    data: eventData,
    account_id: input.workspaceId,
  }, `delivery:${input.deliveryId}`);

  const online = await realtime.getPresence(channel);
  return { channel, assetId: input.assetId, state: "ready", online };
}

export const tokenRequestSchema = z.object({
  workspaceId: z.string().min(1),
  creatorId: z.string().min(1),
}).strict();

export async function issueWorkspaceToken(
  realtime: RealtimeTransport,
  input: z.infer<typeof tokenRequestSchema>,
): Promise<unknown> {
  const channel = `creator-workspace:${input.workspaceId}`;
  return realtime.issueToken({
    client_id: input.creatorId,
    channels: [channel],
    capabilities: ["subscribe", "presence"],
    ttl_seconds: 900,
  }, `workspace-token:${input.workspaceId}:${input.creatorId}`);
}
