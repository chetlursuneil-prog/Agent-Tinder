'use client';
import { useState, useEffect } from 'react';
import { getSummary } from '../lib/api';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const poll = () => getSummary().then(setSummary).catch(() => setError('Backend not reachable'));
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const cards = summary ? [
    { label: 'Users', value: summary.users, color: 'text-blue-400' },
    { label: 'Profiles', value: summary.profiles, color: 'text-green-400' },
    { label: 'Matches', value: summary.matches, color: 'text-brand' },
    { label: 'Contracts', value: summary.contracts, color: 'text-yellow-400' },
    { label: 'Disputes', value: summary.disputes, color: 'text-red-400' },
  ] : [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Platform Dashboard</h1>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {!summary && !error && <p className="text-gray-500">Loading...</p>}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {cards.map(c => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className={`text-4xl font-extrabold ${c.color}`}>{c.value}</p>
            <p className="text-gray-400 mt-2 text-sm">{c.label}</p>
          </div>
        ))}
      </div>
      {summary && (
        <p className="text-gray-600 text-xs">Last updated: {summary.time} · Auto-refreshes every 5s</p>
      )}
    </div>
  );
}
