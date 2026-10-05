import type { MouseEvent, ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@app/ui";
import { useNavigate } from "../navigation";

export interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Link to the sibling screen, e.g. "Don't have an account?" → /register. */
  switchPrompt: string;
  switchLabel: string;
  switchTo: "/login" | "/register";
}

/** Centered card shared by the login and registration screens. */
export function AuthCard({ title, description, children, switchPrompt, switchLabel, switchTo }: AuthCardProps) {
  const navigate = useNavigate();

  function handleSwitch(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigate({ to: switchTo });
  }

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle data-testid="auth-card-title">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {switchPrompt}&nbsp;
          <a
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={switchTo}
            onClick={handleSwitch}
          >
            {switchLabel}
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}
