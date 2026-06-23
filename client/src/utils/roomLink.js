/** Build a shareable URL that opens Sketchy with the room code pre-filled. */
export function buildRoomInviteUrl(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', String(code).trim().toUpperCase());
  return url.toString();
}

/** Read an invite room code from ?room= or ?code= query params. */
export function getInviteRoomCode() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('room') || params.get('code');
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Remove invite params from the URL after joining (keeps history clean). */
export function clearInviteRoomParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('room') && !url.searchParams.has('code')) return;
  url.searchParams.delete('room');
  url.searchParams.delete('code');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next || '/');
}
