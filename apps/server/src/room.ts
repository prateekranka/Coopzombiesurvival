import { DurableObject } from "cloudflare:workers";
import type { ControlMessage, Role, ServerMessage } from "@lifeline/protocol";

// One Durable Object per room. It relays messages between the two iPads and keeps the
// Duck save. It runs no game rules: the host iPad owns the simulation. GAME.md section 10.

const other = (role: Role): Role => (role === "host" ? "guest" : "host");

export class Room extends DurableObject {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/create") {
      if (await this.ctx.storage.get("createdAt")) return new Response("taken", { status: 409 });
      await this.ctx.storage.put("createdAt", Date.now());
      return new Response("ok");
    }

    if (url.pathname === "/ws") {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      const role: Role = url.searchParams.get("role") === "host" ? "host" : "guest";
      this.ctx.acceptWebSocket(server, [role]);

      if (!(await this.ctx.storage.get("createdAt"))) {
        this.sendTo(server, { t: "error", reason: "not-found" });
        server.close(4004, "not-found");
        return new Response(null, { status: 101, webSocket: client });
      }

      // A new socket for a role replaces the old one, so a dropped iPad can rejoin at once.
      for (const old of this.ctx.getWebSockets(role)) {
        if (old !== server) old.close(4000, "replaced");
      }

      const code = url.searchParams.get("code") ?? "";
      const peerPresent = this.ctx.getWebSockets(other(role)).length > 0;
      const save = (await this.ctx.storage.get("save")) ?? null;
      this.sendTo(server, { t: "welcome", role, code, peerPresent, save });
      this.broadcast(other(role), { t: "peer", role, present: true });
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const role = this.roleOf(ws);
    if (!role) return;

    if (typeof message === "string") {
      let msg: ControlMessage;
      try {
        msg = JSON.parse(message) as ControlMessage;
      } catch {
        return;
      }
      if (msg.t === "save") {
        if (role === "host") await this.ctx.storage.put("save", msg.data);
        return;
      }
    }

    for (const peer of this.ctx.getWebSockets(other(role))) peer.send(message);
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code);
    } catch {
      // Already closed.
    }
    const role = this.roleOf(ws);
    // Code 4000 means a newer socket took this role, so the peer stays connected.
    if (role && code !== 4000 && this.ctx.getWebSockets(role).every((s) => s === ws)) {
      this.broadcast(other(role), { t: "peer", role, present: false });
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011);
  }

  private roleOf(ws: WebSocket): Role | undefined {
    const tag = this.ctx.getTags(ws)[0];
    return tag === "host" || tag === "guest" ? tag : undefined;
  }

  private sendTo(ws: WebSocket, msg: ServerMessage) {
    ws.send(JSON.stringify(msg));
  }

  private broadcast(role: Role, msg: ServerMessage) {
    for (const ws of this.ctx.getWebSockets(role)) this.sendTo(ws, msg);
  }
}
