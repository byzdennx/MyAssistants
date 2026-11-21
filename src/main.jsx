import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App.tsx';
import { getSettings } from './lib/storage';
import { applySettingsToDom } from './lib/utils';

// terapkan tema sebelum render pertama supaya tidak berkedip
applySettingsToDom(getSettings());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
