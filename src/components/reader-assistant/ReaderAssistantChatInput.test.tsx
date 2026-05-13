import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReaderAssistantChatInput from './ReaderAssistantChatInput';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

function Harness({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  return <ReaderAssistantChatInput draft={draft} onDraftChange={setDraft} onSubmit={onSubmit} />;
}

describe('ReaderAssistantChatInput', () => {
  it('submits on Enter and does not submit on Shift+Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness initial="hi" onSubmit={onSubmit} />);
    const field = screen.getByRole('textbox');
    await user.type(field, '{Shift>}{Enter}{/Shift}line2');
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(field, '{Enter}');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('disables send when draft is empty', () => {
    render(
      <ReaderAssistantChatInput draft="  " onDraftChange={() => {}} onSubmit={() => {}} disabled={false} />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
