/**
 * Which sites the model may fetch while answering (AICHAT-242). Set per deployment with
 * `WEB_FETCH_ALLOWED_DOMAINS` (only these) or `WEB_FETCH_BLOCKED_DOMAINS` (all but these), never
 * both; unset means no restriction. A domain also covers its subdomains: `example.com` allows
 * `docs.example.com`.
 *
 * Anthropic's web fetch runs on Anthropic's servers, so the list is sent with the tool
 * (`allowed_domains` / `blocked_domains`) and the API refuses a URL outside it. No fetch runs in
 * this service; `isUrlAllowed` is still checked on every page the provider reports as fetched, so
 * an answer built on a page outside the list is stopped (`AnthropicProvider`).
 */
export interface WebFetchDomainPolicy {
  allowed?: readonly string[];
  blocked?: readonly string[];
}

const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * `"example.com, docs.python.org"` to `["example.com", "docs.python.org"]`: lower-cased, a leading
 * `*.` or trailing dot dropped. Undefined for an empty value. Throws on an entry that is not a
 * domain name (a URL, a path, a port), so a typo fails at startup instead of opening the list.
 */
export function parseDomainList(value: string | undefined): string[] | undefined {
  const domains = (value ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase().replace(/^\*\./, "").replace(/\.$/, ""))
    .filter(Boolean);
  for (const domain of domains) {
    if (!DOMAIN.test(domain)) throw new Error(`"${domain}" is not a domain name (write example.com, without scheme, port or path)`);
  }
  return domains.length > 0 ? [...new Set(domains)] : undefined;
}

const covers = (domain: string, host: string): boolean => host === domain || host.endsWith(`.${domain}`);

/** Whether the policy lets the model fetch this URL. A URL that cannot be parsed is never allowed. */
export function isUrlAllowed(url: string, policy: WebFetchDomainPolicy): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return false;
  }
  if (policy.allowed) return policy.allowed.some((domain) => covers(domain, host));
  if (policy.blocked) return !policy.blocked.some((domain) => covers(domain, host));
  return true;
}

/** The fields of Anthropic's web fetch tool that carry the policy (none when unrestricted). */
export function webFetchDomainParams(policy: WebFetchDomainPolicy): Record<string, readonly string[]> {
  if (policy.allowed) return { allowed_domains: policy.allowed };
  if (policy.blocked) return { blocked_domains: policy.blocked };
  return {};
}
