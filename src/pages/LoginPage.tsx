// Ch.03: Cognito 認証の実装後に完成
type Props = {
  onLogin: () => void;
};

export default function LoginPage({ onLogin }: Props) {
  return (
    <div>
      <h1>Mini Support Desk</h1>
      <button onClick={onLogin}>ログイン</button>
    </div>
  );
}
