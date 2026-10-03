import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WebFetch } from "../../../shared/types";
import { WebFetchList } from "./WebFetchList";

const done = (overrides: Partial<WebFetch> = {}): WebFetch => ({
  id: "f1",
  url: "https://www.example.test/docs/page",
  status: "done",
  ...overrides,
});

describe("WebFetchList", () => {
  it("is a labelled list with one item per fetch, in order", () => {
    render(
      <WebFetchList
        fetches={[done({ id: "a", url: "https://a.test/" }), done({ id: "b", url: "https://b.test/" })]}
      />
    );

    const items = within(screen.getByRole("list", { name: "Pages fetched" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Reada.test", "Readb.test"]);
  });

  it("shows a fetch in progress with the host, without the www prefix and without a link", () => {
    render(<WebFetchList fetches={[done({ status: "fetching" })]} />);

    expect(screen.getByText("Fetching example.test…")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links a page that was read, using the title and the host", () => {
    render(<WebFetchList fetches={[done({ title: "Page title" })]} />);

    const link = screen.getByRole("link", { name: "Page title" });
    expect(link).toHaveAttribute("href", "https://www.example.test/docs/page");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("· example.test")).toBeInTheDocument();
  });

  it("names the link after the host when the page has no title", () => {
    render(<WebFetchList fetches={[done()]} />);

    expect(screen.getByRole("link", { name: "example.test" })).toBeInTheDocument();
    expect(screen.queryByText(/^·/)).not.toBeInTheDocument();
  });

  it("links plain http pages too", () => {
    render(<WebFetchList fetches={[done({ url: "http://insecure.test/x" })]} />);

    expect(screen.getByRole("link", { name: "insecure.test" })).toHaveAttribute("href", "http://insecure.test/x");
  });

  describe.each([
    ["javascript:", "javascript:alert(document.cookie)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["file:", "file:///etc/passwd"],
    ["ftp:", "ftp://files.test/readme"],
    ["not a URL at all", "not a url"],
  ])("isWebUrl guard on a model-supplied %s URL", (_label, url) => {
    it("shows the page as plain text and never as a link", () => {
      render(<WebFetchList fetches={[done({ url, title: "Looks harmless" })]} />);

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("Looks harmless")).toBeInTheDocument();
      expect(document.querySelector("a[href]")).toBeNull();
    });
  });

  it("falls back to the raw text as the host when the URL cannot be parsed", () => {
    render(<WebFetchList fetches={[done({ url: "not a url" }), done({ id: "g", url: "bad url", status: "fetching" })]} />);

    expect(screen.getByText("not a url")).toBeInTheDocument();
    expect(screen.getByText("Fetching bad url…")).toBeInTheDocument();
  });

  it.each([
    ["url_not_accessible", "the page couldn't be loaded"],
    ["url_not_allowed", "the site doesn't allow it"],
    ["url_not_in_prior_context", "the link wasn't in the chat"],
    ["unsupported_content_type", "unsupported content type"],
    ["max_uses_exceeded", "fetch limit for this reply reached"],
    ["too_many_requests", "too many requests, try again later"],
    ["url_too_long", "the link is too long"],
    ["invalid_tool_input", "invalid link"],
  ])("explains the %s failure in plain language", (errorCode, reason) => {
    render(<WebFetchList fetches={[done({ status: "error", errorCode })]} />);

    expect(screen.getByText(`Couldn’t fetch example.test: ${reason}`)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("uses a generic reason for an unknown or missing error code", () => {
    render(
      <WebFetchList
        fetches={[done({ id: "x", status: "error", errorCode: "brand_new_code" }), done({ id: "y", status: "error" })]}
      />
    );

    expect(screen.getAllByText("Couldn’t fetch example.test: fetch unavailable")).toHaveLength(2);
  });

  it("exposes the status of each item for styling and tests", () => {
    render(
      <WebFetchList
        fetches={[done({ id: "a", status: "fetching" }), done({ id: "b" }), done({ id: "c", status: "error" })]}
      />
    );

    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("data-status"))).toEqual([
      "fetching",
      "done",
      "error",
    ]);
  });
});
