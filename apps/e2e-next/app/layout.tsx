import type { ReactNode } from 'react';
import { CONTRACT_CSS } from '@pip-it-up/e2e-contract';

export const metadata = { title: 'pip-it-up e2e: next', icons: { icon: 'data:,' } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style id="contract-styles">{CONTRACT_CSS}</style>
      </head>
      <body>
        <main id="app">{children}</main>
      </body>
    </html>
  );
}
