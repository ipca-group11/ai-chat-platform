import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as avatar from './avatar';
import * as dialog from './dialog';
import * as dropdownMenu from './dropdown-menu';
import * as barrel from './index';
import * as select from './select';
import * as tabs from './tabs';
import * as toast from './toast';
import * as tooltip from './tooltip';

/** Every public entry point: `@app/ui` plus the per-component entries (AICHAT-239). */
const ui = { ...barrel, ...avatar, ...dialog, ...dropdownMenu, ...select, ...tabs, ...toast, ...tooltip };

// AC-18: "Every microfrontend (mfe-auth, mfe-chat, mfe-settings) uses only
// design-system components for UI primitives, with no ad-hoc primitive markup."
//
// The mfe-auth/mfe-chat/mfe-settings applications themselves live outside this
// package (in the shell/auth/chat/configuration pods) and are out of scope for
// packages/ui's own test suite. What this package can and must guarantee is the
// precondition for that criterion: every primitive an mfe would otherwise be
// tempted to hand-roll (buttons, form controls, layout/surface components,
// overlays, feedback, and typography) is available from the public entry points,
// `@app/ui` and its per-component entries (`@app/ui/dialog`, ...; AICHAT-239), so
// consumers never have a reason to reach for ad-hoc markup.
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
  ])('AC-18: exports the %s primitive from the `@app/ui` entry points', (name) => {
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

// AICHAT-239: `@app/ui` is a Module Federation shared singleton, loaded whole by every page. The
// components built on the large Base UI primitives stay out of the barrel, in their own entry.
describe('@app/ui entry points (AICHAT-239)', () => {
  const entries = { avatar, dialog, 'dropdown-menu': dropdownMenu, select, tabs, toast, tooltip };

  it.each(Object.entries(entries))('keeps the %s components out of the barrel', (_name, entry) => {
    for (const name of Object.keys(entry)) expect(barrel).not.toHaveProperty(name);
  });

  it('publishes every per-component entry in package.json and builds it', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    const config = readFileSync(resolve(__dirname, '../vite.config.ts'), 'utf8');
    for (const name of Object.keys(entries)) {
      expect(pkg.exports[`./${name}`]).toEqual({ types: `./dist/${name}.d.ts`, import: `./dist/${name}.js` });
      expect(config).toContain(`'${name}'`);
    }
  });
});
