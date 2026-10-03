import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-48" />,
};

export const AvatarPlaceholder: Story = {
  render: () => <Skeleton className="h-12 w-12 rounded-full" />,
};

export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-48" />
    </div>
  ),
};
