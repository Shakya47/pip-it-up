import React from 'react';

const GITHUB_REPO_URL = 'https://github.com/Shakya47/pip-it-up';

interface ViewSourceLinkProps {
  file: string;
}

export const ViewSourceLink: React.FC<ViewSourceLinkProps> = ({ file }) => {
  const url = `${GITHUB_REPO_URL}/blob/main/${file}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-black dark:hover:text-white transition-all shadow-sm"
      aria-label="View source code for this demo on GitHub"
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
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
      View source
    </a>
  );
};
