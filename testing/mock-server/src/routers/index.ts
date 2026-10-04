import type { MockModule } from "../registry.js";
import { anthropicMock } from "./anthropic.router.js";
import { authMock } from "./auth.router.js";
import { collectMock } from "./collect.router.js";
import { conversationMock } from "./conversation.router.js";
import { openaiMock } from "./openai.router.js";
import { remotesMock } from "./remotes.router.js";

/**
 * Every mock the server mounts, one line each. A new mock adds its import above and one
 * entry below, so two stories touch different lines.
 */
export const mockModules: MockModule[] = [
  anthropicMock,
  openaiMock,
  authMock,
  conversationMock,
  remotesMock,
  collectMock,
];
