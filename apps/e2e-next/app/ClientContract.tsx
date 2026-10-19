'use client';

/**
 * The shared React DOM contract (apps/e2e-react/src/Contract.tsx), rendered client-only: contract
 * routes live in the hash (`/#/<scenario>?...`), which never reaches the server, so this page
 * can't be server-rendered consistently. SSR is what /ssr and /ssr-persist are for.
 */
import dynamic from 'next/dynamic';
import { applyHarness, parseRoute } from '@pip-it-up/e2e-contract';

const ContractPage = dynamic(() => import('@pip-it-up/e2e-react/contract').then((m) => m.ContractPage), { ssr: false });

// Client-side, at module load (before the contract page's chunk loads): `<base href>` for SEC-201
// (FB5) and the contract stylesheet (the layout already ships it, so that part is a no-op).
if (typeof location !== 'undefined') applyHarness(parseRoute(location.hash));

export function ClientContract() {
  return <ContractPage route={parseRoute(typeof location === 'undefined' ? '' : location.hash)} />;
}
