import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import ReaderAssistantRecommendationCards from './ReaderAssistantRecommendationCards';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe('ReaderAssistantRecommendationCards', () => {
  it('renders in-catalog rationale and catalogue link target', () => {
    render(
      <MemoryRouter>
        <ReaderAssistantRecommendationCards
          recommendations={[
            {
              id: '1',
              kind: 'in_catalog',
              biblioId: 'notice-abc',
              rationale: 'Shared themes.',
              score: 0.5,
              biblio: {
                id: 'notice-abc',
                title: 'La Peste',
                author: { id: 'a', lastname: 'Camus', firstname: 'Albert' },
              },
            },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'La Peste' })).toBeTruthy();
    expect(screen.getByText(/Shared themes/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'readerAssistant.viewRecord' });
    expect(link.getAttribute('href')).toContain('/biblios/notice-abc');
  });

  it('renders external badge and URL link', () => {
    render(
      <MemoryRouter>
      <ReaderAssistantRecommendationCards
        recommendations={[
          {
            id: '2',
            kind: 'external',
            rationale: 'For advanced readers.',
            score: 0.2,
            externalRef: 'https://example.com/book',
          },
        ]}
      />
      </MemoryRouter>,
    );
    expect(screen.getByText('readerAssistant.kindExternal')).toBeTruthy();
    const ext = screen.getByRole('link', { name: 'readerAssistant.openLink' });
    expect(ext.getAttribute('href')).toBe('https://example.com/book');
  });
});
