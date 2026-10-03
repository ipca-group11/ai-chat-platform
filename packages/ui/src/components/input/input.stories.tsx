import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'Email address' },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: 'ada@example.com' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'ada@example.com' },
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: 'not-an-email' },
};

export const Types: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Input type="text" placeholder="Text" />
      <Input type="email" placeholder="Email" />
      <Input type="password" placeholder="Password" />
      <Input type="number" placeholder="Number" />
    </div>
  ),
};
