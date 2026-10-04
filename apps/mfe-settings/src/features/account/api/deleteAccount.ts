import { CORRELATION_HEADER, generateCorrelationId } from "../../../shared/correlation";

const AUTH_SERVICE_BASE_URL: string =
  (import.meta.env?.VITE_AUTH_SERVICE_URL as string | undefined) ?? "";

/** Why `DELETE /auth/me` failed: the HTTP status (0 when the request never got an answer) and auth-service's error code. */
export class DeleteAccountError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "DeleteAccountError";
    this.status = status;
    this.code = code;
  }
}

async function errorCodeOf(response: Response): Promise<{ code?: string; message?: string }> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
    return {
      code: typeof body.error?.code === "string" ? body.error.code : undefined,
      message: typeof body.error?.message === "string" ? body.error.message : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Deletes the signed-in user's account with `DELETE /auth/me` (auth-service): the password is
 * sent again in the body (`{ password }`), and on success (204) auth-service has erased the
 * account and everything it owns and cleared the session cookies.
 */
export async function deleteAccount(password: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${AUTH_SERVICE_BASE_URL}/auth/me`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        [CORRELATION_HEADER]: generateCorrelationId(),
      },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new DeleteAccountError(0, undefined, "Could not reach the server");
  }

  if (!response.ok) {
    const { code, message } = await errorCodeOf(response);
    throw new DeleteAccountError(response.status, code, message ?? "Failed to delete the account");
  }
}
