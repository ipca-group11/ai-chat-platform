import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Blockquote, H1, H2, H3, H4, InlineCode, Large, Lead, List, Muted, P, Small } from './typography';

describe('Typography', () => {
  it('AC-17: renders each heading level with its native semantic tag (H1-H4)', () => {
    render(
      <>
        <H1>Heading 1</H1>
        <H2>Heading 2</H2>
        <H3>Heading 3</H3>
        <H4>Heading 4</H4>
      </>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Heading 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Heading 3' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Heading 4' })).toBeInTheDocument();
  });

  it('AC-16: heading sizes follow a decreasing scale (H1 largest, H4 smallest)', () => {
    render(
      <>
        <H1>Heading 1</H1>
        <H4>Heading 4</H4>
      </>,
    );
    expect(screen.getByText('Heading 1')).toHaveClass('text-4xl');
    expect(screen.getByText('Heading 4')).toHaveClass('text-xl');
  });

  it('AC-17: P renders a paragraph element', () => {
    render(<P>Body text</P>);
    expect(screen.getByText('Body text').tagName).toBe('P');
  });

  it('AC-17: Lead, Large, Small, and Muted apply their distinct token-driven styles', () => {
    render(
      <>
        <Lead>Lead text</Lead>
        <Large>Large text</Large>
        <Small>Small text</Small>
        <Muted>Muted text</Muted>
      </>,
    );
    expect(screen.getByText('Lead text')).toHaveClass('text-xl', 'text-muted-foreground');
    expect(screen.getByText('Large text')).toHaveClass('text-lg', 'font-semibold');
    expect(screen.getByText('Small text').tagName).toBe('SMALL');
    expect(screen.getByText('Muted text')).toHaveClass('text-muted-foreground');
  });

  it('AC-17: Blockquote renders a blockquote element', () => {
    render(<Blockquote>Quoted text</Blockquote>);
    expect(screen.getByText('Quoted text').tagName).toBe('BLOCKQUOTE');
  });

  it('AC-17: InlineCode renders a code element with monospace styling', () => {
    render(<InlineCode>const x = 1</InlineCode>);
    const code = screen.getByText('const x = 1');
    expect(code.tagName).toBe('CODE');
    expect(code).toHaveClass('font-mono');
  });

  it('AC-17: List renders an unordered list with its items', () => {
    render(
      <List>
        <li>First</li>
        <li>Second</li>
      </List>,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
