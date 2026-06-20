import { useEffect, useRef } from 'react';
import { authApi } from 'aws-blocks';
import { Authenticator } from '@aws-blocks/blocks/ui';

// AuthCognito のサインアップ／確認コード／サインインを 1 つの UI が処理する。
// ローカルモックでは確認コードが `npm run dev` のターミナルに出力される。
export default function LoginPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && !ref.current.hasChildNodes()) {
      ref.current.appendChild(Authenticator(authApi));
    }
  }, []);

  return (
    <div style={{ maxWidth: 420, margin: '64px auto', padding: 16, textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>Mini Support Desk</h1>
      <p style={{ color: '#666' }}>サインインして問い合わせを管理しましょう。</p>
      <div ref={ref} />
    </div>
  );
}
