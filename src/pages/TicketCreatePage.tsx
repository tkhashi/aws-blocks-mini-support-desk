import { useState } from 'react';
import { api } from 'aws-blocks';
import type { TicketPriority } from '../../shared/types';

type Props = {
  onDone: () => void;
  onCancel: () => void;
};

export default function TicketCreatePage({ onDone, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      let attachmentKey: string | undefined;
      if (file) {
        // 署名付き URL を取得し、ブラウザから直接アップロード
        const { key, url } = await api.getAttachmentUploadUrl(file.name);
        await fetch(url, { method: 'PUT', body: file });
        attachmentKey = key;
      }
      await api.createTicket(title.trim(), body.trim(), priority, attachmentKey);
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 18 }}>チケット作成</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
        <input placeholder="件名" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="内容" value={body} rows={5} onChange={(e) => setBody(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
          <option value="normal">🟡 normal</option>
          <option value="high">🔴 high</option>
        </select>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={submit} disabled={submitting}>{submitting ? '送信中...' : '作成'}</button>
          <button onClick={onCancel} disabled={submitting}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
