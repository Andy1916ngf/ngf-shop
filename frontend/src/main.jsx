import React from 'react';
import ReactDOM from 'react-dom/client';
import { BasketProvider } from './context/BasketContext';
import { LangProvider }   from './context/LangContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LangProvider>
      <BasketProvider>
        <App />
      </BasketProvider>
    </LangProvider>
  </React.StrictMode>
);
