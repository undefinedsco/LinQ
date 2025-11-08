import { useEffect, useState } from 'react';
import { useSession } from '@inrupt/solid-ui-react';

interface AuthCallbackProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function SolidAuthCallback({ onSuccess, onError }: AuthCallbackProps) {
  const { session } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handle = async () => {
      try {
        await session.handleIncomingRedirect({
          url: typeof window === 'undefined' ? undefined : window.location.href,
          restorePreviousSession: true
        });
        if (!cancelled) {
          onSuccess?.();
        }
      } catch (err) {
        console.error('Solid auth callback failed', err);
        if (!cancelled) {
          const errorMessage = 'Solid 登录回调失败，请返回重试。';
          setError(errorMessage);
          onError?.(errorMessage);
        }
      }
    };

    void handle();

    return () => {
      cancelled = true;
    };
  }, [session, onSuccess, onError]);

  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      <div
        style={{
          width: 'min(420px, 90vw)',
          padding: '2.5rem',
          borderRadius: '1.5rem',
          background: 'rgba(15, 23, 42, 0.65)',
          boxShadow: '0 25px 65px rgba(15, 23, 42, 0.45)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          textAlign: 'center',
          color: '#e2e8f0'
        }}
      >
        {error ? (
          <>
            <h1 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>回调异常</h1>
            <p style={{ marginBottom: '1.5rem', lineHeight: 1.6 }}>{error}</p>
            <button
              type="button"
              onClick={() => onError?.('User cancelled')}
              style={{
                padding: '0.85rem 1.25rem',
                borderRadius: '0.75rem',
                border: 'none',
                background: 'linear-gradient(135deg, #F472B6, #E11D48)',
                color: '#F8FAFC',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              返回主页
            </button>
          </>
        ) : (
          <>
            <h1 style={{ marginBottom: '1rem', fontSize: '1.75rem' }}>正在完成 Solid 登录…</h1>
            <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
              正在安全地处理身份回调，完成后将自动返回首页。
            </p>
          </>
        )}
      </div>
    </section>
  );
}
