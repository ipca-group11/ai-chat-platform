import { useState, type FormEvent } from "react";
import { Alert, AlertDescription, Button, FormField, Input } from "@app/ui";
import { ApiError } from "../../../shared/api-client";
import { AuthCard } from "../../../shared/components/AuthCard";
import { useNavigate } from "../../../shared/navigation";
import { useRegister } from "../hooks/useRegister";
import { registerSchema } from "../model";

type FieldName = "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * Registration form (PLAN.md F2), built from `@app/ui` components. Validates client-side
 * with the same password/email policy `auth-service` enforces (AC-30, AC-32), surfaces
 * server validation errors such as duplicate email inline (AC-31), and redirects to
 * `/login` on success (AC-34).
 */
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const navigate = useNavigate();
  const { mutate, isPending, error } = useRegister();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = registerSchema.safeParse({ email, password });
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as FieldName;
        if (!nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    mutate(result.data, {
      onSuccess: () => {
        navigate({ to: "/login" });
      },
    });
  }

  const serverErrorMessage = error instanceof ApiError ? error.message : null;

  return (
    <AuthCard
      title="Create an account"
      description="Sign up with your email to start chatting."
      switchPrompt="Already have an account?"
      switchLabel="Sign in"
      switchTo="/login"
    >
      <form aria-label="Registration form" className="grid gap-4" noValidate onSubmit={handleSubmit}>
        <FormField label="Email" error={fieldErrors.email} errorTestId="email-error">
          <Input
            data-testid="email"
            autoComplete="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </FormField>

        <FormField
          label="Password"
          description="At least 8 characters, including a letter and a number."
          error={fieldErrors.password}
          errorTestId="password-error"
        >
          <Input
            data-testid="password"
            autoComplete="new-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </FormField>

        {serverErrorMessage ? (
          <Alert variant="destructive" data-testid="register-error">
            <AlertDescription>{serverErrorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Button className="w-full" data-testid="create-account" loading={isPending} type="submit">
          {isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}
