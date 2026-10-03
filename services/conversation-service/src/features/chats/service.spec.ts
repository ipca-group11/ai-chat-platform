import { describe, expect, it } from "vitest";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { ChatsService } from "./service.js";
import { HttpError } from "../../shared/error-handler.js";
import { asUser } from "../../test-utils/principal.js";

function createService() {
  const repo = new FakeChatsRepository();
  return { repo, service: new ChatsService(repo) };
}

describe("ChatsService", () => {
  it("AC-42: a user can create, list, and open chats", async () => {
    const { service } = createService();
    const created = await service.create(asUser("user-1"), { title: "My chat", provider: "anthropic", model: "claude-haiku-4-5" });
    expect(created.title).toBe("My chat");

    const list = await service.list(asUser("user-1"));
    expect(list).toHaveLength(1);

    const fetched = await service.get(asUser("user-1"), created.id);
    expect(fetched.id).toBe(created.id);
  });

  it("AC-42: a user can rename a chat", async () => {
    const { service } = createService();
    const created = await service.create(asUser("user-1"), { title: "Old", provider: "anthropic", model: "claude-haiku-4-5" });
    const renamed = await service.update("user-1", created.id, { title: "New" });
    expect(renamed.title).toBe("New");
  });

  it("AC-42/AC-44: a user can delete a chat", async () => {
    const { service, repo } = createService();
    const created = await service.create(asUser("user-1"), { title: "Bye", provider: "anthropic", model: "claude-haiku-4-5" });
    await service.remove("user-1", created.id);
    expect(repo.has(created.id)).toBe(false);
    await expect(service.get(asUser("user-1"), created.id)).rejects.toBeInstanceOf(HttpError);
  });

  it("AC-45: get/update/delete are checked against the authenticated user's ownership", async () => {
    const { service } = createService();
    const chat = await service.create(asUser("owner"), { title: "Private", provider: "anthropic", model: "claude-haiku-4-5" });

    await expect(service.get(asUser("intruder"), chat.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.update("intruder", chat.id, { title: "hacked" })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.remove("intruder", chat.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("AC-46: user B requesting user A's chat ID receives a 404", async () => {
    const { service } = createService();
    const chat = await service.create(asUser("user-a"), { title: "A's chat", provider: "anthropic", model: "claude-haiku-4-5" });

    try {
      await service.get(asUser("user-b"), chat.id);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(404);
    }
  });

  it("AC-47: chat list never returns another user's chats", async () => {
    const { service } = createService();
    await service.create(asUser("user-a"), { title: "A1", provider: "anthropic", model: "claude-haiku-4-5" });
    await service.create(asUser("user-b"), { title: "B1", provider: "anthropic", model: "claude-haiku-4-5" });

    const listA = await service.list(asUser("user-a"));
    expect(listA).toHaveLength(1);
    expect(listA[0]?.title).toBe("A1");
  });

  it("AC-48/AC-49: the selected provider and model are persisted per chat", async () => {
    const { service } = createService();
    const chat = await service.create(asUser("user-1"), { title: "GPT chat", provider: "openai", model: "gpt-4o-mini" });
    expect(chat.provider).toBe("openai");
    expect(chat.model).toBe("gpt-4o-mini");

    const fetched = await service.get(asUser("user-1"), chat.id);
    expect(fetched.provider).toBe("openai");
    expect(fetched.model).toBe("gpt-4o-mini");
  });

  it("AC-48/AC-49: the provider and model can be changed when editing a chat", async () => {
    const { service } = createService();
    const chat = await service.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const updated = await service.update("user-1", chat.id, { provider: "anthropic", model: "claude-3-5-sonnet" });
    expect(updated.provider).toBe("anthropic");
    expect(updated.model).toBe("claude-3-5-sonnet");
  });

  it("reasoning is off by default and can be set at creation or toggled later", async () => {
    const { service } = createService();
    const plain = await service.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-sonnet-5-5" });
    expect(plain.reasoning).toBe(false);

    const thinking = await service.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-sonnet-5-5", reasoning: true });
    expect(thinking.reasoning).toBe(true);

    const toggled = await service.update("user-1", plain.id, { reasoning: true });
    expect(toggled.reasoning).toBe(true);
    expect((await service.get(asUser("user-1"), plain.id)).reasoning).toBe(true);
  });

  it("web fetch is off by default, can be set at creation or toggled later, by the owner only", async () => {
    const { service } = createService();
    const plain = await service.create(asUser("owner"), { title: "Chat", provider: "anthropic", model: "claude-opus-5-5" });
    expect(plain.webFetch).toBe(false);
    const fetching = await service.create(asUser("owner"), { title: "Chat", provider: "anthropic", model: "claude-opus-5-5", webFetch: true });
    expect(fetching.webFetch).toBe(true);

    expect((await service.update("owner", plain.id, { webFetch: true })).webFetch).toBe(true);
    await service.addMember(asUser("owner"), plain.id, "guest@example.com");
    await expect(service.update("guest", plain.id, { webFetch: false })).rejects.toBeInstanceOf(HttpError);
  });

  it("only the owner can toggle reasoning", async () => {
    const { service } = createService();
    const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-sonnet-5-5" });
    await service.addMember(asUser("owner"), chat.id, "guest@example.com");

    await expect(service.update("guest", chat.id, { reasoning: true })).rejects.toBeInstanceOf(HttpError);
  });

  describe("sharing", () => {
    it("an invited member sees the chat in their list and can open it", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });

      await service.addMember(asUser("owner"), chat.id, "guest@example.com");

      const list = await service.list(asUser("guest"));
      expect(list.map((c) => c.id)).toEqual([chat.id]);
      await expect(service.get(asUser("guest"), chat.id)).resolves.toMatchObject({ id: chat.id });
    });

    it("lists the owner first, then invited members", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await service.addMember(asUser("owner"), chat.id, "guest@example.com");

      const members = await service.listMembers(asUser("guest"), chat.id);
      expect(members.map((m) => [m.email, m.role])).toEqual([
        ["owner@example.com", "owner"],
        ["guest@example.com", "member"],
      ]);
    });

    it("members cannot rename, delete, or invite", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await service.addMember(asUser("owner"), chat.id, "guest@example.com");

      await expect(service.update("guest", chat.id, { title: "mine now" })).rejects.toMatchObject({ statusCode: 404 });
      await expect(service.remove("guest", chat.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(service.addMember(asUser("guest"), chat.id, "other@example.com")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("rejects inviting yourself or someone who is already a member", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await service.addMember(asUser("owner"), chat.id, "guest@example.com");

      await expect(service.addMember(asUser("owner"), chat.id, "owner@example.com")).rejects.toMatchObject({
        statusCode: 400,
      });
      await expect(service.addMember(asUser("owner"), chat.id, "guest@example.com")).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("the owner can remove a member, who then loses access", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await service.addMember(asUser("owner"), chat.id, "guest@example.com");

      await service.removeMember(asUser("owner"), chat.id, "guest@example.com");

      await expect(service.get(asUser("guest"), chat.id)).rejects.toMatchObject({ statusCode: 404 });
      expect(await service.list(asUser("guest"))).toHaveLength(0);
    });

    it("a member can leave, but cannot remove other members", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await service.addMember(asUser("owner"), chat.id, "guest@example.com");
      await service.addMember(asUser("owner"), chat.id, "other@example.com");

      await expect(service.removeMember(asUser("guest"), chat.id, "other@example.com")).rejects.toMatchObject({
        statusCode: 403,
      });
      await service.leave(asUser("guest"), chat.id);
      await expect(service.get(asUser("guest"), chat.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(service.get(asUser("other"), chat.id)).resolves.toMatchObject({ id: chat.id });
    });

    it("the owner cannot leave their own chat", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await expect(service.leave(asUser("owner"), chat.id)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("outsiders cannot see the member list", async () => {
      const { service } = createService();
      const chat = await service.create(asUser("owner"), { title: "Shared", provider: "anthropic", model: "claude-haiku-4-5" });
      await expect(service.listMembers(asUser("intruder"), chat.id)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
