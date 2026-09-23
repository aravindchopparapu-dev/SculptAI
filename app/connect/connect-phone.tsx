'use client';
import { useState } from 'react';
export default function ConnectPhone({ name }: { name: string }) {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [done, setDone] = useState(false);
  async function approve() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/mobile/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', code }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to pair.');
      setDone(true); setMessage('iPhone approved. Return to SculptAI on your iPhone to finish connecting.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to pair.'); } finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 520, margin: '10vh auto', padding: 28, color: '#eaf5f2', background: '#14222e', borderRadius: 24 }}>
    <p style={{ color: '#a7e7cc', letterSpacing: 3 }}>SCULPTAI / IPHONE</p><h1>One account. Every screen.</h1>
    <p>Signed in as {name}. Enter the code displayed in your SculptAI iPhone app.</p>
    <p>Only approve a code you requested. This connects the phone to your profile, plans, and AI Coach for 30 days.</p>
    {!done && <form onSubmit={event => { event.preventDefault(); void approve(); }}><label htmlFor="pair-code">iPhone pairing code</label>
      <input id="pair-code" autoComplete="off" autoCapitalize="characters" value={code} onChange={e => setCode(e.target.value)} maxLength={14} required style={{ width: '100%', padding: 16, margin: '12px 0', color: '#eefaf6', background: '#0b1622', border: '1px solid #95c7b6', borderRadius: 12, fontSize: 22, letterSpacing: 3 }} />
      <button disabled={busy || code.replace(/[\s-]/g, '').length !== 10} style={{ padding: '14px 24px', borderRadius: 30, background: '#b9f4d8', color: '#12332b' }}>{busy ? 'Connecting…' : 'Approve my iPhone'}</button></form>}
    {message && <p role={done ? 'status' : 'alert'}>{message}</p>}<p><a href="/" style={{ color: '#b9f4d8' }}>Back to SculptAI</a></p>
  </main>;
}
