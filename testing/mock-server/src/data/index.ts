/**
 * Public entry of `@platform/mock-server`: the data factories and named datasets, with no
 * server code, so Vitest and Playwright can import them (`import { createFactories } from
 * "@platform/mock-server"`).
 */
export { createFactories, MOCK_PASSWORD } from "./factories.js";
export type { Factories, Overrides } from "./factories.js";
export {
  buildDataset,
  countRecords,
  isDatasetName,
  DATASET_NAMES,
  MANY_CHATS_COUNT,
  LONG_CONVERSATION_MESSAGES,
} from "./datasets.js";
export type { DatasetName } from "./datasets.js";
export type { Dataset, DatasetCounts, MockMember, MockProviderKey, MockUser } from "./types.js";
