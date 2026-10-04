// `@app/ui/avatar`: the Avatar component, a separate entry so its Base UI code is only
// downloaded by the pages that render it (AICHAT-239). See the note in `index.ts`.
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar/avatar';
