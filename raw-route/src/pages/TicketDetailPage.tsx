import { useEffect, useState } from 'react';
import { tickets } from '../api';
import type { Ticket } from '../../shared/types';

type Props = {
  ticketId: string;
  onBack: () => void;
};

export default function TicketDetailPage({ ticketId, onBack }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const load = () => { tickets.get(ticketId).then(setTicket); };
  useEffect(load, [ticketId]);

  const close = async () => {
    await tickets.close(ticketId);
    load();
  };

  const draft = async () => {
    setDrafting(true);
    try {
      const res = await tickets.draftAnswer(ticketId);
      setAnswer(res.answer);
    } finally {
      setDrafting(false);
    }
  };

  if (!ticket) return <p>読み込み中...</p>;

  return (
    <div>
      <button onClick={onBack}>← 一覧へ</button>
      <h2 style={{ fontSize: 18 }}>{ticket.title}</h2>
      <p style={{ fontSize: 12, color: '#666' }}>
        {ticket.priority === 'high' ? '🔴 high' : '🟡 normal'} / {ticket.status}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.body}</p>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {ticket.status !== 'closed' && <button onClick={close}>クローズ</button>}
        <button onClick={draft} disabled={drafting}>{drafting ? '生成中...' : 'AI 回答案を生成'}</button>
      </div>

      {answer && (
        <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8, background: '#fafafa' }}>
          <strong>AI 回答案</strong>
          <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{answer}</p>
        </div>
      )}
    </div>
  );
}
