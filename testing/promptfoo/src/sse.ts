/** One Server-Sent Events frame: `event: <name>` and `data: <json>`. */
export interface SseFrame {
  event: string;
  data: unknown;
}

/**
 * Incremental parser of the app's SSE stream. Feed it text as it arrives; it returns the frames that are
 * complete and keeps the rest for the next call. A frame whose data is not JSON keeps the raw text.
 */
export class SseParser {
  private buffer = "";

  push(text: string): SseFrame[] {
    this.buffer += text.replace(/\r\n/g, "\n");
    const frames: SseFrame[] = [];
    let end = this.buffer.indexOf("\n\n");
    while (end >= 0) {
      const raw = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 2);
      const frame = parseFrame(raw);
      if (frame) frames.push(frame);
      end = this.buffer.indexOf("\n\n");
    }
    return frames;
  }
}

function parseFrame(raw: string): SseFrame | undefined {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue; // comment, e.g. a keep-alive
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return undefined;
  const text = data.join("\n");
  try {
    return { event, data: JSON.parse(text) as unknown };
  } catch {
    return { event, data: text };
  }
}
