import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { Route } from './login';

const validateSearch = Route.options.validateSearch as (search: Record<string, unknown>) => {
  redirect?: string;
};

describe('login route (/login)', () => {
  describe('validateSearch', () => {
    it('keeps a string redirect, set by RequireAuth', () => {
      expect(validateSearch({ redirect: '/chats/42' })).toEqual({ redirect: '/chats/42' });
    });

    it('drops a redirect that is not a string', () => {
      expect(validateSearch({ redirect: 42 })).toEqual({ redirect: undefined });
      expect(validateSearch({ redirect: ['/a'] })).toEqual({ redirect: undefined });
    });

    it('accepts a URL without any search params', () => {
      expect(validateSearch({})).toEqual({ redirect: undefined });
    });

    it('ignores unknown params', () => {
      expect(validateSearch({ redirect: '/x', other: 'y' })).toEqual({ redirect: '/x' });
    });
  });

  it('parses the redirect search param of a real /login URL through the route tree', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/login?redirect=%2Fchats%2F42'] }),
    });

    await router.load();

    expect(router.state.location.search).toEqual({ redirect: '/chats/42' });
    expect(router.state.matches.map((m) => m.routeId)).toContain('/login');
  });
});
