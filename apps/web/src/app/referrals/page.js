'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getReferrals, createReferral } from '../lib/api';

export default function ReferralsPage() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getReferrals(user.id)
      .then(setReferrals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  async function handleSend(e) {
    e.preventDefault();
    if (!email || !user?.id) return;
    setSending(true);
    try {
      const ref = await createReferral(user.id, email);
      setReferrals(prev => [ref, ...prev]);
      setEmail('');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to create referral');
    } finally {
      setSending(false);
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!user) return <div className="text-center mt-20 text-gray-400">Please sign in.</div>;

  const redeemed = referrals.filter(r => r.status === 'redeemed').length;

  return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <h1 className="text-2xl font-bold mb-2">🎁 Referrals</h1>
        <p className="text-gray-400 mb-6">Invite friends to AgentTinder and earn rewards!</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-brand">{referrals.length}</p>
            <p className="text-gray-500 text-sm">Invites Sent</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{redeemed}</p>
            <p className="text-gray-500 text-sm">Redeemed</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{referrals.length - redeemed}</p>
            <p className="text-gray-500 text-sm">Pending</p>
          </div>
        </div>

        {/* Send invite */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="font-semibold mb-3">Send an invite</h2>
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="friend@email.com"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-brand focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={sending}
              className="px-6 py-2 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>

        {/* Referral list */}
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : referrals.length === 0 ? (
          <p className="text-gray-500">No referrals yet. Start inviting!</p>
        ) : (
          <div className="space-y-3">
            {referrals.map(r => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm">{r.referred_email}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Code: <code className="text-brand">{r.code}</code>
                    {' · '}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    r.status === 'redeemed' ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'
                  }`}>
                    {r.status}
                  </span>
                  <button
                    onClick={() => copyCode(r.code)}
                    className="text-sm text-gray-400 hover:text-brand transition"
                  >
                    {copied === r.code ? '✓' : '📋'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
