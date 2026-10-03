export {
  coverageThresholds,
  appCoverageThresholds,
  e2eCoverageThresholds,
} from "./coverage-thresholds.ts";
export { coveragePreset, vitestPreset } from "./vitest.preset.ts";
export type { CoverageThresholds } from "./coverage-thresholds.ts";
export type { CoveragePreset, CoveragePresetOptions } from "./vitest.preset.ts";
export {
  normalizeSnapshotText,
  snapshotSerializer,
  snapshotSerializerPath,
} from "./snapshot-serializer.ts";
