import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>Delete chat</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription>This action cannot be undone. All messages will be permanently removed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Open: Story = {
  render: () => (
    <Dialog open>
      <DialogTrigger render={<Button>Delete chat</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this chat?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithoutCloseButton: Story = {
  render: () => (
    <Dialog open>
      <DialogTrigger render={<Button>Session expired</Button>} />
      <DialogContent hideCloseButton>
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>Please log in again to continue.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Log in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
