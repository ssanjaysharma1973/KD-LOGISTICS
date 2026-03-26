import { API_BASE } from '../utils/apiBase.js';
﻿import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = `${API_BASE}/api`;
const CLIENT_ID = 'CLIENT_001';

export default function BulkUnloadingCharges() {
  const [pois, setPois] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cat1, setCat1] = useState('');
  const [cat2, setCat2] = useState('');
  const [cat3, setCat3] = useState('');
  const selectAllRef = useRef(null);

  const fetchPois = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch ALL pois (427 records with real names) + existing rates separately
      const [poisRes, ratesRes] = await Promise.all([
        fetch(`${API}/pois?clientId=${CLIENT_ID}`),
        fetch(`${API}/poi-unloading-rates?clientId=${CLIENT_ID}`)
      ]);
      if (!poisRes.ok) throw new Error(`Pois HTTP ${poisRes.status}`);
      const poisData = await poisRes.json();
      const ratesData = ratesRes.ok ? await ratesRes.json() : { rates: [] };

      // Build a map of existing rates keyed by poi_id
      const ratesMap = {};
      const ratesList = ratesData.rates || [];
      ratesList.forEach(r => { ratesMap[r.poi_id] = r; });

      // Merge: all destination POIs (secondary/tertiary/other) with their existing rates
      const allPois = (Array.isArray(poisData) ? poisData : [])
        .filter(p => p.type === 'secondary' || p.type === 'tertiary' || p.type === 'other')
        .map(p => {
          const rate = ratesMap[p.id] || {};
          return {
            poi_id: p.id,
            poi_name: p.poi_name,
            city: p.city || '',
            type: p.type || 'other',
            category_1_32ft_34ft: rate.category_1_32ft_34ft || 0,
            category_2_22ft_24ft: rate.category_2_22ft_24ft || 0,
            category_3_small: rate.category_3_small || 0,
            notes: rate.notes || ''
          };
        });

      setPois(allPois);
    } catch (err) {
      setError('Error loading POIs: ' + err.message);
      setPois([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPois(); }, [fetchPois]);

  // Unique sorted cities for dropdown
  const cities = [...new Set(pois.map(p => p.city).filter(Boolean))].sort();

  const filtered = pois.filter(p => {
    const s = search.toLowerCase();
    const matchSearch = !s || (p.poi_name || '').toLowerCase().includes(s) || (p.city || '').toLowerCase().includes(s);
    const matchCity = !cityFilter || p.city === cityFilter;
    const matchType = !typeFilter || p.type === typeFilter;
    return matchSearch && matchCity && matchType;
  });

  const allChecked = filtered.length > 0 && filtered.every(p => selected.has(p.poi_id));
  const someChecked = filtered.some(p => selected.has(p.poi_id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allChecked && someChecked;
    }
  }, [allChecked, someChecked]);

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) {
      filtered.forEach(p => next.delete(p.poi_id));
    } else {
      filtered.forEach(p => next.add(p.poi_id));
    }
    setSelected(next);
  };

  const toggleOne = (poi_id) => {
    const next = new Set(selected);
    if (next.has(poi_id)) next.delete(poi_id);
    else next.add(poi_id);
    setSelected(next);
  };

  const handleSave = async () => {
    if (selected.size === 0) { setError('Please select at least one POI'); return; }
    if (!cat1 && !cat2 && !cat3) { setError('Please enter at least one charge amount'); return; }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updates = Array.from(selected).map(poiId => {
        const poi = pois.find(p => p.poi_id === poiId);
        return fetch(`${API}/poi-unloading-rates/${poiId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: CLIENT_ID,
            category_1_32ft_34ft: cat1 !== '' ? parseFloat(cat1) : (poi?.category_1_32ft_34ft ?? 0),
            category_2_22ft_24ft: cat2 !== '' ? parseFloat(cat2) : (poi?.category_2_22ft_24ft ?? 0),
            category_3_small:     cat3 !== '' ? parseFloat(cat3) : (poi?.category_3_small ?? 0),
            notes: poi?.notes || ''
          })
        });
      });

      const responses = await Promise.all(updates);
      const results = await Promise.all(responses.map(r => r.json().then(body => ({ ok: r.ok, status: r.status, body })).catch(() => ({ ok: r.ok, status: r.status, body: {} }))));
      const failures = results.filter(r => !r.ok);

      if (failures.length === 0) {
        setMessage(`Saved charges for ${selected.size} POI${selected.size !== 1 ? 's' : ''} successfully`);
        setSelected(new Set());
        setCat1(''); setCat2(''); setCat3('');
        await fetchPois();
        setTimeout(() => setMessage(''), 4000);
      } else {
        const detail = failures[0]?.body?.error || `HTTP ${failures[0]?.status}`;
        setError(`${failures.length} update(s) failed: ${detail}`);
      }
    } catch (err) {
      setError('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const typeBadge = (type) => {
    if (type === 'secondary') return { bg: '#dbeafe', color: '#1d4ed8' };
    if (type === 'tertiary')  return { bg: '#fef9c3', color: '#a16207' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  const fmtAmt = (v) => v > 0 ? `₹${v.toLocaleString('en-IN')}` : (v === 0 ? '—' : '');

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px', color: '#1e293b' }}>Unloading Charges  Bulk Entry</h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Select one or more POIs, enter charges for required categories, then click Save.
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', marginBottom: '14px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <span style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => setError('')}></span>
        </div>
      )}
      {message && (
        <div style={{ padding: '10px 14px', marginBottom: '14px', background: '#dcfce7', color: '#166534', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '14px' }}>
           {message}
        </div>
      )}

      {/* Charge Entry Panel */}
      <div style={{ background: '#f0f9ff', border: '2px solid #3b82f6', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
            {selected.size > 0 ? `${selected.size} POI${selected.size !== 1 ? 's' : ''} selected` : 'Select POIs from table below'}
          </span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} style={{ fontSize: '12px', padding: '2px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}>
              Clear selection
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}> 32FT / 34FT ()</label>
            <input type="number" min="0" step="10" placeholder="Enter amount"
              value={cat1} onChange={e => setCat1(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}> 22FT / 24FT ()</label>
            <input type="number" min="0" step="10" placeholder="Enter amount"
              value={cat2} onChange={e => setCat2(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}> Small Vehicle ()</label>
            <input type="number" min="0" step="10" placeholder="Enter amount"
              value={cat3} onChange={e => setCat3(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #93c5fd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button onClick={handleSave}
            disabled={selected.size === 0 || saving || (!cat1 && !cat2 && !cat3)}
            style={{
              padding: '9px 24px',
              background: selected.size > 0 && (cat1 || cat2 || cat3) ? '#2563eb' : '#94a3b8',
              color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px',
              fontWeight: 700, cursor: selected.size > 0 && (cat1 || cat2 || cat3) ? 'pointer' : 'not-allowed'
            }}>
            {saving ? 'Saving...' : ` Save to ${selected.size} POI${selected.size !== 1 ? 's' : ''}`}
          </button>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Leave a category blank to keep its existing value.
          </span>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Search by name..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 2, minWidth: '200px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }} />

        {/* City filter */}
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
          style={{ flex: 1, minWidth: '160px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', background: cityFilter ? '#eff6ff' : '#fff', color: '#1e293b', cursor: 'pointer' }}>
          <option value="">🏙️ All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Type filter */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ minWidth: '150px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', background: typeFilter ? '#eff6ff' : '#fff', color: '#1e293b', cursor: 'pointer' }}>
          <option value="">📂 All Types</option>
          <option value="secondary">Distributor</option>
          <option value="tertiary">Dealer</option>
          <option value="other">Other</option>
        </select>

        {(cityFilter || typeFilter || search) && (
          <button onClick={() => { setCityFilter(''); setTypeFilter(''); setSearch(''); }}
            style={{ padding: '8px 14px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            ✕ Clear
          </button>
        )}

        <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
          {loading ? 'Loading...' : `${filtered.length} of ${pois.length} POIs`}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '15px' }}>Loading POIs...</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#fff' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px' }}>
                  <input type="checkbox" ref={selectAllRef} checked={allChecked} onChange={toggleAll}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }} />
                </th>
                <th style={{ padding: '10px 10px', textAlign: 'left', width: '40px' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>POI NAME</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>CITY</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>TYPE</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>32/34 FT </th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>22/24 FT </th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>SMALL </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No POIs found {search ? `matching "${search}"` : ''}
                  </td>
                </tr>
              ) : filtered.map((poi, idx) => {
                const isSel = selected.has(poi.poi_id);
                const badge = typeBadge(poi.type);
                return (
                  <tr key={poi.poi_id} onClick={() => toggleOne(poi.poi_id)}
                    style={{
                      background: isSel ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSel ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#f8fafc'; }}>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleOne(poi.poi_id)}
                        onClick={e => e.stopPropagation()}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }} />
                    </td>
                    <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 12px', fontWeight: isSel ? 600 : 400, color: '#1e293b' }}>
                      {poi.poi_name || `POI-${poi.poi_id}`}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#475569' }}>{poi.city || ''}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', fontWeight: 600, letterSpacing: '0.3px', background: badge.bg, color: badge.color }}>
                        {poi.type === 'secondary' ? 'Distributor' : poi.type === 'tertiary' ? 'Dealer' : poi.type === 'primary' ? 'Hub' : 'Other'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: poi.category_1_32ft_34ft > 0 ? '#166534' : '#94a3b8' }}>
                      {fmtAmt(poi.category_1_32ft_34ft)}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: poi.category_2_22ft_24ft > 0 ? '#166534' : '#94a3b8' }}>
                      {fmtAmt(poi.category_2_22ft_24ft)}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'right', color: poi.category_3_small > 0 ? '#166534' : '#94a3b8' }}>
                      {fmtAmt(poi.category_3_small)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
