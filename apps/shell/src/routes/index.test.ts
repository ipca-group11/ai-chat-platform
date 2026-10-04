import { describe, expect, it } from 'vitest';
import { isRedirect } from '@tanstack/react-router';
import { Route } from './index';

describe('index route (/)', () => {
  it('always redirects to /chats before loading anything', () => {
    const run = () => Route.options.beforeLoad?.({} as never);

    let thrown: unknown;
    try {
      run();
    } catch (error) {
      thrown = error;
    }

    expect(isRedirect(thrown)).toBe(true);
    expect((thrown as { options: { to: string } }).options.to).toBe('/chats');
  });
});
