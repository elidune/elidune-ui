import { Link } from 'react-router-dom';
import type { Hold } from '@/types';
import { holdPrimaryDocumentLabel, holdSecondaryDocumentLabel } from '@/utils/holdDisplay';

export default function HoldDocumentCell({ hold }: { hold: Hold }) {
  const sub = holdSecondaryDocumentLabel(hold);
  const primary = holdPrimaryDocumentLabel(hold);
  const biblioId = hold.biblio?.id;

  const lines = (
    <>
      <div
        className={
          biblioId
            ? 'font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline'
            : 'font-medium text-gray-900 dark:text-white'
        }
      >
        {primary}
      </div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{sub}</div>}
    </>
  );

  if (biblioId) {
    return (
      <Link
        to={`/biblios/${biblioId}`}
        className="group block rounded-md -m-1 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
      >
        {lines}
      </Link>
    );
  }

  return <div>{lines}</div>;
}
