import { test, expect } from '@playwright/test';

test.describe('Reader assistant (mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'e2e-token');
    });

    const sessionsState: {
      list: Array<Record<string, unknown>>;
    } = { list: [] };

    await page.route('**/api/v1/health', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ status: 'ok', version: 'e2e' }),
        contentType: 'application/json',
      });
    });

    await page.route('**/api/v1/library-info', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ name: 'E2E Library' }),
        contentType: 'application/json',
      });
    });

    await page.route('**/api/v1/auth/me', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: '1',
          username: 'e2e',
          firstname: 'Pat',
          lastname: 'Ron',
          accountType: 'Reader',
        }),
        contentType: 'application/json',
      });
    });

    await page.route(
      (url) => url.pathname === '/api/v1/reader-assistant/sessions/sess-1/messages',
      (route) => {
        if (route.request().method() !== 'POST') {
          void route.abort();
          return;
        }
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session_id: 'sess-1',
            assistant_message_id: 'am-1',
            answer: 'Here is one title you may enjoy.',
            fallback_used: false,
            recommendations: [
              {
                id: 'r1',
                kind: 'in_catalog',
                biblio_id: 'bib-77',
                score: 0.9,
                rationale: 'Close tone and pacing.',
                biblio: { title: 'E2E Book' },
              },
            ],
          }),
        });
      },
    );

    await page.route(
      (url) => url.pathname === '/api/v1/reader-assistant/sessions/sess-1',
      (route) => {
        if (route.request().method() !== 'GET') {
          void route.abort();
          return;
        }
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'sess-1',
            user_id: '1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: [],
          }),
        });
      },
    );

    await page.route(
      (url) => url.pathname === '/api/v1/reader-assistant/sessions',
      (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          const total = sessionsState.list.length;
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: sessionsState.list,
              total,
              page: 1,
              per_page: 25,
              page_count: total > 0 ? 1 : 0,
            }),
          });
          return;
        }
        if (method === 'POST') {
          const row = {
            id: 'sess-1',
            user_id: '1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          sessionsState.list = [row];
          route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(row) });
          return;
        }
        void route.abort();
      },
    );
  });

  test('creates session, sends message, shows recommendation', async ({ page }) => {
    await page.goto('/reader-assistant');

    await expect(page.getByRole('heading', { level: 1, name: 'Assistant lecture' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Nouvelle conversation' }).click();

    const textarea = page.getByRole('textbox', { name: 'Message à l’assistant' });
    await textarea.waitFor({ state: 'visible', timeout: 15_000 });
    await textarea.fill('I like short novels');
    await textarea.press('Enter');

    await expect(page.getByRole('heading', { name: 'E2E Book', level: 4 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Close tone and pacing\./)).toBeVisible();

    await expect(page.getByRole('link', { name: 'Voir la notice' })).toHaveAttribute(
      'href',
      '/biblios/bib-77',
    );
  });
});
