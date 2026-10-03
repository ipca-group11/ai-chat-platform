import { describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { ChatEventBus, initSseResponse, writeSseEvent } from "./sse.js";

describe("ChatEventBus", () => {
  it("AC-52: delivers published events to subscribers of the same chat", () => {
    const bus = new ChatEventBus();
    const received: unknown[] = [];
    bus.subscribe("chat-1", (event) => received.push(event));

    bus.publish("chat-1", { type: "token", messageId: "m1", token: "hi" });

    expect(received).toEqual([{ type: "token", messageId: "m1", token: "hi" }]);
  });

  it("AC-60/61: events for one chat are never delivered to another chat's subscribers", () => {
    const bus = new ChatEventBus();
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    bus.subscribe("chat-a", (event) => receivedA.push(event));
    bus.subscribe("chat-b", (event) => receivedB.push(event));

    bus.publish("chat-a", { type: "token", messageId: "m1", token: "a" });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);
  });

  it("unsubscribe stops further delivery", () => {
    const bus = new ChatEventBus();
    const received: unknown[] = [];
    const unsubscribe = bus.subscribe("chat-1", (event) => received.push(event));
    unsubscribe();

    bus.publish("chat-1", { type: "token", messageId: "m1", token: "hi" });

    expect(received).toHaveLength(0);
  });
});

describe("SSE response helpers", () => {
  it("AC-52: initSseResponse sets the event-stream content type", () => {
    const setHeader = vi.fn();
    const res = { status: vi.fn(), setHeader, flushHeaders: vi.fn() } as unknown as Response;

    initSseResponse(res);

    expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
  });

  it("AC-52: writeSseEvent writes a well-formed SSE frame", () => {
    const write = vi.fn();
    const res = { write } as unknown as Response;

    writeSseEvent(res, { type: "token", messageId: "m1", token: "hi" });

    expect(write).toHaveBeenCalledWith(
      `event: token\ndata: ${JSON.stringify({ type: "token", messageId: "m1", token: "hi" })}\n\n`,
    );
  });
});
