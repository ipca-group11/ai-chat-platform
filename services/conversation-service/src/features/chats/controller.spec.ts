import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { fakeReq, fakeRes } from "../../test-utils/fake-http.js";
import { createChatsController } from "./controller.js";
import type { ChatsService } from "./service.js";

const principal = { userId: "user-1", email: "ana@example.com" };

function setup() {
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    leave: vi.fn(),
  };
  return { service, controller: createChatsController(service as unknown as ChatsService) };
}

describe("chats controller", () => {
  it("list: returns the caller's chats", async () => {
    const { service, controller } = setup();
    service.list.mockResolvedValue([{ id: "c1" }]);
    const res = fakeRes();

    await controller.list(fakeReq(), res);

    expect(service.list).toHaveBeenCalledWith(principal);
    expect(res.json).toHaveBeenCalledWith({ chats: [{ id: "c1" }] });
  });

  it("create: parses the body, passes the principal and answers 201", async () => {
    const { service, controller } = setup();
    service.create.mockResolvedValue({ id: "c1" });
    const res = fakeRes();

    await controller.create(
      fakeReq({ body: { title: "  Notes  ", provider: "anthropic", model: "claude-haiku-4-5" } }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith(principal, { title: "Notes", provider: "anthropic", model: "claude-haiku-4-5" });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ chat: { id: "c1" } });
  });

  it("create: rejects an invalid body before calling the service", async () => {
    const { service, controller } = setup();
    await expect(controller.create(fakeReq({ body: { title: "", provider: "x", model: "" } }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    expect(service.create).not.toHaveBeenCalled();
  });

  it("get: reads the id from the route params", async () => {
    const { service, controller } = setup();
    service.get.mockResolvedValue({ id: "c9" });
    const res = fakeRes();

    await controller.get(fakeReq({ params: { id: "c9" } }), res);

    expect(service.get).toHaveBeenCalledWith(principal, "c9");
    expect(res.json).toHaveBeenCalledWith({ chat: { id: "c9" } });
  });

  it("update: passes the user id (not the principal) and the parsed patch", async () => {
    const { service, controller } = setup();
    service.update.mockResolvedValue({ id: "c1", title: "New" });
    const res = fakeRes();

    await controller.update(fakeReq({ params: { id: "c1" }, body: { title: "New" } }), res);

    expect(service.update).toHaveBeenCalledWith("user-1", "c1", { title: "New" });
    expect(res.json).toHaveBeenCalledWith({ chat: { id: "c1", title: "New" } });
  });

  it("update: rejects an empty patch", async () => {
    const { service, controller } = setup();
    await expect(controller.update(fakeReq({ params: { id: "c1" }, body: {} }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("remove: answers 204 with no body", async () => {
    const { service, controller } = setup();
    service.remove.mockResolvedValue(undefined);
    const res = fakeRes();

    await controller.remove(fakeReq({ params: { id: "c1" } }), res);

    expect(service.remove).toHaveBeenCalledWith("user-1", "c1");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("listMembers: wraps the members", async () => {
    const { service, controller } = setup();
    service.listMembers.mockResolvedValue([{ email: "a@b.pt" }]);
    const res = fakeRes();

    await controller.listMembers(fakeReq({ params: { id: "c1" } }), res);

    expect(service.listMembers).toHaveBeenCalledWith(principal, "c1");
    expect(res.json).toHaveBeenCalledWith({ members: [{ email: "a@b.pt" }] });
  });

  it("addMember: lower-cases the e-mail and answers 201", async () => {
    const { service, controller } = setup();
    service.addMember.mockResolvedValue({ email: "bia@example.com" });
    const res = fakeRes();

    await controller.addMember(fakeReq({ params: { id: "c1" }, body: { email: " Bia@Example.com " } }), res);

    expect(service.addMember).toHaveBeenCalledWith(principal, "c1", "bia@example.com");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ member: { email: "bia@example.com" } });
  });

  it("addMember: rejects an invalid e-mail", async () => {
    const { service, controller } = setup();
    await expect(controller.addMember(fakeReq({ params: { id: "c1" }, body: { email: "nope" } }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    expect(service.addMember).not.toHaveBeenCalled();
  });

  it("removeMember: takes id and e-mail from the params and answers 204", async () => {
    const { service, controller } = setup();
    service.removeMember.mockResolvedValue(undefined);
    const res = fakeRes();

    await controller.removeMember(fakeReq({ params: { id: "c1", email: "Bia@Example.com" } }), res);

    expect(service.removeMember).toHaveBeenCalledWith(principal, "c1", "bia@example.com");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("leave: answers 204", async () => {
    const { service, controller } = setup();
    service.leave.mockResolvedValue(undefined);
    const res = fakeRes();

    await controller.leave(fakeReq({ params: { id: "c1" } }), res);

    expect(service.leave).toHaveBeenCalledWith(principal, "c1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("propagates service errors so the error handler can map them", async () => {
    const { service, controller } = setup();
    service.get.mockRejectedValue(new Error("forbidden"));
    await expect(controller.get(fakeReq({ params: { id: "c1" } }), fakeRes())).rejects.toThrow("forbidden");
  });
});
