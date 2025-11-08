import { useState } from 'react';
import { SessionProvider } from '@inrupt/solid-ui-react';
import WelcomePage from './components/WelcomePage';
import AuthCallback from './components/AuthCallback';
import './styles/globals.css';

type AppState = 'welcome' | 'callback' | 'authenticated';

export default function App() {
  const [appState, setAppState] = useState<AppState>('welcome');

  // Simulate routing for the example
  const handleAuthCallback = () => {
    setAppState('callback');
  };

  const handleAuthSuccess = () => {
    setAppState('authenticated');
  };

  const handleAuthError = (error: string) => {
    console.error('Auth error:', error);
    setAppState('welcome');
  };

  const handleLogout = () => {
    setAppState('welcome');
  };

  return (
    <SessionProvider sessionId="solid-login-example">
      <div className="min-h-screen bg-background text-foreground">
        {appState === 'welcome' && (
          <WelcomePage />
        )}
        
        {appState === 'callback' && (
          <AuthCallback 
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
          />
        )}
        
        {appState === 'authenticated' && (
          <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">🎉 认证成功！</h1>
              <p className="text-muted-foreground mb-6">
                你已经成功连接到 Solid Pod
              </p>
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                退出登录
              </button>
            </div>
          </div>
        )}
      </div>
    </SessionProvider>
  );
}