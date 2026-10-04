import type { Meta, StoryObj } from "@storybook/react-vite";
import { WebFetchList } from "./WebFetchList";
import { storyWebFetches } from "./stories-support";

/** The pages the model fetched while writing a reply. */
const meta = {
  title: "App/Chat/WebFetchList",
  component: WebFetchList,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: { fetches: storyWebFetches },
} satisfies Meta<typeof WebFetchList>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Read pages (linked, with their title when known) and one that failed. */
export const Sources: Story = {};

/** Pages still being fetched while the reply streams. */
export const Fetching: Story = {
  args: {
    fetches: [
      { id: "f-1", url: "https://example.com/article", status: "done", title: "Example article" },
      { id: "f-2", url: "https://www.wikipedia.org/wiki/Retrospective", status: "fetching" },
    ],
  },
};

/** Every error reason the web fetch tool reports, in plain language. */
export const Errors: Story = {
  args: {
    fetches: [
      "url_not_accessible",
      "url_not_allowed",
      "url_not_in_prior_context",
      "unsupported_content_type",
      "max_uses_exceeded",
      "too_many_requests",
      "url_too_long",
      "invalid_tool_input",
      "something_new",
    ].map((errorCode, i) => ({ id: `e-${i}`, url: `https://site${i + 1}.example.com/page`, status: "error" as const, errorCode })),
  },
};

/** A non-web URL is shown as text, never as a link. */
export const NonWebUrl: Story = {
  args: {
    fetches: [{ id: "f-js", url: "javascript:alert(1)", status: "done", title: "Not a link" }],
  },
};
