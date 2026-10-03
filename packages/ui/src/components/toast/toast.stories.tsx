import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/button';
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Toaster,
  useToastManager,
} from './toast';

const meta: Meta = {
  title: 'Components/Toast',
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};
export default meta;

type Story = StoryObj;

function TriggerDemo({ variant }: { variant: 'default' | 'destructive' | 'success' }) {
  const toastManager = useToastManager();
  return (
    <>
      <Button
        onClick={() =>
          toastManager.add({
            title: variant === 'destructive' ? 'Something went wrong' : 'Message sent',
            description:
              variant === 'destructive'
                ? 'The provider request failed. Please try again.'
                : 'Your message was delivered.',
            type: variant,
          })
        }
      >
        Show {variant} toast
      </Button>
      <Toaster />
    </>
  );
}

export const Default: Story = {
  render: () => <TriggerDemo variant="default" />,
};

export const Success: Story = {
  render: () => <TriggerDemo variant="success" />,
};

export const Destructive: Story = {
  render: () => <TriggerDemo variant="destructive" />,
};

export const StaticOpen: Story = {
  render: () => (
    <ToastViewport className="static">
      <Toast toast={{ id: '1' }} variant="destructive" className="static translate-x-0">
        <div>
          <ToastTitle>Provider error</ToastTitle>
          <ToastDescription>OpenAI request failed with a rate limit error.</ToastDescription>
        </div>
        <ToastAction>Retry</ToastAction>
        <ToastClose />
      </Toast>
    </ToastViewport>
  ),
};
