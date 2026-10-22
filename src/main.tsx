import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/grenze/500.css';
import '@fontsource/grenze/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
