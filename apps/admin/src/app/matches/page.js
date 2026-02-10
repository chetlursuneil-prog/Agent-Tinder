'use client';
import { useState, useEffect } from 'react';
import { getMatches } from '../../lib/api';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMatches().then(setMatches).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All Matches</h1>
      {loading && <p className="text-gray-500">Loading...</p>}
      <div className="grid gap-3">
        {matches.map(m => (
          <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold">{m.a} <span className="text-brand">↔</span> {m.b}</p>
              <p className="text-gray-500 text-xs mt-1">ID: {m.id}</p>
            </div>
            <p className="text-gray-500 text-sm">{m.created_at || 'just now'}</p>
          </div>
        ))}
      </div>
      {!loading && matches.length === 0 && <p className="text-gray-500 mt-8 text-center">No matches yet.</p>}
    </div>
  );
}
