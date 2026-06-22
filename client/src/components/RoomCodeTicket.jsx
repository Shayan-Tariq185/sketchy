import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

export default function RoomCodeTicket({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleShare = async () => {
    const text = `Join my Sketchy room! Code: ${code}\n${window.location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join my Sketchy room', text });
        return;
      } catch {
        /* user cancelled, fall through to copy */
      }
    }
    handleCopy();
  };

  return (
    <div className="ticket-stub">
      <div className="ticket-main">
        <span className="eyebrow">Room code — friends only</span>
        <div className="ticket-code">
          {code.split('').map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
        <p className="ticket-note">Share this code so your friends can join. No public matchmaking, ever.</p>
      </div>
      <div className="ticket-perforation" aria-hidden="true" />
      <div className="ticket-actions">
        <button className="btn btn-sm btn-ghost" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button className="btn btn-sm btn-pencil" onClick={handleShare}>
          <Share2 size={14} /> Share
        </button>
      </div>
    </div>
  );
}
