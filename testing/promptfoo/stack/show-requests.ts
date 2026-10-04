// Prints what the LLM mock received from the app, one line per request: whether the canary system prompt, an image and
// the web fetch tool reached the model. Proof that the harness goes through the real request path.
//   node testing/promptfoo/stack/show-requests.ts [http://127.0.0.1:4010]
interface MockRequest {
  body: { system?: string; messages: Array<{ content: unknown }>; tools?: Array<{ type: string }> };
}

const base = process.argv[2] ?? "http://127.0.0.1:4010";
const { requests } = (await (await fetch(`${base}/__admin/requests?mock=anthropic`)).json()) as { requests: MockRequest[] };
requests.forEach(({ body }, index) => {
  const last = body.messages.at(-1)?.content;
  const image = body.messages.some((m) => Array.isArray(m.content) && m.content.some((c: { type?: string }) => c.type === "image"));
  const system = body.system ? `yes (${body.system.length} chars, canary: ${body.system.includes("CANARY")})` : "no";
  const text = typeof last === "string" ? last.slice(0, 60) : "[content blocks]";
  console.log(`#${index + 1} messages=${body.messages.length} system=${system} image=${image} tools=${(body.tools ?? []).map((t) => t.type).join(",") || "-"} last="${text}"`);
});
