import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { within } from '@testing-library/dom';
import { createRemoteRoute } from './createRemoteRoute';
import type { RemoteLoader } from './model/loadRemote';

type Outcome = 'pending' | 'loaded' | 'failed';

/** Stands in for a federated remote's `./routes` module. */
function FakeRemotePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-sm">The settings remote loaded and rendered its page.</p>
    </div>
  );
}

/** A fake `() => import('mfeX/routes')`: never settles, resolves to a module, or rejects. */
function fakeLoader(outcome: Outcome): RemoteLoader {
  if (outcome === 'pending') return () => new Promise(() => undefined);
  if (outcome === 'loaded') return () => Promise.resolve({ default: FakeRemotePage });
  return () => Promise.reject(new Error('remoteEntry.js responded 404'));
}

interface RemoteRouteDemoProps {
  scopeName: string;
  outcome: Outcome;
}

/** Mounts the component `createRemoteRoute` returns, built once per story with a fake loader. */
function RemoteRouteDemo({ scopeName, outcome }: RemoteRouteDemoProps) {
  const [RemoteRoute] = useState(() => createRemoteRoute(scopeName, fakeLoader(outcome)));
  return <RemoteRoute />;
}

const meta = {
  title: 'App/Shell/createRemoteRoute',
  component: RemoteRouteDemo,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { scopeName: 'settings', outcome: 'pending' },
  render: (args, context) => <RemoteRouteDemo key={context.id} {...args} />,
} satisfies Meta<typeof RemoteRouteDemo>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The remote's entry is still downloading: a skeleton holds its place. */
export const Loading: Story = {};

/** The remote loaded: its page replaces the skeleton. */
export const Loaded: Story = {
  args: { outcome: 'loaded' },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(
      'The settings remote loaded and rendered its page.',
      {},
      { timeout: 5000 },
    );
  },
};

/**
 * The import rejected: only this scope shows the fallback with a retry. The error is logged
 * to the console by the boundary, as it is in the app.
 */
export const Failed: Story = {
  args: { outcome: 'failed' },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('alert', {}, { timeout: 5000 });
  },
};
