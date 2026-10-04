import type { Meta, StoryObj } from '@storybook/react-vite';
import { RemoteFallback } from './RemoteFallback';

const meta = {
  title: 'App/Shell/RemoteFallback',
  component: RemoteFallback,
  tags: ['autodocs'],
  args: {
    scopeName: 'chat',
    onRetry: () => undefined,
  },
} satisfies Meta<typeof RemoteFallback>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Shown in place of the chat remote when it fails to load. */
export const Chat: Story = {};

export const Settings: Story = {
  args: { scopeName: 'settings' },
};
