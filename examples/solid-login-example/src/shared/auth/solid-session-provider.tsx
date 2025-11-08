'use client';

import { SessionProvider } from '@inrupt/solid-ui-react';
import type { ReactNode } from 'react';

type SolidSessionProviderProps = {
  children: ReactNode;
};

export const SOLID_SESSION_ID = 'linq-web-session';

export function SolidSessionProvider({ children }: SolidSessionProviderProps) {
  return (
    <SessionProvider
      sessionId={SOLID_SESSION_ID}
      restorePreviousSession
      skipLoadingProfile
      onError={(error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Solid session error', error);
        }
      }}
    >
      {children}
    </SessionProvider>
  );
}
