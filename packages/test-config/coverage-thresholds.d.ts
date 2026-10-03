export type CoverageThresholds = {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
};
export const coverageThresholds: Readonly<CoverageThresholds>;
export const appCoverageThresholds: Readonly<CoverageThresholds>;
export const e2eCoverageThresholds: Readonly<CoverageThresholds>;
