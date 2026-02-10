'use client';
import { useState, useEffect } from 'react';
import { getProfiles } from '../../lib/api';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfiles().then(setProfiles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All Profiles</h1>
      {loading && <p className="text-gray-500">Loading...</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-gray-400 border-b border-gray-800">
            <tr>
              <th className="py-3 px-2">ID</th>
              <th className="py-3 px-2">User</th>
              <th className="py-3 px-2">Skills</th>
              <th className="py-3 px-2">About</th>
              <th className="py-3 px-2">Price</th>
              <th className="py-3 px-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-900">
                <td className="py-3 px-2 font-mono text-xs">{p.id}</td>
                <td className="py-3 px-2 text-xs">{p.user_id}</td>
                <td className="py-3 px-2">
                  {(p.skills || []).map(s => (
                    <span key={s} className="inline-block bg-brand/20 text-brand text-xs px-2 py-0.5 rounded mr-1">{s}</span>
                  ))}
                </td>
                <td className="py-3 px-2 text-gray-400 truncate max-w-[200px]">{p.about}</td>
                <td className="py-3 px-2">{p.price ? `$${p.price}` : '—'}</td>
                <td className="py-3 px-2 text-gray-500 text-xs">{p.created_at || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && profiles.length === 0 && <p className="text-gray-500 mt-8 text-center">No profiles yet.</p>}
    </div>
  );
}
