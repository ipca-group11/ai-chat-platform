import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: { placeholder: 'Type your message…' },
};
export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: 'Hello, world!' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Hello, world!' },
};

export const Invalid: Story = {
  args: { invalid: true, defaultValue: 'Too short' },
};
