import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Ollama</SelectLabel>
          <SelectItem value="llama3.2:1b">llama3.2:1b</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>OpenAI</SelectLabel>
          <SelectItem value="gpt-4o">gpt-4o</SelectItem>
          <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Anthropic</SelectLabel>
          <SelectItem value="claude-3-5-sonnet">claude-3-5-sonnet</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const Open: Story = {
  render: () => (
    <Select open defaultValue="gpt-4o">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="llama3.2:1b">llama3.2:1b</SelectItem>
        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
        <SelectItem value="claude-3-5-sonnet">claude-3-5-sonnet</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="llama3.2:1b">llama3.2:1b</SelectItem>
      </SelectContent>
    </Select>
  ),
};
