import { useEffect, useState } from 'react';
import { auth } from './api';
import LoginPage from './pages/LoginPage';
import TicketListPage from './pages/TicketListPage';
import TicketCreatePage from './pages/TicketCreatePage';
import TicketDetailPage from './pages/TicketDetailPage';

type User = { username: string; userSub: string };
type View = { name: 'list' } | { name: 'create' } | { name: 'detail'; ticketId: string };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>({ name: 'list' });

  // 起動時にセッション Cookie からログイン状態を確認する（GET /auth/me）
  useEffect(() => {
    auth.me()
      .then((u) => setUser(u))
      .finally(() => setChecking(false));
  }, []);

  const signOut = async () => {
    await auth.signOut();
    setUser(null);
  };

  if (checking) return <p style={{ textAlign: 'center', marginTop: 64 }}>読み込み中...</p>;
  if (!user) return <LoginPage onSignedIn={(u) => setUser(u)} />;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20 }}>Mini Support Desk</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#666' }}>{user.username}</span>
          <button onClick={signOut}>サインアウト</button>
        </div>
      </header>

      {view.name === 'list' && (
        <TicketListPage
          onCreate={() => setView({ name: 'create' })}
          onOpen={(ticketId) => setView({ name: 'detail', ticketId })}
        />
      )}
      {view.name === 'create' && (
        <TicketCreatePage
          onDone={() => setView({ name: 'list' })}
          onCancel={() => setView({ name: 'list' })}
        />
      )}
      {view.name === 'detail' && (
        <TicketDetailPage ticketId={view.ticketId} onBack={() => setView({ name: 'list' })} />
      )}
    </div>
  );
}
