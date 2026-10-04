/**
 * Fixed data for the visual tests (AICHAT-39). Every id, text and timestamp is a constant, so
 * the same page renders the same pixels on every run. The shapes follow the DTOs of
 * conversation-service and auth-service (`Chat`, `Message` in `apps/mfe-chat/src/shared/types.ts`).
 */

/** The frozen clock of every visual test: Tuesday, 10 March 2026, 10:00 UTC. */
export const FIXED_TIME = "2026-03-10T10:00:00.000Z";

export const USER = { id: "user-1", email: "ana.silva@example.com" } as const;

export interface FixtureChat {
  id: string;
  title: string;
  ownerId: string;
  ownerEmail: string;
  provider: "anthropic";
  model: string;
  reasoning: boolean;
  webFetch: boolean;
  createdAt: string;
  updatedAt: string;
}

const chat = (id: string, title: string, updatedAt: string, extra: Partial<FixtureChat> = {}): FixtureChat => ({
  id,
  title,
  ownerId: USER.id,
  ownerEmail: USER.email,
  provider: "anthropic",
  model: "claude-haiku-4-5",
  reasoning: false,
  webFetch: false,
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt,
  ...extra,
});

export const CHATS: readonly FixtureChat[] = [
  chat("chat-1", "Trip planning for Lisbon", "2026-03-10T09:30:00.000Z", { model: "claude-sonnet-4-5", reasoning: true, webFetch: true }),
  chat("chat-2", "Refactoring the billing module", "2026-03-09T16:45:00.000Z"),
  chat("chat-3", "Weekly meal ideas", "2026-03-05T08:10:00.000Z"),
];

export interface FixtureMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  webFetches?: { id: string; url: string; status: "done" | "error"; title?: string; errorCode?: string }[];
  attachments: never[];
  status: "sent";
  createdAt: string;
}

export const MESSAGES: readonly FixtureMessage[] = [
  {
    id: "msg-1",
    chatId: "chat-1",
    role: "user",
    content: "I have three days in Lisbon in April. What should I not miss?",
    attachments: [],
    status: "sent",
    createdAt: "2026-03-10T09:20:00.000Z",
  },
  {
    id: "msg-2",
    chatId: "chat-1",
    role: "assistant",
    content:
      "Three days is enough for the main sights if you group them by neighbourhood.\n\n- **Day 1:** Alfama, the Sé cathedral and a sunset at Miradouro da Senhora do Monte\n- **Day 2:** Belém for the tower and the monastery, then LX Factory in the evening\n- **Day 3:** a day trip to Sintra, leaving early to beat the queues\n\nTram 28 is crowded at midday, so ride it in the morning.",
    reasoning:
      "The user asks for a short list. Three days means one area per day. Group Alfama with the viewpoints, Belém with the monuments, and keep Sintra for its own day because of the travel time.",
    webFetches: [
      { id: "fetch-1", url: "https://www.visitlisboa.example/en/what-to-see", status: "done", title: "What to see in Lisbon" },
      { id: "fetch-2", url: "https://www.cp.example/timetables/sintra", status: "error", errorCode: "url_not_accessible" },
    ],
    attachments: [],
    status: "sent",
    createdAt: "2026-03-10T09:21:00.000Z",
  },
  {
    id: "msg-3",
    chatId: "chat-1",
    role: "user",
    content: "Thanks. Can you suggest where to eat in Alfama?",
    attachments: [],
    status: "sent",
    createdAt: "2026-03-10T09:28:00.000Z",
  },
  {
    id: "msg-4",
    chatId: "chat-1",
    role: "assistant",
    content: "Book a table for dinner in advance. Small fado houses fill up by 19:00, and the best grilled fish is found on the side streets, not on the main square.",
    attachments: [],
    status: "sent",
    createdAt: "2026-03-10T09:30:00.000Z",
  },
];
