import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { HttpError } from "../../shared/error-handler.js";
import { fakeReq, fakeRes } from "../../test-utils/fake-http.js";
import { createAttachmentsController } from "./controller.js";
import type { AttachmentsService } from "./service.js";

function setup() {
  const service = { upload: vi.fn() };
  return { service, controller: createAttachmentsController(service as unknown as AttachmentsService) };
}

describe("attachments controller", () => {
  it("upload: maps the multer file to the service input and answers 201", async () => {
    const { service, controller } = setup();
    service.upload.mockResolvedValue({ id: "a1" });
    const buffer = Buffer.from("hello");
    const res = fakeRes();

    await controller.upload(
      fakeReq({
        params: { chatId: "c1", messageId: "m1" },
        file: { originalname: "notes.txt", mimetype: "text/plain", size: 5, buffer, fieldname: "file", path: "/ignored" },
      }),
      res,
    );

    expect(service.upload).toHaveBeenCalledWith(
      { userId: "user-1", email: "ana@example.com" },
      "c1",
      "m1",
      { originalname: "notes.txt", mimetype: "text/plain", size: 5, buffer },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ attachment: { id: "a1" } });
  });

  it("upload: answers 400 ATTACHMENT_REQUIRED when no file came with the request", async () => {
    const { service, controller } = setup();
    const error = await controller
      .upload(fakeReq({ params: { chatId: "c1", messageId: "m1" } }), fakeRes())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ statusCode: 400, code: "ATTACHMENT_REQUIRED" });
    expect(service.upload).not.toHaveBeenCalled();
  });

  it("upload: rejects missing route params before looking at the file", async () => {
    const { service, controller } = setup();
    await expect(controller.upload(fakeReq({ params: { messageId: "m1" } }), fakeRes())).rejects.toBeInstanceOf(ZodError);
    expect(service.upload).not.toHaveBeenCalled();
  });

  it("upload: propagates service errors", async () => {
    const { service, controller } = setup();
    service.upload.mockRejectedValue(new HttpError(413, "TOO_LARGE", "big"));
    await expect(
      controller.upload(
        fakeReq({ params: { chatId: "c1", messageId: "m1" }, file: { originalname: "a", mimetype: "text/plain", size: 1, buffer: Buffer.alloc(1) } }),
        fakeRes(),
      ),
    ).rejects.toMatchObject({ statusCode: 413 });
  });
});
