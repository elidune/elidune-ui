import type { EmailTemplateListItem } from '@/types';

/** Only languages supported by the API for template editing (fixed set). */
export const EMAIL_TEMPLATE_EDIT_LANGUAGES = ['french', 'english'] as const;
export type EmailTemplateEditLanguage = (typeof EMAIL_TEMPLATE_EDIT_LANGUAGES)[number];

/** Keep list rows in sync with API constraints after migration 007. */
export function filterEmailTemplatesBySupportedLanguages(
  rows: EmailTemplateListItem[]
): EmailTemplateListItem[] {
  const allowed = new Set<string>(EMAIL_TEMPLATE_EDIT_LANGUAGES);
  return rows.filter((r) => allowed.has(r.language));
}

/** Ordered tabs (French first) among languages present for this template. */
export function emailTemplateLanguagesAvailableForEdit(
  rows: EmailTemplateListItem[]
): EmailTemplateEditLanguage[] {
  const present = new Set(rows.map((r) => r.language));
  return EMAIL_TEMPLATE_EDIT_LANGUAGES.filter((code): code is EmailTemplateEditLanguage =>
    present.has(code)
  );
}

/** Placeholders `{{name}}` supported per templateId (backend contract). */
export const EMAIL_TEMPLATE_VARIABLES: Record<string, string[]> = {
  '2fa_code': ['code'],
  recovery_code: ['code'],
  password_reset: ['token', 'reset_url'],
  hold_ready: ['firstname', 'lastname', 'title', 'barcode_line', 'barcode_line_html', 'expires_at'],
  overdue_reminder: ['firstname', 'lastname', 'loans_list', 'loans_table_html'],
  event_announcement: [
    'firstname',
    'event_name',
    'event_date',
    'event_type',
    'start_time_line',
    'start_time_row',
    'description_line',
    'description_block',
  ],
};

export const EMAIL_TEMPLATES_LIST_QUERY_KEY = ['settings', 'email-templates'] as const;

export function emailTemplateDetailQueryKey(templateId: string, language: string) {
  return ['settings', 'email-template', templateId, language] as const;
}

/** TipTap serializes an empty document as an empty paragraph; treat like legacy empty textarea for API / dirty checks. */
export function normalizeEmailTemplateHtmlForApi(html: string): string | null {
  const t = html.trim();
  if (!t) return null;
  if (/^<p[^>]*>\s*<\/p>$/i.test(t)) return null;
  if (/^<p[^>]*><br\s*\/?>\s*<\/p>$/i.test(t)) return null;
  if (/^<p[^>]*><br[^>]*><\/p>$/i.test(t)) return null;
  return html;
}
