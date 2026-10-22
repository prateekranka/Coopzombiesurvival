import { isRoomCode, randomRoomCode } from "@lifeline/protocol";

export { Room } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function roomStub(env: Env, code: string) {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") return json({ ok: true });

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomRoomCode();
        const res = await roomStub(env, code).fetch("https://room/create", { method: "POST" });
        if (res.ok) return json({ code });
      }
      return json({ error: "no-free-code" }, 503);
    }

    const ws = url.pathname.match(/^\/api\/rooms\/([A-Z]{4})\/ws$/);
    if (ws) {
      const code = ws[1]!;
      if (!isRoomCode(code)) return json({ error: "bad-code" }, 400);
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "expected-websocket" }, 426);
      return roomStub(env, code).fetch(`https://room/ws?code=${code}&${url.searchParams}`, request);
    }

    return json({ error: "not-found" }, 404);
  },
} satisfies ExportedHandler<Env>;
