import { useEffect, useState } from 'react'
import App from './App'
import RoutePersistentPage from './RoutePersistentPage'

/**
 * Top-level page split.
 *
 * The playground uses bare fragment hashes for scroll-to (`#basic-demo`), so a LEADING SLASH
 * distinguishes the route-persistent page's own routes (`#/dashboard`, `#/reports`, ...).
 */
const isPersistentPage = () => window.location.hash.startsWith('#/')

export default function Root() {
  const [persistent, setPersistent] = useState(isPersistentPage)

  useEffect(() => {
    const onHashChange = () => setPersistent(isPersistentPage())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return persistent ? <RoutePersistentPage /> : <App />
}
