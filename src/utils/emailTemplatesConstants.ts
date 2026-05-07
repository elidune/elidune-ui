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
