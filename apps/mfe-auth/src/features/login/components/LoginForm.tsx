import { useState, type FormEvent } from "react";
import { Alert, AlertDescription, Button, FormField, Input } from "@app/ui";
import { ApiError } from "../../../shared/api-client";
import { AuthCard } from "../../../shared/components/AuthCard";
import { useNavigate } from "../../../shared/navigation";
import { useLogin } from "../hooks/useLogin";
import { loginSchema } from "../model";

/**
 * Login form (PLAN.md F3), built from `@app/ui` components. Client-side validation only
 * checks that both fields are present (AC-36: the server is the sole source of truth for
 * which credentials are wrong, so we never guess client-side). On success, navigates to
 * the chat list route (AC-35). On failure, renders the single generic error message
 * returned by the API as-is (AC-36).
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { mutate, isPending, error } = useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setClientError(result.error.issues[0]?.message ?? "Enter your email and password");
      return;
    }

    setClientError(null);
    mutate(result.data, {
      onSuccess: () => {
        navigate({ to: "/chats" });
      },
    });
  }

  const serverErrorMessage = error instanceof ApiError ? error.message : null;
  const errorMessage = clientError ?? serverErrorMessage;

  return (
    <AuthCard
      title="Sign in"
      description="Enter your email and password to continue."
      switchPrompt="Don't have an account?"
      switchLabel="Create one"
      switchTo="/register"
    >
      <form aria-label="Login form" className="grid gap-4" noValidate onSubmit={handleSubmit}>
        <FormField label="Email">
          <Input
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </FormField>

        <FormField label="Password">
          <Input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </FormField>

        {/* AC-36: exactly one generic message, shown as-is, never per-field. */}
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Button className="w-full" loading={isPending} type="submit">
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
