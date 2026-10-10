// Holds one chat stream open with nothing being generated and prints every line it receives, with the
// time since the stream was opened (AICHAT-171). Behind a proxy or load balancer with an idle timeout
// (Azure: ~4 min), a stream with no bytes is cut; with the server heartbeat (": ping" every 15 s,
// AICHAT-169) it stays open.
//
//   node scripts/sse/idle-stream.ts [--base https://<domain>] [--minutes 6]
//
// Signs in with SSE_EMAIL / SSE_PASSWORD, or registers a throwaway account when they are not set.
// Creates a chat, streams it, deletes the chat at the end. Exit code: 0 if the stream stayed open for
// the whole run, 1 if it was cut.

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");

const base = (args.get("base") ?? "http://localhost:8000").replace(/\/$/, "");
const minutes = Number(args.get("minutes") ?? "6");
const started = Date.now();
const stamp = () => `${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s`;

async function signIn(): Promise<string> {
  let email = process.env["SSE_EMAIL"];
  let password = process.env["SSE_PASSWORD"];
  if (!email || !password) {
    email = `sse-idle-${Date.now()}@example.com`;
    password = `Idle${Date.now()}pass`;
    const res = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.status !== 201) throw new Error(`register: HTTP ${res.status} ${await res.text()}`);
    console.log(`registered throwaway account ${email}`);
  }
  const res = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`login: HTTP ${res.status} ${await res.text()}`);
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function main(): Promise<number> {
  console.log(`target ${base}, holding an idle stream for ${minutes} min`);
  const cookie = await signIn();
  const created = await fetch(`${base}/api/chats`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ title: "Idle stream check", provider: "anthropic", model: "claude-haiku-4-5" }),
  });
  if (created.status !== 201) throw new Error(`create chat: HTTP ${created.status} ${await created.text()}`);
  const chatId = ((await created.json()) as { chat: { id: string } }).chat.id;

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), minutes * 60_000);
  const opened = Date.now();
  let lastByte = opened;
  let longestGap = 0;
  let pings = 0;
  let cut = false;
  try {
    const res = await fetch(`${base}/api/chats/${chatId}/stream`, { headers: { cookie, accept: "text/event-stream" }, signal: stop.signal });
    console.log(`${stamp()}  HTTP ${res.status} ${res.headers.get("content-type")}`);
    const decoder = new TextDecoder();
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      longestGap = Math.max(longestGap, Date.now() - lastByte);
      lastByte = Date.now();
      for (const line of decoder.decode(chunk, { stream: true }).split("\n").filter(Boolean)) {
        if (line === ": ping") pings++;
        console.log(`${stamp()}  ${line}`);
      }
    }
    cut = true;
    console.log(`${stamp()}  stream ended by the other side`);
  } catch (err) {
    if (stop.signal.aborted) console.log(`${stamp()}  run finished, closing the stream`);
    else {
      cut = true;
      console.log(`${stamp()}  stream failed: ${(err as Error).message}`);
    }
  } finally {
    clearTimeout(timer);
    await fetch(`${base}/api/chats/${chatId}`, { method: "DELETE", headers: { cookie } }).catch(() => undefined);
  }

  const openFor = ((Date.now() - opened) / 1000).toFixed(0);
  console.log(`\nopen for ${openFor} s, ${pings} heartbeats, longest silence ${(longestGap / 1000).toFixed(1)} s`);
  console.log(cut ? "RESULT: the idle stream was CUT" : `RESULT: the idle stream stayed open for the whole ${minutes} min`);
  return cut ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error((err as Error).message);
    process.exit(2);
  },
);
