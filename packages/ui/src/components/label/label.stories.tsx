import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../input/input';
import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: 'Components/Label',
  component: Label,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: 'Email' },
};

export const AssociatedWithControl: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="story-email">Email</Label>
      <Input id="story-email" placeholder="ada@example.com" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-2 opacity-70">
      <Label htmlFor="story-email-disabled">Email</Label>
      <Input id="story-email-disabled" disabled placeholder="ada@example.com" />
    </div>
  ),
};
