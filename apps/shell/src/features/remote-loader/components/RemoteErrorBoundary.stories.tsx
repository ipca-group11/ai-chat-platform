import type { Meta, StoryObj } from '@storybook/react-vite';
import { RemoteErrorBoundary } from './RemoteErrorBoundary';

function HealthyRemote() {
  return <p className="text-sm">The remote rendered normally.</p>;
}

function CrashingRemote(): never {
  throw new Error('remote entry failed to load');
}

const meta = {
  title: 'App/Shell/RemoteErrorBoundary',
  component: RemoteErrorBoundary,
  tags: ['autodocs'],
  args: {
    scopeName: 'chat',
    children: <HealthyRemote />,
  },
} satisfies Meta<typeof RemoteErrorBoundary>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The remote renders: the boundary is transparent. */
export const Healthy: Story = {};

/**
 * The remote throws: only this scope is replaced by the fallback. The error is
 * logged to the console by the boundary, as it is in the app.
 */
export const RemoteFailed: Story = {
  args: { children: <CrashingRemote /> },
};
