import type { chat } from "@app/shared-types";
import { createFactories, type Factories } from "./factories.js";
import type { Dataset, DatasetCounts } from "./types.js";

export const DATASET_NAMES = [
  "empty",
  "default",
  "many-chats",
  "long-conversation",
  "shared-chats",
  "attachments",
] as const;
export type DatasetName = (typeof DATASET_NAMES)[number];

export const MANY_CHATS_COUNT = 220;
export const LONG_CONVERSATION_MESSAGES = 500;

type Builder = (f: Factories) => Dataset;

const emptyDataset = (): Dataset => ({
  users: [],
  chats: [],
  members: [],
  messages: [],
  attachments: [],
  providerKeys: [],
});

/** A chat with its owner row and `count` alternating user / assistant messages. */
function addChat(
  data: Dataset,
  f: Factories,
  ownerId: string,
  count: number,
  overrides: Partial<chat.Chat> = {},
): chat.Chat {
  const owner = data.users.find((u) => u.id === ownerId);
  const created = f.chat({ ownerId, ...overrides });
  data.chats.push(created);
  data.members.push(f.member({ chatId: created.id, email: owner?.email ?? null, role: "owner" }));
  for (let i = 0; i < count; i++) {
    const make = i % 2 === 0 ? f.userMessage : f.assistantMessage;
    data.messages.push(make({ chatId: created.id }));
  }
  return created;
}

const builders: Record<DatasetName, Builder> = {
  empty: emptyDataset,

  default(f) {
    const data = emptyDataset();
    const [alice, bob] = [f.user({ email: "alice@mock.test" }), f.user({ email: "bob@mock.test" })];
    data.users.push(alice, bob);
    data.providerKeys.push(
      f.providerKey({ userId: alice.id, provider: "anthropic" }),
      f.providerKey({ userId: alice.id, provider: "openai" }),
    );
    addChat(data, f, alice.id, 4, { title: "Welcome", provider: "anthropic" });
    const reasoning = addChat(data, f, alice.id, 0, { title: "Reasoning example", reasoning: true });
    data.messages.push(
      f.userMessage({ chatId: reasoning.id }),
      f.thinkingMessage({ chatId: reasoning.id }),
    );
    const web = addChat(data, f, alice.id, 0, { title: "Web fetch example", webFetch: true });
    data.messages.push(f.userMessage({ chatId: web.id }), f.webFetchMessage({ chatId: web.id }));
    addChat(data, f, bob.id, 2, { title: "Bob's chat", provider: "openai" });
    return data;
  },

  "many-chats"(f) {
    const data = emptyDataset();
    const user = f.user({ email: "alice@mock.test" });
    data.users.push(user);
    for (let i = 0; i < MANY_CHATS_COUNT; i++) addChat(data, f, user.id, 2);
    return data;
  },

  "long-conversation"(f) {
    const data = emptyDataset();
    const user = f.user({ email: "alice@mock.test" });
    data.users.push(user);
    addChat(data, f, user.id, LONG_CONVERSATION_MESSAGES, { title: "Long conversation" });
    return data;
  },

  "shared-chats"(f) {
    const data = emptyDataset();
    const users = ["alice", "bob", "carol", "dave"].map((name) => f.user({ email: `${name}@mock.test` }));
    data.users.push(...users);
    const [owner, ...others] = users;
    if (!owner) throw new Error("unreachable");
    for (const title of ["Team plan", "Design review", "Weekly sync"]) {
      const shared = addChat(data, f, owner.id, 4, { title });
      for (const other of others) data.members.push(f.member({ chatId: shared.id, email: other.email, role: "member" }));
    }
    addChat(data, f, owner.id, 2, { title: "Private notes" });
    return data;
  },

  attachments(f) {
    const data = emptyDataset();
    const user = f.user({ email: "alice@mock.test" });
    data.users.push(user);
    const withFiles = addChat(data, f, user.id, 0, { title: "Files" });
    for (const mimeType of ["text/plain", "application/pdf", "image/png", "image/jpeg"] as const) {
      const sent = f.userMessage({ chatId: withFiles.id });
      const file = f.attachment({ messageId: sent.id, ownerId: user.id, mimeType });
      data.messages.push({ ...sent, attachmentIds: [file.id] });
      data.attachments.push(file);
      data.messages.push(f.assistantMessage({ chatId: withFiles.id }));
    }
    return data;
  },
};

export function isDatasetName(name: string): name is DatasetName {
  return (DATASET_NAMES as readonly string[]).includes(name);
}

/** Builds a named dataset; the same `seed` gives the same records. */
export function buildDataset(name: string, seed: string | number = 1): Dataset {
  if (!isDatasetName(name)) {
    throw new Error(`Unknown dataset "${name}". Available: ${DATASET_NAMES.join(", ")}`);
  }
  return builders[name](createFactories(seed));
}

export function countRecords(data: Dataset): DatasetCounts {
  return {
    users: data.users.length,
    chats: data.chats.length,
    members: data.members.length,
    messages: data.messages.length,
    attachments: data.attachments.length,
    providerKeys: data.providerKeys.length,
  };
}
