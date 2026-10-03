import assert from "node:assert/strict";
import test from "node:test";
import { completeDelivery } from "../src/delivery_workflow.js";
import type { RealtimeTransport } from "../src/infrai_realtime.js";

test("publishes ready delivery before taking the online snapshot", async () => {
  const calls: string[] = [];
  const realtime: RealtimeTransport = {
    async publish(input, idempotencyKey) {
      calls.push(`publish:${input.event}:${idempotencyKey}`);
      assert.equal(input.channel, "creator-workspace:studio-42");
      assert.equal(input.account_id, "studio-42");
      return {};
    },
    async getPresence(channel) {
      calls.push(`presence:${channel}`);
      return { members: [{ client_id: "creator-9" }] };
    },
    async issueToken() {
      throw new Error("Unexpected token request");
    },
  };

  const result = await completeDelivery(realtime, {
    workspaceId: "studio-42",
    assetId: "episode-1080p",
    subscriberId: "member-17",
    rendition: "video",
    deliveryId: "936da01f-9abd-4d9d-80c7-02af85c822a8",
  });

  assert.deepEqual(calls, [
    "publish:asset.delivery.ready:delivery:936da01f-9abd-4d9d-80c7-02af85c822a8",
    "presence:creator-workspace:studio-42",
  ]);
  assert.equal(result.state, "ready");
  assert.deepEqual(result.online, { members: [{ client_id: "creator-9" }] });
});
