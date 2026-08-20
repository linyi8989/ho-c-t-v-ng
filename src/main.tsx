import {StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Suspense fallback={(
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500 font-bold text-sm">Đang tải giao diện...</p>
        </div>
      )}>
        <App />
      </Suspense>
    </AuthProvider>
  </StrictMode>,
);

