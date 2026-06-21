import { useEffect, useRef, useState } from 'react';
import { authApi } from 'aws-blocks';
import { AccountMenuBar, onAuthChange } from '@aws-blocks/blocks/ui';
import LoginPage from './pages/LoginPage';
import TicketListPage from './pages/TicketListPage';
import TicketCreatePage from './pages/TicketCreatePage';
import TicketDetailPage from './pages/TicketDetailPage';

type User = { username: string; userSub: string };
type View = { name: 'list' } | { name: 'create' } | { name: 'detail'; ticketId: string };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<View>({ name: 'list' });
  const menuRef = useRef<HTMLDivElement>(null);

  // ログイン状態の変化を購読
  useEffect(() => onAuthChange(authApi, (u) => setUser(u as User | null)), []);

  // アカウントメニュー（サインアウト等）を描画
  useEffect(() => {
    if (user && menuRef.current && !menuRef.current.hasChildNodes()) {
      menuRef.current.appendChild(AccountMenuBar(authApi));
    }
  }, [user]);

  if (!user) return <LoginPage />;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20 }}>Mini Support Desk</h1>
        <div ref={menuRef} />
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
