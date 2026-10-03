const workspaceId = process.env.INFRAI_WORKSPACE_ID;
if (!workspaceId) throw new Error("Set INFRAI_WORKSPACE_ID to an existing workspace before running the demo");

const response = await fetch("http://localhost:3000/deliveries/complete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workspaceId,
    assetId: "episode-1080p",
    subscriberId: "member-17",
    rendition: "video",
    deliveryId: "936da01f-9abd-4d9d-80c7-02af85c822a8",
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
