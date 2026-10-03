import { describe, expect, it } from 'vitest';
import * as ui from './index';

// AC-18: "Every microfrontend (mfe-auth, mfe-chat, mfe-settings) uses only
// design-system components for UI primitives, with no ad-hoc primitive markup."
//
// The mfe-auth/mfe-chat/mfe-settings applications themselves live outside this
// package (in the shell/auth/chat/configuration pods) and are out of scope for
// packages/ui's own test suite. What this package can and must guarantee is the
// precondition for that criterion: every primitive an mfe would otherwise be
// tempted to hand-roll (buttons, form controls, layout/surface components,
// overlays, feedback, and typography) is available from the single public entry
// point, `@app/ui`, so consumers never have a reason to reach for ad-hoc markup.
describe('@app/ui public API (AC-18)', () => {
  it.each([
    'Button',
    'Input',
    'Textarea',
    'Label',
    'FormField',
    'Card',
    'CardHeader',
    'CardTitle',
    'CardDescription',
    'CardContent',
    'CardFooter',
    'Dialog',
    'DialogTrigger',
    'DialogContent',
    'DropdownMenu',
    'DropdownMenuTrigger',
    'DropdownMenuContent',
    'DropdownMenuItem',
    'Select',
    'SelectTrigger',
    'SelectContent',
    'SelectItem',
    'Tabs',
    'TabsList',
    'TabsTrigger',
    'TabsContent',
    'Toast',
    'ToastProvider',
    'Toaster',
    'Badge',
    'Avatar',
    'AvatarImage',
    'AvatarFallback',
    'Skeleton',
    'Tooltip',
    'TooltipTrigger',
    'TooltipContent',
    'H1',
    'H2',
    'H3',
    'H4',
    'P',
    'Lead',
    'Large',
    'Small',
    'Muted',
    'Blockquote',
    'InlineCode',
    'List',
  ])('AC-18: exports the %s primitive from the single `@app/ui` entry point', (name) => {
    expect(ui).toHaveProperty(name);
    expect((ui as Record<string, unknown>)[name]).toBeDefined();
  });

  it(
    'AC-18: exposes every primitive category an mfe needs (actions, forms, surfaces, ' +
      'overlays, navigation, feedback, typography) so no ad-hoc primitive markup is necessary',
    () => {
      const exported = Object.keys(ui);
      const requiredCategories: Record<string, string[]> = {
        actions: ['Button'],
        forms: ['Input', 'Textarea', 'Label', 'FormField', 'Select'],
        surfaces: ['Card'],
        overlays: ['Dialog', 'DropdownMenu', 'Tooltip'],
        navigation: ['Tabs'],
        feedback: ['Toast', 'Badge', 'Skeleton', 'Avatar'],
        typography: ['H1', 'P'],
      };

      for (const [category, members] of Object.entries(requiredCategories)) {
        for (const member of members) {
          expect(exported, `missing "${member}" for category "${category}"`).toContain(member);
        }
      }
    },
  );
});
