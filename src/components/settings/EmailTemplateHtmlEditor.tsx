import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  RemoveFormatting,
} from 'lucide-react';

type EmailTemplateHtmlEditorProps = {
  /** Bump when server snapshot (template / locale / saved revision) changes */
  syncRevision: string;
  initialHtml: string;
  onHtmlChange: (html: string) => void;
  disabled: boolean;
  placeholder: string;
};

function ToolbarButton({
  onClick,
  isActive,
  disabled: btnDisabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive ?? false}
      disabled={btnDisabled}
      onClick={onClick}
      className={`rounded-md p-1.5 text-gray-700 transition-colors dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed ${
        isActive
          ? 'bg-amber-200/90 text-amber-950 dark:bg-amber-800/60 dark:text-amber-50'
          : 'hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function EmailTemplateHtmlEditorInner({
  initialHtml,
  onHtmlChange,
  disabled,
  placeholder,
}: Omit<EmailTemplateHtmlEditorProps, 'syncRevision'>) {
  const { t } = useTranslation();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-amber-700 underline dark:text-amber-300',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: initialHtml || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          'tiptap email-html-tiptap min-h-[12rem] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none',
      },
    },
    onCreate: ({ editor: ed }) => {
      onHtmlChange(ed.getHTML());
    },
    onUpdate: ({ editor: ed }) => {
      onHtmlChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return (
      <div className="min-h-[12rem] rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900" />
    );
  }

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const next = window.prompt(t('settings.emailTemplates.editorLinkPrompt'), previous ?? 'https://');
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1 py-1 dark:border-gray-600"
        role="toolbar"
        aria-label={t('settings.emailTemplates.editorToolbar')}
      >
        <ToolbarButton
          title={t('settings.emailTemplates.editorBold')}
          isActive={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorItalic')}
          isActive={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorUnderline')}
          isActive={editor.isActive('underline')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorStrike')}
          isActive={editor.isActive('strike')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-gray-200 dark:bg-gray-600" aria-hidden />
        <ToolbarButton
          title={t('settings.emailTemplates.editorH2')}
          isActive={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorH3')}
          isActive={editor.isActive('heading', { level: 3 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-gray-200 dark:bg-gray-600" aria-hidden />
        <ToolbarButton
          title={t('settings.emailTemplates.editorBulletList')}
          isActive={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorOrderedList')}
          isActive={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-gray-200 dark:bg-gray-600" aria-hidden />
        <ToolbarButton
          title={t('settings.emailTemplates.editorLink')}
          isActive={editor.isActive('link')}
          disabled={disabled}
          onClick={() => setLink()}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorUnlink')}
          disabled={disabled || !editor.isActive('link')}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 w-px self-stretch bg-gray-200 dark:bg-gray-600" aria-hidden />
        <ToolbarButton
          title={t('settings.emailTemplates.editorUndo')}
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorRedo')}
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title={t('settings.emailTemplates.editorClearFormatting')}
          disabled={disabled}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export default function EmailTemplateHtmlEditor(props: EmailTemplateHtmlEditorProps) {
  const { syncRevision, ...rest } = props;
  return <EmailTemplateHtmlEditorInner key={syncRevision} {...rest} />;
}
