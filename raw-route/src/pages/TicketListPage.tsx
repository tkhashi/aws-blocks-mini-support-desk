import { useEffect, useState } from 'react';
import { tickets, downloadTicketsCsv } from '../api';
import type { Ticket } from '../../shared/types';

type Props = {
  onCreate: () => void;
  onOpen: (ticketId: string) => void;
};

export default function TicketListPage({ onCreate, onOpen }: Props) {
  const [list, setList] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tickets.list()
      .then(setList)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18 }}>チケット一覧</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* RawRoute の text/csv エンドポイントを fetch してダウンロード */}
          <button onClick={() => downloadTicketsCsv()}>CSV エクスポート</button>
          <button onClick={onCreate}>新規作成</button>
        </div>
      </div>

      {loading && <p>読み込み中...</p>}
      {!loading && list.length === 0 && <p style={{ color: '#666' }}>チケットはまだありません。</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {list.map((t) => (
          <li
            key={t.id}
            onClick={() => onOpen(t.id)}
            style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, margin: '8px 0', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{t.title}</strong>
              <span style={{ fontSize: 12 }}>
                {t.priority === 'high' ? '🔴 high' : '🟡 normal'} / {t.status}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{t.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
