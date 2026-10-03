import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';

const meta: Meta<typeof Alert> = {
  title: 'Components/Alert',
  component: Alert,
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: () => (
    <Alert role="status">
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Your settings were saved.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>Invalid email or password.</AlertDescription>
    </Alert>
  ),
};
