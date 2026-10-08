import { test, expect, type Locator, type Page, type Request } from "@playwright/test";
import { registerAndLogIn } from "./support/auth.js";
import { countAttachments } from "./support/db.js";

/** The mock accepts any key; against a real provider set E2E_ANTHROPIC_API_KEY. */
const anthropicKey = process.env["E2E_ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret";
const provider = "anthropic";
/** Accepts images: `supportsVision` (packages/shared-types) matches every "claude-haiku" model. */
const visionModel = "claude-haiku-4-5";

const MB = 1024 * 1024;

interface Chat {
  id: string;
  title: string;
}

interface Message {
  id: string;
}

interface ErrorResponse {
  error: { code: string; message: string };
}

/** A file as the browser's file chooser (or a multipart request) presents it. */
interface NamedFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/** The MIME type a browser reports for a file with this name; unknown extensions report an empty type. */
const mimeTypes: Record<string, string> = {
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".exe": "application/octet-stream",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/** Neither the browser nor the server inspects the bytes, only the name, the MIME type and the size. */
function fileNamed(name: string, content: Buffer | string = `Contents of ${name}`, mimeType = mimeTypes[extensionOf(name)] ?? ""): NamedFile {
  return { name, mimeType, buffer: Buffer.isBuffer(content) ? content : Buffer.from(content) };
}

function fileOfSize(name: string, bytes: number): NamedFile {
  return fileNamed(name, Buffer.alloc(bytes, "a"));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const exactly = (text: string) => new RegExp(`^${escapeRegExp(text)}$`);

async function saveAnthropicKey(page: Page) {
  await page.goto("/settings");
  const card = page.getByTestId("provider-card-anthropic");
  await card.getByTestId("api-key").fill(anthropicKey);
  await card.getByTestId("save-key").click();
  await expect(card.getByTestId("masked-key")).toHaveText(`••••${anthropicKey.slice(-4)}`);
}

// --- conversation-service through the shell's /api proxy (same session as the browser) ---

async function createChat(page: Page, title: string): Promise<Chat> {
  const response = await page.request.post("/api/chats", { data: { title, provider, model: visionModel } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { chat: Chat }).chat;
}

async function sendMessage(page: Page, chatId: string, content: string): Promise<Message> {
  const response = await page.request.post(`/api/chats/${chatId}/messages`, {
    data: { content },
    headers: { "X-Llm-Api-Key": anthropicKey },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { message: Message }).message;
}

// --- page ---

async function openChat(page: Page, chat: Chat) {
  await page.goto(`/chats/${chat.id}`);
  await expect(page.getByTestId("chat-heading")).toHaveText(chat.title);
}

/** The rows of the "Attachments" list whose file name is exactly `name`. */
function attachmentRow(page: Page, name: string): Locator {
  return page
    .getByTestId("attachments")
    .getByTestId("attachment")
    .filter({ has: page.getByTestId("attachment-name").filter({ hasText: exactly(name) }) });
}

/** Clicks "Attach" and picks `files` in the file chooser it opens. */
async function attach(page: Page, files: NamedFile[]) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("attach").click();
  await (await chooser).setFiles(files);
}

/** Collects the page's requests that `matches` from now on. */
function trackRequests(page: Page, matches: (request: Request) => boolean): Request[] {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (matches(request)) seen.push(request);
  });
  return seen;
}

/** The UI posts to /chats/{chatId}/attachments and the server defines /chats/{chatId}/messages/{messageId}/attachments: both count. */
const isUploadRequest = (request: Request) =>
  request.method() === "POST" && /^\/api\/chats\/[^/]+(\/messages\/[^/]+)?\/attachments$/.test(new URL(request.url()).pathname);

// --- shared steps ---

async function whenIAttach(page: Page, line: string, files: NamedFile[]) {
  await test.step(line, async () => {
    await attach(page, files);
  });
}

async function thenUploaded(page: Page, keyword: string, name: string) {
  await test.step(`${keyword} I see "${name}" in the "Attachments" list with the status "uploaded"`, async () => {
    await expect(attachmentRow(page, name).getByTestId("attachment-status")).toHaveText("uploaded");
  });
}

async function andNoError(page: Page) {
  await test.step("And I see no error", async () => {
    await expect(page.getByTestId("attachment-error")).toHaveCount(0);
    await expect(page.getByTestId("send-error")).toHaveCount(0);
  });
}

async function givenUploaded(page: Page, file: NamedFile, line = `Given "${file.name}" is in the "Attachments" list with the status "uploaded"`) {
  await test.step(line, async () => {
    await attach(page, [file]);
    await expect(attachmentRow(page, file.name).getByTestId("attachment-status")).toHaveText("uploaded");
  });
}

async function whenIRemove(page: Page, name: string) {
  await test.step(`When I click "Remove ${name}"`, async () => {
    await attachmentRow(page, name).getByTestId("remove-attachment").click();
  });
}

async function thenNoLongerListed(page: Page, name: string) {
  await test.step(`Then "${name}" is no longer in the "Attachments" list`, async () => {
    await expect(attachmentRow(page, name)).toHaveCount(0);
  });
}

async function thenISeeTheError(page: Page, name: string, message: string) {
  await test.step(`Then I see the error "${message}"`, async () => {
    await expect(attachmentRow(page, name).getByTestId("attachment-error")).toHaveText(message);
  });
}

async function andNoUploadRequest(uploadRequests: Request[]) {
  await test.step("And no upload request is sent", async () => {
    expect(uploadRequests).toEqual([]);
  });
}

async function andSendIsDisabled(page: Page) {
  await test.step('And the "Send" button is disabled', async () => {
    await expect(page.getByTestId("send-message")).toBeDisabled();
  });
}

async function andAttachmentsListIsEmpty(page: Page) {
  await test.step('And the "Attachments" list is empty', async () => {
    await expect(page.getByTestId("attachments")).toHaveCount(0);
  });
}

test.describe("Attach a file to a message", () => {
  let chat: Chat;

  test.beforeEach(async ({ page }) => {
    await test.step("Given I am logged in", async () => {
      await registerAndLogIn(page, "attach");
    });
    await test.step('And I have an open chat at "/chats/<chatId>" whose model accepts images', async () => {
      // The chat's Anthropic model needs the key the composer sends with each message.
      await saveAnthropicKey(page);
      chat = await createChat(page, "Attachments");
      await openChat(page, chat);
    });
    await andAttachmentsListIsEmpty(page);
  });

  for (const name of ["notes.txt", "report.pdf", "diagram.png", "photo.jpg", "photo.jpeg"]) {
    test(`A valid file is staged and uploaded (AC-66, AC-67): ${name}`, async ({ page }) => {
      await whenIAttach(page, `When I click "Attach" and choose "${name}"`, [fileNamed(name)]);
      await thenUploaded(page, "Then", name);
      await andNoError(page);
    });
  }

  test("Several files are attached at once (AC-66)", async ({ page }) => {
    await whenIAttach(page, 'When I click "Attach" and choose "notes.txt" and "report.pdf" together', [
      fileNamed("notes.txt"),
      fileNamed("report.pdf"),
    ]);
    await thenUploaded(page, "Then", "notes.txt");
    await thenUploaded(page, "And", "report.pdf");
  });

  test("A staged file is removed before sending", async ({ page }) => {
    await givenUploaded(page, fileNamed("notes.txt"));
    await whenIRemove(page, "notes.txt");
    await thenNoLongerListed(page, "notes.txt");
  });

  test("The response takes the attached file into account (AC-69)", async ({ page }) => {
    await givenUploaded(
      page,
      fileNamed("notes.txt", "The secret word is banana."),
      'Given "notes.txt" containing "The secret word is banana." is in the "Attachments" list with the status "uploaded"',
    );
    await test.step('When I type "What is the secret word in the attached file?" in "Message"', async () => {
      await page.getByTestId("message-input").fill("What is the secret word in the attached file?");
    });
    await test.step('And I click "Send"', async () => {
      await page.getByTestId("send-message").click();
    });
    await test.step('Then my message shows "notes.txt" in its "Message attachments" list', async () => {
      const listed = page
        .getByTestId("user-message")
        .getByTestId("message-attachments")
        .getByTestId("message-attachment")
        .filter({ hasText: exactly("notes.txt") });
      await expect(listed).toHaveCount(1);
    });
    await andAttachmentsListIsEmpty(page);
    await test.step('And the assistant\'s reply contains "banana"', async () => {
      await expect(page.getByTestId("assistant-reply")).toContainText("banana", { timeout: 15_000 });
    });
  });

  for (const name of ["script.exe", "notes.docx", "picture.gif", "README"]) {
    test(`A file of a disallowed type is rejected before upload (AC-67, AC-68): ${name}`, async ({ page }) => {
      const uploadRequests = trackRequests(page, isUploadRequest);
      await whenIAttach(page, `When I click "Attach" and choose "${name}"`, [fileNamed(name)]);
      await thenISeeTheError(page, name, `"${name}" is not a supported file type. Allowed types: .txt, .pdf, .png, .jpg/.jpeg.`);
      await test.step(`And "${name}" does not get the status "uploading" or "uploaded"`, async () => {
        await expect(attachmentRow(page, name).getByTestId("attachment-status")).toHaveCount(0);
      });
      await andNoUploadRequest(uploadRequests);
      await andSendIsDisabled(page);
    });
  }

  test("A file over 10 MB is rejected before upload (AC-68)", async ({ page }) => {
    const uploadRequests = trackRequests(page, isUploadRequest);
    await whenIAttach(page, 'When I click "Attach" and choose "too-big.txt" of 11 MB', [fileOfSize("too-big.txt", 11 * MB)]);
    await thenISeeTheError(page, "too-big.txt", '"too-big.txt" is larger than the 10 MB limit.');
    await andNoUploadRequest(uploadRequests);
    await andSendIsDisabled(page);
  });

  test("A file of exactly 10 MB is accepted (AC-68)", async ({ page }) => {
    await whenIAttach(page, 'When I click "Attach" and choose "limit.txt" of exactly 10 MB', [fileOfSize("limit.txt", 10 * MB)]);
    await thenUploaded(page, "Then", "limit.txt");
    await andNoError(page);
  });

  test("Removing a rejected file lets me send again", async ({ page }) => {
    await test.step('Given I typed "Hello" in "Message"', async () => {
      await page.getByTestId("message-input").fill("Hello");
    });
    await test.step('And "script.exe" is in the "Attachments" list with a rejection error', async () => {
      await attach(page, [fileNamed("script.exe")]);
      await expect(attachmentRow(page, "script.exe").getByTestId("attachment-error")).toBeVisible();
    });
    await whenIRemove(page, "script.exe");
    await thenNoLongerListed(page, "script.exe");
    await test.step('And the "Send" button is enabled', async () => {
      await expect(page.getByTestId("send-message")).toBeEnabled();
    });
  });

  const serverRejections = [
    {
      file: fileNamed("script.exe"),
      mime: "application/octet-stream",
      code: "ATTACHMENT_TYPE_NOT_ALLOWED",
      message: 'Files of type ".exe" are not allowed. Accepted types: .txt, .pdf, .png, .jpeg, .jpg',
    },
    {
      file: fileNamed("README"),
      mime: "text/plain",
      code: "ATTACHMENT_TYPE_NOT_ALLOWED",
      message: 'Files of type "unknown" are not allowed. Accepted types: .txt, .pdf, .png, .jpeg, .jpg',
    },
    {
      file: fileNamed("fake.png"),
      mime: "application/pdf",
      code: "ATTACHMENT_TYPE_NOT_ALLOWED",
      message: 'File "fake.png" has a MIME type ("application/pdf") that does not match its extension',
    },
    {
      file: fileOfSize("too-big.txt", 11 * MB),
      mime: "text/plain",
      code: "ATTACHMENT_TOO_LARGE",
      message: 'File "too-big.txt" exceeds the 10 MB size limit',
    },
  ];

  for (const row of serverRejections) {
    test(`The server rejects an invalid upload (AC-67, AC-68): ${row.file.name}`, { tag: "@api" }, async ({ page }) => {
      // The chat of the Background belongs to the browser's session, which `page.request` shares.
      const api = page.request;
      let message: Message;
      let status = 0;
      let body: ErrorResponse;

      await test.step("Given I own message <messageId> in the chat", async () => {
        message = await sendMessage(page, chat.id, "Hello");
      });
      await test.step(`When I POST "${row.file.name}" with MIME type "${row.mime}" to "/chats/<chatId>/messages/<messageId>/attachments"`, async () => {
        const response = await api.post(`/api/chats/${chat.id}/messages/${message.id}/attachments`, {
          multipart: { file: { name: row.file.name, mimeType: row.mime, buffer: row.file.buffer } },
        });
        status = response.status();
        body = (await response.json()) as ErrorResponse;
      });
      await test.step("Then the response status is 400", async () => {
        expect(status).toBe(400);
      });
      await test.step(`And the response code is "${row.code}"`, async () => {
        expect(body.error.code).toBe(row.code);
      });
      await test.step(`And the response message is "${row.message}"`, async () => {
        expect(body.error.message).toBe(row.message);
      });
      await test.step("And no attachment is stored for the message", async () => {
        expect(countAttachments(message.id)).toBe(0);
      });
    });
  }
});
