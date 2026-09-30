import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { installContentGuard } from './utils/contentGuard';
import { installGlobalErrorHandlers } from './services/clientErrors';
import { registerServiceWorker } from './services/appSw';

installGlobalErrorHandlers(); // gửi lỗi JS/handle promise reject về Admin → "Lỗi player"
installContentGuard();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
