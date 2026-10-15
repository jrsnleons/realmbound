'use client';

import { useEffect, useState } from 'react';
import { App } from '@/App';

export default function Page() {
  // The whole app is client-driven (local storage, auth session, canvas), so render it after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <App /> : <div className="fixed inset-0 bg-bg" />;
}
