import { useState } from 'react';
import { auth } from '../api';

type User = { username: string; userSub: string };
type Props = { onSignedIn: (user: User) => void };

// main ブランチの `<Authenticator>`（authApi を渡すだけの組み込み UI）の代わりに、
// RawRoute（/auth/*）を fetch で叩く自前フォーム。
// サインアップ → 確認コード入力 → サインインの流れを手書きで実装する。
// ローカルモックでは確認コードが `npm run dev` のターミナルに出力される。
type Mode = 'signIn' | 'signUp' | 'confirm';

export default function LoginPage({ onSignedIn }: Props) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finishSignIn = async () => {
    const result = await auth.signIn(email, password);
    if (!result.isSignedIn) throw new Error('追加の認証ステップが必要です');
    const user = await auth.me();
    if (user) onSignedIn(user);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signUp') {
        await auth.signUp(email, password);
        setMode('confirm'); // 確認コード入力へ
      } else if (mode === 'confirm') {
        await auth.confirm(email, code);
        await finishSignIn(); // 確認後そのままサインイン
      } else {
        await finishSignIn();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', padding: 16, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>Mini Support Desk</h1>
      <p style={{ color: '#666' }}>サインインして問い合わせを管理しましょう。</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, textAlign: 'left' }}>
        <input
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={mode === 'confirm'}
        />
        {mode !== 'confirm' && (
          <input
            type="password"
            placeholder="パスワード（8文字以上・記号を含む）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {mode === 'confirm' && (
          <input
            placeholder="確認コード（ターミナルに出力）"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}

        {error && <p style={{ color: '#c00', fontSize: 13, margin: 0 }}>{error}</p>}

        <button onClick={submit} disabled={busy}>
          {busy ? '処理中...' : mode === 'signUp' ? 'サインアップ' : mode === 'confirm' ? '確認してサインイン' : 'サインイン'}
        </button>
      </div>

      <div style={{ marginTop: 16, fontSize: 13 }}>
        {mode === 'signIn' ? (
          <button onClick={() => { setMode('signUp'); setError(null); }} style={{ background: 'none', border: 'none', color: '#06c', cursor: 'pointer' }}>
            アカウントを作成する
          </button>
        ) : (
          <button onClick={() => { setMode('signIn'); setError(null); }} style={{ background: 'none', border: 'none', color: '#06c', cursor: 'pointer' }}>
            サインインに戻る
          </button>
        )}
      </div>
    </div>
  );
}
