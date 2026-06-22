import { useGame } from '../context/GameContext';

export default function ToastStack() {
  const { toasts } = useGame();
  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div className="toast-item" key={toast.id}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
