import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { fakeReq, fakeRes } from "../../test-utils/fake-http.js";
import { createMessagesController } from "./controller.js";
import type { MessagesService } from "./service.js";

const principal = { userId: "user-1", email: "ana@example.com" };

function setup() {
  const service = {
    list: vi.fn(),
    send: vi.fn(),
    editQueued: vi.fn(),
    cancelQueued: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
  };
  return { service, controller: createMessagesController(service as unknown as MessagesService) };
}

describe("messages controller", () => {
  it("list: returns the chat's messages", async () => {
    const { service, controller } = setup();
    service.list.mockResolvedValue([{ id: "m1" }]);
    const res = fakeRes();

    await controller.list(fakeReq({ params: { chatId: "c1" } }), res);

    expect(service.list).toHaveBeenCalledWith(principal, "c1");
    expect(res.json).toHaveBeenCalledWith({ messages: [{ id: "m1" }] });
  });

  it("send: forwards the LLM key header and answers 201", async () => {
    const { service, controller } = setup();
    service.send.mockResolvedValue({ id: "m1" });
    const res = fakeRes();

    await controller.send(
      fakeReq({ params: { chatId: "c1" }, body: { content: " hello " }, headers: { "X-Llm-Api-Key": "sk-1" } }),
      res,
    );

    expect(service.send).toHaveBeenCalledWith(principal, "c1", { content: "hello", attachmentIds: [] }, "sk-1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: { id: "m1" } });
  });

  it("send: treats a missing or empty key header as no key", async () => {
    const { service, controller } = setup();
    service.send.mockResolvedValue({ id: "m1" });

    await controller.send(fakeReq({ params: { chatId: "c1" }, body: { content: "a" } }), fakeRes());
    await controller.send(fakeReq({ params: { chatId: "c1" }, body: { content: "a" }, headers: { "X-Llm-Api-Key": "" } }), fakeRes());

    expect(service.send.mock.calls[0]?.[3]).toBeUndefined();
    expect(service.send.mock.calls[1]?.[3]).toBeUndefined();
  });

  it("send: rejects empty content and more than 10 attachments", async () => {
    const { service, controller } = setup();
    const ids = Array.from({ length: 11 }, (_, i) => `a${i}`);

    await expect(controller.send(fakeReq({ params: { chatId: "c1" }, body: { content: "  " } }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    await expect(controller.send(fakeReq({ params: { chatId: "c1" }, body: { content: "x", attachmentIds: ids } }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    expect(service.send).not.toHaveBeenCalled();
  });

  it("edit: sends only the new content to editQueued", async () => {
    const { service, controller } = setup();
    service.editQueued.mockResolvedValue({ id: "m1", content: "new" });
    const res = fakeRes();

    await controller.edit(fakeReq({ params: { chatId: "c1", messageId: "m1" }, body: { content: "new" } }), res);

    expect(service.editQueued).toHaveBeenCalledWith(principal, "c1", "m1", "new");
    expect(res.json).toHaveBeenCalledWith({ message: { id: "m1", content: "new" } });
  });

  it("edit: refuses a body with an unknown field before calling the service (AICHAT-186)", async () => {
    const { service, controller } = setup();

    await expect(
      controller.edit(fakeReq({ params: { chatId: "c1", messageId: "m1" }, body: { content: "new", extra: 1 } }), fakeRes()),
    ).rejects.toThrow(/extra/);
    expect(service.editQueued).not.toHaveBeenCalled();
  });

  it("cancel: answers 204 without a body", async () => {
    const { service, controller } = setup();
    service.cancelQueued.mockResolvedValue(undefined);
    const res = fakeRes();

    await controller.cancel(fakeReq({ params: { chatId: "c1", messageId: "m1" } }), res);

    expect(service.cancelQueued).toHaveBeenCalledWith(principal, "c1", "m1");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("stop: returns the service result as is", async () => {
    const { service, controller } = setup();
    service.stop.mockResolvedValue({ stopped: true });
    const res = fakeRes();

    await controller.stop(fakeReq({ params: { chatId: "c1" } }), res);

    expect(service.stop).toHaveBeenCalledWith(principal, "c1");
    expect(res.json).toHaveBeenCalledWith({ stopped: true });
  });

  it("retry: forwards the key and answers 202", async () => {
    const { service, controller } = setup();
    service.retry.mockResolvedValue({ id: "m2" });
    const res = fakeRes();

    await controller.retry(fakeReq({ params: { chatId: "c1", messageId: "m1" }, headers: { "x-llm-api-key": "sk-2" } }), res);

    expect(service.retry).toHaveBeenCalledWith(principal, "c1", "m1", "sk-2");
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ message: { id: "m2" } });
  });

  it("rejects missing route params", async () => {
    const { service, controller } = setup();
    await expect(controller.cancel(fakeReq({ params: { chatId: "c1" } }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    expect(service.cancelQueued).not.toHaveBeenCalled();
  });
});
