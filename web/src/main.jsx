import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { Toaster } from '@/components/ui/sonner';
import { CategoryVisibilityProvider } from '@/context/CategoryVisibilityContext';
import App from './App.jsx';
import '@/styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <CategoryVisibilityProvider>
        <App />
        <Toaster />
      </CategoryVisibilityProvider>
    </Provider>
  </StrictMode>,
);
