import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/webhooks/whatsapp/route";

const VERIFY_TOKEN = "verify-token-teste";

function reqVerify(params: Record<string, string>): Request {
  const url = new URL("https://dbg.app/api/webhooks/whatsapp");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

describe("Webhook WhatsApp — verificação inicial (GET)", () => {
  beforeAll(() => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
  });

  it("devolve hub.challenge quando o verify_token confere", async () => {
    const res = await GET(
      reqVerify({
        "hub.mode": "subscribe",
        "hub.verify_token": VERIFY_TOKEN,
        "hub.challenge": "1234567890",
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1234567890");
  });

  it("responde 403 quando o verify_token não confere", async () => {
    const res = await GET(
      reqVerify({
        "hub.mode": "subscribe",
        "hub.verify_token": "errado",
        "hub.challenge": "1234567890",
      }),
    );
    expect(res.status).toBe(403);
  });
});
