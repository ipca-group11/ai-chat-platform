// `@app/ui/tabs`: the Tabs component, a separate entry so its Base UI code is only
// downloaded by the pages that render it (AICHAT-239). See the note in `index.ts`.
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs/tabs';
