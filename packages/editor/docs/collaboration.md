# Live collaboration

A saved document (`source`) can be edited by several people at once. Everyone sees each other's text, cursors and
selections live, and comment threads sync too. The editor uses Lexical's `CollaborationPlugin` with
[Yjs](https://yjs.dev) and a y-websocket provider. Syncing and Yjs undo come from Lexical.

## What you need

1. A `documents` adapter and a `source` on the editor. Live editing only applies to saved documents.
2. A y-websocket server (protocol of y-websocket 2.x).
3. The `collaboration` adapter, pointing at the server:

   ```ts
   const adapters: EditorAdapters = {
     currentUser,
     documents,
     collaboration: { url: "wss://example.com/yjs-ws" },
   };
   ```

Without `collaboration`, the editor never opens a socket. Each person edits alone, and saves still go through
`documents`.

## Running a server

For local development, the `y-websocket` package's server is enough:

```bash
HOST=localhost PORT=1234 npx y-websocket
```

Then use `collaboration: { url: "ws://localhost:1234" }`. The playground does exactly this (`npm run
collab-server`, then open `http://localhost:5190/?collab=1` in two tabs, with `&user=grace` in one).

In production, run a server that checks who may join a room. jaggle-app-fe's `yjs-server.mjs` is an example. It
reads a ticket from the socket's subprotocols, asks the core API whether that person may open the document, and
re-checks open sockets every minute.

The server doesn't need to persist anything. Documents are loaded from and saved to your backend through the
`documents` adapter, and the room only carries the live session.

## Rooms

The editor joins the room

```
`${source.roomId}:lexical:r${revision}`
```

at `${collaboration.url}/${room}`:

- `source.roomId` is your name for the document, unique per document, for example
  `` `${workspaceId}:task-${taskId}` ``. The `:lexical` suffix keeps a Lexical Y.Doc out of rooms that another
  editor (the old BlockNote one) uses.
- `revision` is the stored revision from `documents.load`, or `0`. When the document is written outside the editor,
  the backend bumps it, and the next people to open the document join a fresh room seeded from the new content. See
  [Revisions](document-editor.md#revisions).

Every app that opens the same documents must use the same room names, Y.Doc keys and file references. The
[package README](../README.md#contracts-shared-between-apps) lists these contracts.

## Joining and syncing

1. The editor loads the stored document, then connects.
2. The stored Y.Doc is applied as the editor connects. People already in the room merge with it without getting a
   second copy, because everyone's state descends from the same saved state. Stored HTML (a document last written
   outside the editor) is imported only into a room that is still empty once synced.
3. If the server can't be reached, the document opens after 4 seconds anyway, and saves keep working. The socket
   keeps retrying in the background.
4. Only local edits are saved. Changes arriving from the room aren't saved again by everyone who receives them. Each
   person saves their own work, and each save carries the whole Y.Doc.

## Presence

Remote cursors and selections show each person's `currentUser`:

| Field | |
|---|---|
| `name` | The label on their cursor |
| `color` | Their cursor colour. When unset, one is picked from their `id`, so it's the same everywhere. |
| `avatarUrl` | Sent with their presence |

## Authorising sockets

`collaboration.webSocketFor(room)` returns the WebSocket class to use for one room (y-websocket's
`WebSocketPolyfill`). Use it to attach credentials:

```ts
type CollaborationRoom = {
  entityType: string;
  entityId: string;
  documentKey: string;
  room: string; // the full room name
};
```

With a ticket you already have, a subclass is enough:

```ts
const collaboration: CollaborationAdapter = {
  url: YJS_URL,
  webSocketFor: (room) => {
    const ticket = ticketFor(room.room); // your short-lived credential for this room
    return class TicketedWebSocket extends WebSocket {
      constructor(url: string | URL) {
        super(url, ["yjs", `ticket.${ticket}`]); // the subprotocols your server expects
      }
    };
  },
};
```

y-websocket creates a new socket on every reconnect. A ticket that must be fetched for each attempt needs a class
that fetches it first and then opens the real socket. jaggle-app-fe's `createTicketedWebSocket`
(`src/lib/yjs-ticket-websocket.ts`) does that:

```ts
webSocketFor: (room) => createTicketedWebSocket(() => requestYjsTicket(room.room)),
```

Browsers can't set headers on a WebSocket, so send credentials as a subprotocol (as above) or in the URL. A
subprotocol stays out of server logs.

## Development notes

- **React StrictMode** is supported. Its simulated unmount in development doesn't tear down the live connection.
- **Testing locally:** open the same document in two windows as two different users. Two tabs of one user
  also work, but both show the same name.
- **Yjs must exist once.** Two copies of `yjs` in the bundle break syncing ("Yjs was already imported" in the
  console). See [Troubleshooting](troubleshooting.md#lexical-or-yjs-is-loaded-twice).
