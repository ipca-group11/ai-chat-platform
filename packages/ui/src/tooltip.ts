// `@app/ui/tooltip`: the Tooltip component, a separate entry so its Base UI code is only
// downloaded by the pages that render it (AICHAT-239). See the note in `index.ts`.
export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  type TooltipContentProps,
} from './components/tooltip/tooltip';
