import { removePacts } from "@platform/pact-config";

/** Starts every pact run from an empty contract: Pact merges into existing files. */
export default function setup(): void {
  removePacts("auth-service");
}
