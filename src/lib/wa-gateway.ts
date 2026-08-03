/**
 * Helper komunikasi dengan WhatsApp Gateway lokal (Express + Baileys).
 * Backend berjalan di http://localhost:5000 — lihat backend/server.js.
 */

const GATEWAY_URL = "http://localhost:5000";

export type WaGatewayStatus =
  | { status: "connected" | "connecting" | "disconnected"; qr?: string | null }
  | { status: "offline"; qr?: string | null };

export async function getWaGatewayStatus(): Promise<WaGatewayStatus> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/status`);
    if (!res.ok) throw new Error("offline");
    const data = await res.json();
    return {
      status: data.status || "disconnected",
      qr: data.qr || null,
    } as WaGatewayStatus;
  } catch {
    return { status: "offline", qr: null };
  }
}

export type SendWaResult = { ok: boolean; error?: string };

/** Kirim pesan teks ke nomor HP Indonesia (diproses backend: 08xx → 628xx). */
export async function sendWaMessage(phone: string, message: string): Promise<SendWaResult> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (res.ok && data.success) return { ok: true };
    return { ok: false, error: data.error || "Gagal mengirim pesan." };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message || "Server gateway WhatsApp tidak dapat dijangkau.",
    };
  }
}

export type WaGroup = { id: string; subject: string };

/** Ambil daftar grup WhatsApp yang diikuti bot gateway. */
export async function getWaGroups(): Promise<WaGroup[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/groups`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.groups) ? data.groups : [];
  } catch {
    return [];
  }
}

/** Kirim pesan teks ke JID WhatsApp penuh (mis. grup: 1203…@g.us). */
export async function sendWaMessageToJid(jid: string, message: string): Promise<SendWaResult> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: jid, message }),
    });
    const data = await res.json();
    if (res.ok && data.success) return { ok: true };
    return { ok: false, error: data.error || "Gagal mengirim pesan." };
  } catch (err) {
    return {
      ok: false,
      error: (err as Error).message || "Server gateway WhatsApp tidak dapat dijangkau.",
    };
  }
}
