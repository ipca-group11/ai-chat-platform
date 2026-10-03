/**
 * Registration form (PLAN.md F2), built from `@app/ui` components. Validates client-side
 * with the same password/email policy `auth-service` enforces (AC-30, AC-32), surfaces
 * server validation errors such as duplicate email inline (AC-31), and redirects to
 * `/login` on success (AC-34).
 */
export declare function RegisterForm(): import("react").JSX.Element;
