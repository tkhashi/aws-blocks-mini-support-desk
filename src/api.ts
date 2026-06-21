// RawRoute 版のフロントエンド API クライアント。
//
// main ブランチでは `import { api, authApi } from 'aws-blocks'` で型安全な RPC を
// 呼んでいたが、このブランチではバックエンドが RawRoute（生 HTTP）なので、
// 素の `fetch` でエンドポイントを叩く。
//
// 認証はセッション Cookie（HttpOnly）。`credentials: 'include'` を付けることで
// サインイン時に発行された Cookie が以降のリクエストへ自動的に乗る。
// 開発時は vite の proxy（vite.config.ts）が下記の相対パスを API サーバー
// (localhost:3001) へ転送するため、同一オリジン扱いで Cookie が機能する。
import type { Ticket, TicketPriority } from '../shared/types';

type User = { username: string; userSub: string };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body?.error ?? message;
    } catch {
      /* レスポンスが JSON でない場合は statusText のまま */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

// ─── 認証 ─────────────────────────────────────────────────────────────────────
export const auth = {
  signUp: (username: string, password: string) =>
    post<{ isSignUpComplete?: boolean }>('/auth/sign-up', { username, password }),
  confirm: (username: string, code: string) =>
    post<unknown>('/auth/confirm', { username, code }),
  signIn: (username: string, password: string) =>
    post<{ isSignedIn: boolean }>('/auth/sign-in', { username, password }),
  signOut: () => post<{ ok: true }>('/auth/sign-out'),
  me: () => req<{ user: User | null }>('/auth/me').then((r) => r.user),
};

// ─── チケット ─────────────────────────────────────────────────────────────────
export const tickets = {
  list: () => req<Ticket[]>('/tickets'),
  get: (id: string) => req<Ticket>(`/tickets/${id}`),
  create: (input: { title: string; body: string; priority: TicketPriority; attachmentKey?: string }) =>
    post<Ticket>('/tickets', input),
  close: (id: string) => post<{ ok: true }>(`/tickets/${id}/close`),
  draftAnswer: (id: string) => post<{ answer: string }>(`/tickets/${id}/draft-answer`),
};

// ─── 添付・検索 ───────────────────────────────────────────────────────────────
export const attachments = {
  uploadUrl: (filename: string) => post<{ key: string; url: string }>('/attachments/upload-url', { filename }),
};

export const searchDocs = (q: string) =>
  req<Array<{ text: string; score: number; source: string }>>(`/search?q=${encodeURIComponent(q)}`);

// ─── CSV エクスポート（非 JSON のダウンロード） ───────────────────────────────
// RawRoute が text/csv + Content-Disposition で返すので、Blob にしてダウンロードする。
export async function downloadTicketsCsv(): Promise<void> {
  const res = await fetch('/export/tickets.csv', { credentials: 'include' });
  if (!res.ok) throw new Error('CSV のエクスポートに失敗しました');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tickets.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
