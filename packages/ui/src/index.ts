// Public API barrel for @app/ui.
//
// Consumers should only ever import from this file (or `@app/ui/styles.css` for the
// design tokens stylesheet), never reach into `src/components/**` directly, so this
// package's internal file layout can change freely. Keep each export line focused on
// one component's module to minimize merge conflicts between tasks/PRs that add new
// components in parallel.

// Side-effect import so the build extracts these tokens into `dist/styles.css`
// (see the `exports["./styles.css"]` field in package.json). Consumers import the
// stylesheet separately, e.g. `import '@app/ui/styles.css'`.
import './styles/globals.css';

export { cn } from './lib/utils';

export { Button, buttonVariants, type ButtonProps } from './components/button/button';
export { Input, type InputProps } from './components/input/input';
export { Textarea, type TextareaProps } from './components/textarea/textarea';
export { Label, type LabelProps } from './components/label/label';
export { FormField, type FormFieldProps } from './components/form-field/form-field';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card/card';
export { Alert, AlertTitle, AlertDescription, alertVariants, type AlertProps } from './components/alert/alert';
export { Badge, badgeVariants, type BadgeProps } from './components/badge/badge';
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar/avatar';
export { Skeleton } from './components/skeleton/skeleton';
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  type TooltipContentProps,
} from './components/tooltip/tooltip';
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogOverlay,
  DialogContent,
  type DialogContentProps,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog/dialog';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  type DropdownMenuItemProps,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './components/dropdown-menu/dropdown-menu';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './components/select/select';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs/tabs';
export {
  ToastProvider,
  useToastManager,
  createToastManager,
  ToastViewport,
  Toast,
  type ToastProps,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  Toaster,
} from './components/toast/toast';
export {
  H1,
  H2,
  H3,
  H4,
  P,
  Lead,
  Large,
  Small,
  Muted,
  Blockquote,
  InlineCode,
  List,
} from './components/typography/typography';
