# ALU Legal Companion: call signaling

A Cloudflare Worker that passes the set-up messages of a one-to-one call. The lawyer is the host and the person who booked is the guest. The two browsers send audio and video straight to each other. The Worker never sees the media and nothing is recorded.

- **Code:** `src/index.js` checks the request and the ticket. `src/room.js` is the Durable Object (`CallRoom`) that holds one room. `src/ticket.js` checks the ticket.
- **Runtime:** Cloudflare Workers with a Durable Object per room, SQLite storage
- **Tests:** Vitest with `@cloudflare/vitest-pool-workers`. They need no database and no network

## Endpoints

| Request | Answer |
|---|---|
| `GET /health` (or `HEAD`) | `200` with `{"status":"ok"}`. Any other method gets `405` |
| `GET /room/<32 lower-case hex characters>` with a WebSocket upgrade | Opens the room. The socket must offer two subprotocols: `alu-call.v1` and the ticket |
| Any other path | `404` |

The room answers in this order:

| Status | Why |
|---|---|
| `503` | `CALL_TICKET_SECRET` is missing or shorter than 32 characters |
| `426` | The request is not a WebSocket upgrade |
| `403` | The `Origin` header is not in `ALLOWED_ORIGINS` |
| `401` | The ticket is missing, not signed with the secret, expired, or made for another room |

## Tickets

The API signs a ticket with HS256 using `CALL_TICKET_SECRET`. A ticket holds the room, the role (`host` or `guest`), whether the call is audio only and the issue and expiry times. It lasts four hours. It holds no name and no email. The Worker checks the signature, the expiry and the room name.

## How a room behaves

- A room has one host slot and one guest slot. At most six sockets may be connected to a room, counting ones that have not yet said hello.
- The first message must be `hello` with the ticket. It must arrive within five seconds. Messages are limited to 16 KB and 200 messages every 10 seconds.
- A guest waits until the host admits them. When a guest arrives, the host gets a `knock`. The host answers with `admit` or `deny`.
- A denied guest gets `denied` and the socket closes. The guest may knock again after 10 seconds.
- An admitted guest who loses the connection has five minutes to come back without a new knock. After that the admission ends.
- A guest who leaves on purpose (`bye`) ends the admission at once and must knock again.
- The room closes when the newest ticket expires. Every socket is closed and the stored state is deleted.
- Signals (`signal`) are passed only between the two sides and only while the guest is admitted.

The known limit: a phone browser that is sent to the background may drop the connection. The guest then has five minutes to return.

## Configuration

Set these in `wrangler.toml` or with Wrangler:

| Name | Where | What it is |
|---|---|---|
| `ALLOWED_ORIGINS` | `wrangler.toml` (`[vars]`) | The website addresses allowed to open a call, separated by commas. The file sets the live website address |
| `CALL_TICKET_SECRET` | Wrangler secret | The same value as the API's `CALL_TICKET_SECRET`. At least 32 characters |

Set the secret with:

```bash
npx wrangler secret put CALL_TICKET_SECRET
```

The Durable Object binding is `CALL_ROOM` (class `CallRoom`). The first migration tag is `v1`.

For local development, put the secret in `.dev.vars`. That file is in `.gitignore`.

The API reads its side of this from its own settings: `CALL_SIGNAL_URL` is the Worker address and must start with `wss://`. The website's Content Security Policy in `render.yaml` must list the same Worker host.

## Commands

```bash
npm install
npm test        # Vitest in the Workers test pool
npm run dev     # wrangler dev, a local Worker
npm run deploy  # wrangler deploy
```
