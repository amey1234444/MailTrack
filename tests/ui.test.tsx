// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import Dashboard from '@/components/dashboard';
const props = {
  user: { name: 'Owner', email: 'owner@example.com', timezone: 'UTC' },
  configured: false,
  databaseError: false,
};
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

it('submits an App Password with explicit consent and displays server errors without exposing it', async () => {
  const { default: ConnectForm } = await import('@/components/connect-form');
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ error: 'Mailbox verification failed' }), { status: 400 }),
  );
  render(<ConnectForm invite="one-use-invite" email="invited@gmail.com" />);
  const password = screen.getByLabelText('Google App Password') as HTMLInputElement;
  expect(password.type).toBe('password');
  expect(
    (screen.getByLabelText('Gmail or Google Workspace email') as HTMLInputElement).readOnly,
  ).toBe(true);
  fireEvent.change(password, { target: { value: 'abcdefghijklmnop' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(password.closest('form')!);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe('Mailbox verification failed'),
  );
  expect(fetch).toHaveBeenCalledWith(
    '/api/auth/password',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'invited@gmail.com',
        password: 'abcdefghijklmnop',
        consent: true,
        invite: 'one-use-invite',
      }),
    }),
  );
});
