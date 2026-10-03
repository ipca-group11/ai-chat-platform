import { Link } from '@tanstack/react-router';
import { Button, buttonVariants, cn } from '@app/ui';
import { LogOut, MessageSquare, Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme';

export interface NavBarProps {
  /** Signed-in user's email; when absent the app links and logout are hidden. */
  userEmail?: string;
  onLogout: () => void;
}

const navLinkClassName = buttonVariants({ variant: 'ghost', size: 'sm' });
// Active and inactive colors are set separately so the two text colors never compete.
const activeLinkProps = { className: 'bg-accent text-accent-foreground' };
const inactiveLinkProps = { className: 'text-muted-foreground' };

/**
 * Top-level navigation, built only from design-system primitives (`@app/ui`)
 * per SPEC §3.4 / AC-18 — no ad-hoc primitive markup.
 */
export function NavBar({ userEmail, onLogout }: NavBarProps) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link to="/chats" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MessageSquare className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden min-[400px]:inline">LLM Chat</span>
        </Link>

        {userEmail ? (
          <>
            <nav aria-label="Main" className="flex items-center gap-1">
              <Link
                to="/chats"
                className={navLinkClassName}
                activeProps={activeLinkProps}
                inactiveProps={inactiveLinkProps}
              >
                Chats
              </Link>
              <Link
                to="/settings"
                className={navLinkClassName}
                activeProps={activeLinkProps}
                inactiveProps={inactiveLinkProps}
              >
                Settings
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{userEmail}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut aria-hidden="true" />
                Log out
              </Button>
            </div>
          </>
        ) : null}

        <Button
          variant="ghost"
          size="icon"
          className={cn('shrink-0 text-muted-foreground', !userEmail && 'ml-auto')}
          onClick={toggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Switch to ${nextTheme} theme`}
        >
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </div>
    </header>
  );
}
