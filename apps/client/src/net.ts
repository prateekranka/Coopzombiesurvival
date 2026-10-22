import type { PeerMessage, Role, ServerMessage } from "@lifeline/protocol";

// WebSocket link to the room relay. GAME.md section 10.
// It reconnects on its own for 60 seconds, so a dropped iPad can rejoin the same room.

export interface NetEvents {
  onWelcome(msg: Extract<ServerMessage, { t: "welcome" }>): void;
  onPeer(present: boolean): void;
  onControl(msg: PeerMessage): void;
  onBinary(buf: ArrayBuffer): void;
  onStatus(status: NetStatus): void;
}

export type NetStatus = "connecting" | "open" | "reconnecting" | "closed";

const REJOIN_WINDOW_MS = 60_000;

export async function createRoom(): Promise<string> {
  const res = await fetch("/api/rooms", { method: "POST" });
  if (!res.ok) throw new Error(`Could not create a room (${res.status})`);
  const body = (await res.json()) as { code: string };
  return body.code;
}

export class NetClient {
  private ws: WebSocket | undefined;
  private closedAt = 0;
  private stopped = false;
  private retry = 0;

  constructor(
    readonly code: string,
    readonly role: Role,
    private readonly events: NetEvents,
  ) {
    this.open();
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(data: ArrayBuffer | PeerMessage): void {
    if (!this.isOpen) return;
    this.ws!.send(data instanceof ArrayBuffer ? data : JSON.stringify(data));
  }

  close(): void {
    this.stopped = true;
    this.ws?.close(1000);
    this.events.onStatus("closed");
  }

  private open() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${this.code}/ws?role=${this.role}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.events.onStatus(this.closedAt ? "reconnecting" : "connecting");

    ws.onopen = () => {
      this.retry = 0;
      this.closedAt = 0;
      this.events.onStatus("open");
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        this.events.onBinary(e.data);
        return;
      }
      const msg = JSON.parse(e.data as string) as ServerMessage | PeerMessage;
      switch (msg.t) {
        case "welcome":
          this.events.onWelcome(msg);
          break;
        case "peer":
          this.events.onPeer(msg.present);
          break;
        case "error":
          this.stopped = true;
          this.events.onStatus("closed");
          break;
        default:
          this.events.onControl(msg);
      }
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      // 4000: another tab took this role. 4004: no such room.
      if (this.stopped || e.code === 4000 || e.code === 4004) {
        this.stopped = true;
        this.events.onStatus("closed");
        return;
      }
      this.closedAt ||= performance.now();
      if (performance.now() - this.closedAt > REJOIN_WINDOW_MS) {
        this.events.onStatus("closed");
        return;
      }
      this.events.onStatus("reconnecting");
      const delay = Math.min(250 * 2 ** this.retry++, 4000);
      setTimeout(() => this.open(), delay);
    };
  }
}
