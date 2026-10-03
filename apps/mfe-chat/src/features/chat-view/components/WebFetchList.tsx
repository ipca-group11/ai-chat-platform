import { CircleAlert, Globe, LoaderCircle } from "lucide-react";
import type { WebFetch } from "../../../shared/types";

export interface WebFetchListProps {
  fetches: WebFetch[];
}

/** Plain-language reasons for the web fetch tool's error codes. */
const ERROR_REASONS: Record<string, string> = {
  url_not_accessible: "the page couldn't be loaded",
  url_not_allowed: "the site doesn't allow it",
  url_not_in_prior_context: "the link wasn't in the chat",
  unsupported_content_type: "unsupported content type",
  max_uses_exceeded: "fetch limit for this reply reached",
  too_many_requests: "too many requests, try again later",
  url_too_long: "the link is too long",
  invalid_tool_input: "invalid link",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Only http(s) URLs become links, so a model-supplied `javascript:` URL can't. */
function isWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** The pages the model fetched for a reply: in progress, read (linked), or failed. */
export function WebFetchList({ fetches }: WebFetchListProps) {
  return (
    <ul aria-label="Pages fetched" className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      {fetches.map((fetch) => {
        const host = hostname(fetch.url);
        return (
          <li key={fetch.id} className="flex min-w-0 items-center gap-1.5" data-status={fetch.status}>
            {fetch.status === "fetching" ? (
              <>
                <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                <span className="truncate">Fetching {host}…</span>
              </>
            ) : fetch.status === "done" ? (
              <>
                <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="shrink-0">Read</span>
                {isWebUrl(fetch.url) ? (
                  <a
                    href={fetch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate font-medium text-foreground underline-offset-2 hover:underline"
                    title={fetch.url}
                  >
                    {fetch.title || host}
                  </a>
                ) : (
                  <span className="min-w-0 truncate font-medium text-foreground">{fetch.title || host}</span>
                )}
                {fetch.title ? <span className="shrink-0">· {host}</span> : null}
              </>
            ) : (
              <>
                <CircleAlert className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                <span className="truncate" title={fetch.url}>
                  Couldn’t fetch {host}: {ERROR_REASONS[fetch.errorCode ?? ""] ?? "fetch unavailable"}
                </span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
