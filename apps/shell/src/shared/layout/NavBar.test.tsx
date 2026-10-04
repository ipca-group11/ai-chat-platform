import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../test/renderWithRouter';
import { NavBar } from './NavBar';

describe('NavBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  describe('signed out', () => {
    it('shows the brand link and the theme toggle, but no app links, email or logout', async () => {
      await renderWithRouter(<NavBar onLogout={() => undefined} />, '/login');

      expect(screen.getByRole('link', { name: /LLM Chat/ })).toHaveAttribute('href', '/chats');
      expect(screen.getByRole('button', { name: /switch to/i })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    });
  });

  describe('signed in', () => {
    it('shows the main links and the user email', async () => {
      await renderWithRouter(<NavBar userEmail="ana@example.com" onLogout={() => undefined} />);

      const nav = screen.getByRole('navigation', { name: 'Main' });
      expect(nav).toContainElement(screen.getByRole('link', { name: 'Chats' }));
      expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
      expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    });

    it('marks the link of the current page as active', async () => {
      await renderWithRouter(<NavBar userEmail="ana@example.com" onLogout={() => undefined} />, '/settings');

      expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Chats' })).not.toHaveAttribute('aria-current');
    });

    it('calls onLogout when Log out is pressed', async () => {
      const onLogout = vi.fn();
      const user = userEvent.setup();
      await renderWithRouter(<NavBar userEmail="ana@example.com" onLogout={onLogout} />);

      await user.click(screen.getByRole('button', { name: 'Log out' }));

      expect(onLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme toggle', () => {
    it('offers the dark theme when the current one is light', async () => {
      await renderWithRouter(<NavBar onLogout={() => undefined} />);
      expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
    });

    it('switches to dark on click: label, <html> class and stored choice follow', async () => {
      const user = userEvent.setup();
      await renderWithRouter(<NavBar onLogout={() => undefined} />);

      await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

      expect(await screen.findByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
      expect(document.documentElement).toHaveClass('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('switches back to light on the second click', async () => {
      const user = userEvent.setup();
      await renderWithRouter(<NavBar onLogout={() => undefined} />);

      await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
      await user.click(await screen.findByRole('button', { name: 'Switch to light theme' }));

      expect(await screen.findByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
      expect(document.documentElement).not.toHaveClass('dark');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('starts from the stored choice', async () => {
      localStorage.setItem('theme', 'dark');
      await renderWithRouter(<NavBar onLogout={() => undefined} />);
      expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
    });
  });
});
