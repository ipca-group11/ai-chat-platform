/** The part of the xk6-sse extension (github.com/phymbert/xk6-sse) the load test uses. */
declare module "k6/x/sse" {
  interface SseEvent {
    id: string;
    name: string;
    data: string;
  }
  interface SseClient {
    on(event: "open", handler: () => void): void;
    on(event: "event", handler: (event: SseEvent) => void): void;
    on(event: "error", handler: (error: { error(): string }) => void): void;
    close(): void;
  }
  interface SseParams {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    tags?: Record<string, string>;
  }
  interface SseResponse {
    status: number;
    error?: string;
  }
  const sse: { open(url: string, params: SseParams, callback: (client: SseClient) => void): SseResponse };
  export default sse;
}
