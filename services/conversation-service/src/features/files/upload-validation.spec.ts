/** NFR H6 - file upload validation, through the whole app.
 * Threshold: a spoofed MIME type is rejected with 415, a file over 20 MB with 413,
 * and no bad file is ever accepted (nothing stored, no attachment row). */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../../test-utils/build-test-app.js";
import { parseEnv } from "../../shared/env.js";
import { TEST_JWT_SECRET, TEST_SERVICE_TOKEN } from "../../test-utils/auth-token.js";

const MB = 1024 * 1024;
const LIMIT = 20 * MB;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_MAGIC = Buffer.from("%PDF-1.4\n");
const EXE_MAGIC = Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "binary");
const png = (extra = 16) => Buffer.concat([PNG_MAGIC, Buffer.alloc(extra, 1)]);

async function setup() {
  const t = buildTestApp({ maxUploadBytes: LIMIT });
  const chatId = await createChatVia(t.app, "user-1");
  const message = await t.messagesRepo.create({
    chatId,
    ownerId: "user-1",
    authorEmail: "user-1@example.com",
    role: "user",
    content: "hi",
    status: "sent",
  });
  const path = `/chats/${chatId}/messages/${message.id}/attachments`;
  const post = (buffer: Buffer, filename: string, contentType: string) =>
    request(t.app).post(path).set("Cookie", cookieFor("user-1")).attach("file", buffer, { filename, contentType });
  return { ...t, post };
}

describe("upload validation (H6)", () => {
  it("the configured default upload limit is 20 MB", () => {
    const env = parseEnv({ JWT_SECRET: TEST_JWT_SECRET, LOG_LEVEL: "silent", INTERNAL_SERVICE_TOKEN: TEST_SERVICE_TOKEN });
    expect(env.MAX_UPLOAD_BYTES).toBe(LIMIT);
  });

  const spoofed: Array<[string, () => Buffer, string, string]> = [
    ["a .png declared as text/plain", () => png(), "a.png", "text/plain"],
    ["a .txt declared as image/png", () => Buffer.from("hello"), "a.txt", "image/png"],
    ["a .pdf declared as image/jpeg", () => PDF_MAGIC, "a.pdf", "image/jpeg"],
    ["a .jpg declared as application/octet-stream", () => Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "a.jpg", "application/octet-stream"],
    ["an executable named .png and declared image/png (content does not match)", () => EXE_MAGIC, "evil.png", "image/png"],
    ["an executable named .pdf and declared application/pdf (content does not match)", () => EXE_MAGIC, "evil.pdf", "application/pdf"],
    ["a script named .jpg and declared image/jpeg (content does not match)", () => Buffer.from("<script>alert(1)</script>"), "x.jpg", "image/jpeg"],
    ["a .exe declared application/octet-stream", () => EXE_MAGIC, "a.exe", "application/octet-stream"],
    ["a double extension .png.exe declared image/png", () => png(), "a.png.exe", "image/png"],
  ];

  it.each(spoofed)("415 for %s, and nothing is stored", async (_label, body, filename, contentType) => {
    const { post, attachmentsRepo, storage } = await setup();
    const res = await post(body(), filename, contentType);
    expect(res.status).toBe(415);
    expect(attachmentsRepo.all()).toHaveLength(0);
    expect(await storage.list()).toHaveLength(0);
  });

  it("413 for a file just over 20 MB, and nothing is stored", async () => {
    const { post, attachmentsRepo, storage } = await setup();
    const res = await post(Buffer.alloc(LIMIT + 1, 97), "big.txt", "text/plain");
    expect(res.status).toBe(413);
    expect(attachmentsRepo.all()).toHaveLength(0);
    expect(await storage.list()).toHaveLength(0);
  });

  it("413 for a file far over 20 MB (30 MB)", async () => {
    const { post, attachmentsRepo } = await setup();
    const res = await post(Buffer.alloc(30 * MB, 97), "huge.txt", "text/plain");
    expect(res.status).toBe(413);
    expect(attachmentsRepo.all()).toHaveLength(0);
  });

  it("accepts a valid file exactly at 20 MB", async () => {
    const { post, attachmentsRepo } = await setup();
    const res = await post(Buffer.alloc(LIMIT, 97), "edge.txt", "text/plain");
    expect(res.status).toBe(201);
    expect(attachmentsRepo.all()).toHaveLength(1);
  });

  it("accepts genuine files whose extension, MIME type and content agree", async () => {
    const { post, attachmentsRepo } = await setup();
    expect((await post(Buffer.from("hello"), "n.txt", "text/plain")).status).toBe(201);
    expect((await post(png(), "p.png", "image/png")).status).toBe(201);
    expect(attachmentsRepo.all()).toHaveLength(2);
  });

  it("0 accepted bad files across the whole spoof and oversize corpus", async () => {
    const { post, attachmentsRepo, storage } = await setup();
    for (const [, body, filename, contentType] of spoofed) await post(body(), filename, contentType);
    await post(Buffer.alloc(LIMIT + 1, 97), "big.txt", "text/plain");
    expect(attachmentsRepo.all()).toHaveLength(0);
    expect(await storage.list()).toHaveLength(0);
  });
});
