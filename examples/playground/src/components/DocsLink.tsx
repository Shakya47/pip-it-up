const GITHUB_REPO_URL = 'https://github.com/Shakya47/pip-it-up';

interface DocsLinkProps {
  /** Path to the doc file, relative to the repo root. */
  file: string;
  /** Anchor id within that file, without the leading `#`. */
  anchor: string;
  children: React.ReactNode;
}

/** Sends the reader to the real documentation instead of duplicating it in demo code. */
export function DocsLink({ file, anchor, children }: DocsLinkProps) {
  return (
    <a
      href={`${GITHUB_REPO_URL}/blob/main/${file}#${anchor}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
      {children}
    </a>
  );
}
