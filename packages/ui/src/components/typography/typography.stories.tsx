import type { Meta, StoryObj } from '@storybook/react-vite';
import { Blockquote, H1, H2, H3, H4, InlineCode, Large, Lead, List, Muted, P, Small } from './typography';

const meta: Meta = {
  title: 'Components/Typography',
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj;

export const Headings: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <H1>H1: The quick brown fox</H1>
      <H2>H2: The quick brown fox</H2>
      <H3>H3: The quick brown fox</H3>
      <H4>H4: The quick brown fox</H4>
    </div>
  ),
};

export const Paragraph: Story = {
  render: () => (
    <P>
      The chat interface streams tokens as they arrive from the provider, so the response appears
      progressively rather than all at once.
    </P>
  ),
};

export const LeadText: Story = {
  render: () => <Lead>A short, larger introduction paragraph used under a page heading.</Lead>,
};

export const LargeText: Story = {
  render: () => <Large>Are you sure you want to delete this chat?</Large>,
};

export const SmallText: Story = {
  render: () => <Small>Last updated 2 minutes ago</Small>,
};

export const MutedText: Story = {
  render: () => <Muted>Enter your API key to enable this provider.</Muted>,
};

export const BlockquoteExample: Story = {
  render: () => (
    <Blockquote>&ldquo;The best way to predict the future is to invent it.&rdquo; — Alan Kay</Blockquote>
  ),
};

export const InlineCodeExample: Story = {
  render: () => (
    <P>
      Run <InlineCode>pnpm nx run ui:storybook</InlineCode> to preview this design system locally.
    </P>
  ),
};

export const ListExample: Story = {
  render: () => (
    <List>
      <li>Create, list, rename, open, and delete chats</li>
      <li>Choose a provider and model per chat</li>
      <li>Attach files to a message</li>
    </List>
  ),
};
