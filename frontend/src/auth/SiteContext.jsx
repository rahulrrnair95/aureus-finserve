import { createContext, useContext, useEffect, useState } from 'react';
import { publicApi } from '../api/endpoints';

// Fallback values only used until /api/public/site responds (or if it is unreachable).
const FALLBACK = {
  firmName: 'Aureus Finserve',
  tagline: 'Wealth Beyond Today',
  arn: null,
  arnValidTill: null,
  disclaimer: 'Mutual fund investments are subject to market risks, read all scheme related documents carefully.',
  scoresUrl: 'https://scores.sebi.gov.in/',
  odrUrl: 'https://smartodr.in/',
  stats: null,
  escalation: [],
};

const SiteContext = createContext({ site: FALLBACK, loaded: false, error: null });

export function SiteProvider({ children }) {
  const [state, setState] = useState({ site: FALLBACK, loaded: false, error: null });
  useEffect(() => {
    publicApi
      .site()
      .then((s) => setState({ site: { ...FALLBACK, ...s }, loaded: true, error: null }))
      .catch((error) => setState({ site: FALLBACK, loaded: true, error }));
  }, []);
  return <SiteContext.Provider value={state}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}
