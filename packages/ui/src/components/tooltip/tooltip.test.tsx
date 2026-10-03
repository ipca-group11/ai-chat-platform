import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../button/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

describe('Tooltip', () => {
  it('AC-19: hides content by default until opened', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
          <TooltipContent>Saved successfully</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });

  it('AC-19: renders content when forced open (controlled), e.g. for a visible/open state', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
          <TooltipContent>Saved successfully</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('AC-16: applies token-driven surface classes to the popup', () => {
    render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger render={<Button variant="outline">Hover me</Button>} />
          <TooltipContent>Saved successfully</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Saved successfully')).toHaveClass('bg-popover', 'text-popover-foreground');
  });
});
