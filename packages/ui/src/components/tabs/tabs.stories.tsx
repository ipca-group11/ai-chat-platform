import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-96">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="disabled" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account">Update your account settings here.</TabsContent>
      <TabsContent value="providers">Manage your LLM provider API keys here.</TabsContent>
      <TabsContent value="disabled">Not reachable.</TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="account" orientation="vertical" className="flex w-96 gap-4">
      <TabsList className="h-auto flex-col">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
      </TabsList>
      <div className="flex-1">
        <TabsContent value="account">Update your account settings here.</TabsContent>
        <TabsContent value="providers">Manage your LLM provider API keys here.</TabsContent>
      </div>
    </Tabs>
  ),
};
