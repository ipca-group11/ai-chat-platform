/** Wraps a repository (or any object of async methods) so that every method call rejects
 * with the given error. Used to make a route fail with an unexpected error. */
export function throwingRepository<T extends object>(error: Error = new Error("database exploded: secret-internal-detail")): T {
  return new Proxy({} as T, {
    get: (_target, property) => {
      if (typeof property === "symbol" || property === "then") return undefined;
      return () => Promise.reject(error);
    },
  });
}
