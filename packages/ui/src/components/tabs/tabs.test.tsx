import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function renderTabs() {
  return render(
    <Tabs defaultValue="account">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="providers">Providers</TabsTrigger>
        <TabsTrigger value="billing" disabled>
          Billing
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account settings</TabsContent>
      <TabsContent value="providers">Provider settings</TabsContent>
      <TabsContent value="billing">Billing settings</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('AC-15: shows the default tab panel and not the others', () => {
    renderTabs();
    expect(screen.getByText('Account settings')).toBeVisible();
    expect(screen.queryByText('Provider settings')).not.toBeInTheDocument();
  });

  it('AC-19: switches panels when a different tab is activated', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Providers' }));
    expect(screen.getByText('Provider settings')).toBeVisible();
    expect(screen.queryByText('Account settings')).not.toBeInTheDocument();
  });

  it('AC-19: a disabled tab cannot be activated', async () => {
    renderTabs();
    const billingTab = screen.getByRole('tab', { name: 'Billing' });
    expect(billingTab).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(billingTab);
    expect(screen.getByText('Account settings')).toBeVisible();
  });

  it('AC-20: the active tab is marked aria-selected for assistive tech', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Providers' })).toHaveAttribute('aria-selected', 'false');
  });
});
