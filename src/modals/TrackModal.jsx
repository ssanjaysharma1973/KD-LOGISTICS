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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-xl p-6 z-[10000] w-96 shadow-lg">
        <h3 className="font-bold mb-3">Track {vehicle?.number || 'vehicle'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium">From</label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} className="w-full mt-1 p-2 border rounded" />
          </div>
          <div>
            <label className="text-xs font-medium">To</label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} className="w-full mt-1 p-2 border rounded" />
          </div>

          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
            <input 
              type="checkbox" 
              id="reverse-points"
              checked={reversePoints} 
              onChange={e => setReversePoints(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="reverse-points" className="text-xs font-medium cursor-pointer text-slate-700">
              Reverse geopoints (draw path backwards)
            </label>
          </div>

          {rangeInvalid && (
            <div className="text-sm text-rose-600 bg-rose-50 p-2 rounded">Selected range exceeds maximum allowed of {humanMax}. Please choose a shorter range.</div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-gray-100">Cancel</button>
            <button type="submit" disabled={rangeInvalid} className={`px-3 py-2 rounded text-black ${rangeInvalid ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600'}`}>Show Path</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TrackModal;
