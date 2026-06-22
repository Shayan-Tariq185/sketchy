import { WifiOff } from 'lucide-react';

export default function ConnectionBanner() {
  return (
    <div className="connection-banner">
      <WifiOff size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
      Connection lost — trying to reconnect you...
    </div>
  );
}
