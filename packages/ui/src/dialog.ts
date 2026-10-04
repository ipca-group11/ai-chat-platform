// `@app/ui/dialog`: the Dialog component, a separate entry so its Base UI code is only
// downloaded by the pages that render it (AICHAT-239). See the note in `index.ts`.
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
