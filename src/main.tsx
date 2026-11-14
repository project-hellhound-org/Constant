import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider, bootstrapTheme } from './theme/ThemeProvider';
import './index.css';

// Apply the saved theme synchronously so the first paint is already correct (no theme flash).
bootstrapTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
