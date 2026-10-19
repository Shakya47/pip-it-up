import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyHarness, parseRoute } from '@pip-it-up/e2e-contract';
import { ContractPage } from './Contract';
import { ReactOnlyPage, REACT_ONLY_ROUTES } from './ReactOnly';
import { PersistPage } from './Persist';

/**
 * Routes: the shared contract (`#/<scenario>?...`), React-only pages (`#/react-<name>`), and the
 * route-persistent extension (`#/persist/<home|away>?...`, tag `@ext-persist`). The route is read
 * once at load; the persist page runs its own hash router for home ↔ away.
 */
const initialRoute = parseRoute(location.hash);
// Contract stylesheet + `<base href>` (SEC-201), shared with the other targets.
applyHarness(initialRoute);
const path = location.hash.replace(/^#\/?/, '').split('?')[0];

function App() {
  if (path.startsWith('persist')) return <PersistPage />;
  if ((REACT_ONLY_ROUTES as readonly string[]).includes(path)) return <ReactOnlyPage name={path as (typeof REACT_ONLY_ROUTES)[number]} />;
  return <ContractPage route={initialRoute} />;
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
