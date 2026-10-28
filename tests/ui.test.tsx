// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import Dashboard from '@/components/dashboard';
import { demoData } from '@/lib/demo';
const props = { user: null, configured: false, databaseError: false, sample: demoData };
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('opens the composer, allows recipient fields and closes accessibly', () => {
  render(<Dashboard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compose email' }));
  expect(screen.getByRole('heading', { name: 'Start a conversation' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cc / Bcc' }));
  expect(screen.getByLabelText('Bcc')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Email message'), {
    target: { value: 'Hello recipient' },
  });
  expect((screen.getByLabelText('Email message') as HTMLTextAreaElement).value).toBe(
    'Hello recipient',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('heading', { name: 'Start a conversation' })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it('switches workspace sections and exposes the approval workflow', () => {
  render(<Dashboard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Accounts' }));
  expect(screen.getByRole('heading', { name: 'Ask for access. Never assume it.' })).toBeTruthy();
  expect(screen.getByLabelText('Mailbox owner’s email')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Documents' }));
  expect(screen.getByRole('heading', { name: 'A home for your next proposal' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByLabelText('Timezone')).toBeTruthy();
});
it('filters sample emails and opens their labeled detail view', () => {
  render(<Dashboard {...props} />);
  fireEvent.change(screen.getByLabelText('Search tracked emails'), { target: { value: 'Autumn' } });
  expect(screen.queryByRole('button', { name: 'Let’s find a time to connect' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Proposal · Autumn brand refresh' }));
  expect(screen.getByRole('heading', { name: 'Recipient activity' })).toBeTruthy();
  expect(screen.getByText(/This is a sample message/)).toBeTruthy();
});
it('shows setup guidance rather than simulating Google connection', () => {
  render(<Dashboard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Connect your Gmail' }));
  expect(screen.getByRole('heading', { name: 'Connect your real workspace' })).toBeTruthy();
  expect(screen.getByText('Deployment setup required')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
it('starts a real workspace empty and loads only its API results', async () => {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const path = String(input);
    return new Response(
      JSON.stringify(
        path.startsWith('/api/dashboard')
          ? {
              messages: [],
              activity: [],
              chart: [],
              hasMore: false,
              stats: { sent: 0, opens: 0, clicks: 0, replies: 0, document_views: 0 },
            }
          : [],
      ),
    );
  });
  render(
    <Dashboard
      {...props}
      user={{ name: 'Real User', email: 'real@example.com', timezone: 'UTC' }}
      configured
    />,
  );
  expect(screen.queryByText('Demo mode')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Proposal · Autumn brand refresh' })).toBeNull();
  await waitFor(() => expect(fetch).toHaveBeenCalled(), { timeout: 2000 });
  expect(screen.getByText('Make your first connection')).toBeTruthy();
});
