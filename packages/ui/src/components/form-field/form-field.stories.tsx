import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../input/input';
import { Textarea } from '../textarea/textarea';
import { FormField } from './form-field';

const meta: Meta<typeof FormField> = {
  title: 'Components/FormField',
  component: FormField,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  render: () => (
    <FormField label="Email" description="We'll never share your email.">
      <Input placeholder="ada@example.com" />
    </FormField>
  ),
};

export const Required: Story = {
  render: () => (
    <FormField label="Email" required>
      <Input placeholder="ada@example.com" />
    </FormField>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <FormField label="Email" error="Enter a valid email address.">
      <Input defaultValue="not-an-email" />
    </FormField>
  ),
};

export const Disabled: Story = {
  render: () => (
    <FormField label="Email" description="Managed by your organization." disabled>
      <Input defaultValue="ada@example.com" />
    </FormField>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <FormField label="Message" description="Up to 500 characters.">
      <Textarea placeholder="Type your message…" />
    </FormField>
  ),
};
