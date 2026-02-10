'use client';
import { useState } from 'react';
import { nudgeUser, suspendUser, getUser } from '../../lib/api';

export default function ActionsPage() {
  const [userId, setUserId] = useState('');
  const [nudgeMsg, setNudgeMsg] = useState('');
  const [result, setResult] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  async function handleLookup() {
    setResult('');
    setUserInfo(null);
    try {
      const u = await getUser(userId);
      setUserInfo(u);
    } catch {
      setResult('User not found');
    }
  }

  async function handleNudge() {
    try {
      await nudgeUser(userId, nudgeMsg || 'Please respond to your match.');
      setResult('Nudge sent!');
    } catch {
      setResult('Failed to nudge');
    }
  }

  async function handleSuspend(suspend) {
    if (!confirm(`${suspend ? 'Suspend' : 'Unsuspend'} user ${userId}?`)) return;
    try {
      await suspendUser(userId, suspend);
      setResult(suspend ? 'User suspended' : 'User unsuspended');
      handleLookup();
    } catch {
      setResult('Failed');
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold mb-6">Admin Actions</h1>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
          placeholder="User ID"
          value={userId}
          onChange={e => setUserId(e.target.value)}
        />
        <button onClick={handleLookup} className="px-5 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition font-semibold text-sm">
          Lookup
        </button>
      </div>

      {userInfo && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <p><span className="text-gray-400">ID:</span> {userInfo.id}</p>
          <p><span className="text-gray-400">Email:</span> {userInfo.email}</p>
          <p><span className="text-gray-400">Name:</span> {userInfo.name || '—'}</p>
          <p><span className="text-gray-400">Suspended:</span> <span className={userInfo.suspended ? 'text-red-400' : 'text-green-400'}>{userInfo.suspended ? 'Yes' : 'No'}</span></p>
          <p><span className="text-gray-400">Created:</span> {userInfo.created_at || '—'}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-6">
        <h3 className="text-lg font-semibold">Nudge User</h3>
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
          placeholder="Message (optional)"
          value={nudgeMsg}
          onChange={e => setNudgeMsg(e.target.value)}
        />
        <button onClick={handleNudge} className="px-5 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition font-semibold text-sm">
          Send Nudge
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={() => handleSuspend(true)} className="px-5 py-3 bg-red-600 rounded-lg hover:bg-red-500 transition font-semibold text-sm">
          Suspend User
        </button>
        <button onClick={() => handleSuspend(false)} className="px-5 py-3 bg-green-600 rounded-lg hover:bg-green-500 transition font-semibold text-sm">
          Unsuspend User
        </button>
      </div>

      {result && <p className="mt-4 text-yellow-400 font-semibold">{result}</p>}
    </div>
  );
}
