import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { applyTextSize, getTextSize } from './utils/useTitle';
// bundled with the entry (not a separate request) so the static site can render one round trip sooner
import { installStaticApi } from './static/staticApi';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';

// VITE_DEMO=1 builds a self-contained preview: API calls are answered in the browser from sample data
// and routing stays in memory (the preview host gives the page no real URL paths).
const DEMO = import.meta.env.VITE_DEMO === '1';
// VITE_STATIC=1 (`npm run build:static`): the public site only, for static hosting (Firebase) with no backend.
// Public GET calls are answered from the /static-api/ JSON snapshot; routing stays BrowserRouter (SPA rewrite).
const STATIC = import.meta.env.VITE_STATIC === '1';

applyTextSize(getTextSize());

async function start() {
  let DemoBanner = null;
  if (STATIC) {
    installStaticApi();
  }
  if (DEMO) {
    const mock = await import('./demo/mockApi');
    mock.installMockApi();
    DemoBanner = (await import('./demo/DemoBanner')).default;
  }
  const Router = DEMO ? MemoryRouter : BrowserRouter;
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Router>
        <App />
        {DemoBanner && <DemoBanner />}
      </Router>
    </React.StrictMode>,
  );
}

start();
