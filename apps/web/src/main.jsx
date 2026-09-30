import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';
import { installContentGuard } from './utils/contentGuard';
import { installGlobalErrorHandlers } from './services/clientErrors';
import { registerServiceWorker } from './services/appSw';

installGlobalErrorHandlers(); // gửi lỗi JS/handle promise reject về Admin → "Lỗi player"
installContentGuard();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* A crash used to leave the page background and nothing else, which reads
        as "still loading" rather than "broken". The boundary makes it text. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
