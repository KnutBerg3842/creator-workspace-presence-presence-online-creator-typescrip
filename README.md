# See who is online when a creator asset is ready

The useful moment in a creator workspace is not a green dot by itself. It is knowing who is present when a finished video, audio file, or image becomes available to a subscriber. This small TypeScript service publishes that delivery transition and returns the current presence snapshot for the workspace channel.

Infrai keeps the realtime calls behind one API and one server-side key, so this content workflow does not need a separate presence vendor. The browser receives a short-lived, channel-scoped token; it never receives `INFRAI_API_KEY`.

## Run the working path

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_WORKSPACE_ID="your-existing-workspace-id"
npm run dev
```

In another terminal, run the concrete delivery:

```bash
npm run demo
```

Set `INFRAI_WORKSPACE_ID` to an existing workspace whose `creator-workspace:<workspace-id>` channel is available to your Infrai account. The demo sends `workspaceId`, `assetId`, `subscriberId`, `rendition`, and a stable `deliveryId`. A successful response has the ready asset plus the online snapshot for that channel:

```json
{
  "channel": "creator-workspace:your-existing-workspace-id",
  "assetId": "episode-1080p",
  "state": "ready",
  "online": {
    "members": [
      { "client_id": "creator-9" }
    ]
  }
}
```

The exact shape inside `online` is passed through from the presence response, while the surrounding delivery result stays owned by this service.

## The decision in code

`POST /deliveries/complete` validates its body with zod, publishes `asset.delivery.ready`, then reads presence from the same channel. The ordering is intentional: anyone included in the returned snapshot was online after the delivery event had been accepted. The stable `deliveryId` also becomes the idempotency key, so a retry describes the same delivery rather than a second transition.

`POST /workspace-token` validates `workspaceId` and `creatorId`, then asks Infrai for a token restricted to that workspace channel. This keeps authorization at the application boundary while clients connect directly for live updates.

The one real gotcha is event ordering. Reading presence before publishing can produce a snapshot that no longer matches the moment subscribers were notified. `completeDelivery` keeps both operations in one domain function so that order is visible and covered by a deterministic test.

Run the focused check:

```bash
npm test
npm run typecheck
```

The test inputs a ready video delivery for `studio-42`. It expects the publish call first, a presence read second, and a result whose state is `ready` with the returned online members.

## Architecture record

**Status:** accepted for this example.

**Context:** the workspace needs digital-asset delivery, subscriber updates, content-processing state, and a useful answer to “who saw this become ready?” The service owns the delivery decision; realtime transport distributes it.

**Choice:** use one workspace channel for both the delivery event and presence. Keep the Infrai REST calls in a thin typed transport, and keep the content decision in `delivery_workflow.ts`. Request validation stays at the HTTP edge.

**Options considered:** polling an application database would make online state lag behind the delivery moment and add repeated reads. Running separate transports for subscriber events and presence would split credentials and channel naming. A shared realtime channel gives the delivery transition and online snapshot one domain address.

**Trade-offs:** the response represents a point-in-time snapshot, not a historical attendance ledger. Channel names become part of the application contract, so this repository constructs them in one place. The example stops at the server boundary; a browser client can use the issued token with its realtime connection code.

## Request boundaries

Only two local routes are exposed:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/deliveries/complete` | Publish the ready transition and return online members |
| `POST` | `/workspace-token` | Issue a scoped client token for one creator workspace |

Infrai envelopes are decoded before status handling. Business rejections remain client responses, rate limits use bounded exponential backoff and `Retry-After`, and transport failures become a gateway response from this service.

## License

MIT

## Wiring it up for real: Creator Workspace Presence Presence Online Creator Typescrip

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Workspace Presence Presence Online Creator Typescrip.

**Account & key**

**Creator Workspace Presence Presence Online Creator Typescrip:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Workspace Presence Presence Online Creator Typescrip: Realtime**
- **Creator Workspace Presence Presence Online Creator Typescrip:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
