import type { auth, chat } from "@app/shared-types";
import type { StoredApiKeyRecord } from "@app/shared-types/api-keys";

/** A registered user. The password is only there so the auth mock can check a login. */
export interface MockUser extends auth.UserProfile {
  password: string;
}

/** A chat member, tied to its chat (the shared type has no chat id). */
export interface MockMember extends chat.ChatMember {
  chatId: string;
}

/** A provider key saved by a user. `apiKey` is a fake value that looks like the real one. */
export interface MockProviderKey extends StoredApiKeyRecord {
  userId: string;
  apiKey: string;
}

/** Everything a dataset holds; the shapes come from `@app/shared-types`. */
export interface Dataset {
  users: MockUser[];
  chats: chat.Chat[];
  members: MockMember[];
  messages: chat.Message[];
  attachments: chat.Attachment[];
  providerKeys: MockProviderKey[];
}

export type DatasetCounts = { [K in keyof Dataset]: number };
