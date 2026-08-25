import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * A query client with retries and caching off, so component tests observe
 * exactly one request per action and never a stale cached answer.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

export interface StubbedResponse {
  status: number;
  body: unknown;
}

/**
 * Replaces `fetch` with a queue of canned responses and records the calls,
 * so a test can assert both what the UI rendered and what it sent.
 */
export function stubFetch(responses: StubbedResponse[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const queue = [...responses];

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    const next = queue.shift();
    if (!next) {
      throw new Error(`Unexpected fetch call to ${String(input)}`);
    }

    return Promise.resolve({
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: () => Promise.resolve(next.body),
    } as Response);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
