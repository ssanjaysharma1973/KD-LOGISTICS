import React, { useState, useMemo } from 'react';

// maxHours: maximum allowed range in hours (UI-only enforcement)
export const TrackModal = ({ vehicle, onClose, onTrack, maxHours = 48 }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reversePoints, setReversePoints] = useState(false);

  const maxMs = useMemo(() => (Number(maxHours) || 48) * 60 * 60 * 1000, [maxHours]);

  const parseIso = (s) => {
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  };

  const fromTs = parseIso(from);
  const toTs = parseIso(to);

  // only validate when both endpoints are provided; otherwise allow (server may apply defaults)
  const rangeInvalid = (fromTs != null && toTs != null) && (Math.abs(toTs - fromTs) > maxMs);

  const humanMax = `${maxHours}h`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rangeInvalid) return;
    onTrack({ from: from || null, to: to || null, reversePoints });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 10000 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 16 }}>Track {vehicle?.number || vehicle?.vehicle_no || 'vehicle'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>From</label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>To</label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a' }}>
            <input 
              type="checkbox" 
              id="reverse-points"
              checked={reversePoints} 
              onChange={e => setReversePoints(e.target.checked)}
              style={{ width: 14, height: 14, cursor: 'pointer' }}
            />
            <label htmlFor="reverse-points" style={{ fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#44403c' }}>
              Reverse geopoints (draw path backwards)
            </label>
          </div>

          {rangeInvalid && (
            <div style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '8px 10px', borderRadius: 6 }}>
              Selected range exceeds maximum allowed of {humanMax}. Please choose a shorter range.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f1f5f9', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            <button type="submit" disabled={rangeInvalid} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: rangeInvalid ? '#cbd5e1' : '#4f46e5', color: rangeInvalid ? '#94a3b8' : '#fff', cursor: rangeInvalid ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Show Path</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TrackModal;
