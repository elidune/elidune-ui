import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ReaderAssistantChatThread from './ReaderAssistantChatThread';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe('ReaderAssistantChatThread', () => {
  it('renders degraded badge when fallbackUsed', () => {
    render(
      <MemoryRouter>
        <ReaderAssistantChatThread
          messages={[{ id: 'a1', role: 'assistant', content: 'reply', fallbackUsed: true }]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('readerAssistant.degradedMode')).toBeTruthy();
  });

  it('shows empty state when no messages', () => {
    render(
      <MemoryRouter>
        <ReaderAssistantChatThread messages={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('readerAssistant.emptyThread')).toBeTruthy();
  });
});
