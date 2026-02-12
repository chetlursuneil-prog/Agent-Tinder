'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getProfileByUserId, createBoost, getActiveBoost } from '../lib/api';

export default function BoostPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activeBoost, setActiveBoost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const p = await getProfileByUserId(user.id);
        setProfile(p);
        const b = await getActiveBoost(p.id);
        if (b?.active) setActiveBoost(b.boost);
      } catch {}
      setLoading(false);
    })();
  }, [user?.id]);

  async function handleBoost(hours) {
    if (!profile) return;
    setBoosting(true);
    try {
      const boost = await createBoost(profile.id, hours);
      setActiveBoost(boost);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to boost');
    } finally {
      setBoosting(false);
    }
  }

  if (!user) return <div className="text-center mt-20 text-gray-400">Please sign in.</div>;

  return (
      <div className="max-w-xl mx-auto mt-8 px-4">
        <h1 className="text-2xl font-bold mb-2">🚀 Boost Your Profile</h1>
        <p className="text-gray-400 mb-8">Get more visibility in search results and the swipe deck.</p>

        {loading && <p className="text-gray-500">Loading...</p>}

        {!loading && !profile && (
          <p className="text-gray-500">Create a profile first to use boosts.</p>
        )}

        {!loading && profile && activeBoost && (
          <div className="bg-brand/10 border border-brand rounded-2xl p-6 text-center mb-8">
            <p className="text-3xl mb-2">🚀</p>
            <p className="text-xl font-bold text-brand mb-2">Your profile is boosted!</p>
            <p className="text-gray-400">Expires: {new Date(activeBoost.expires_at).toLocaleString()}</p>
            <p className="text-gray-500 text-sm mt-2">
              Time remaining: {Math.max(0, Math.round((new Date(activeBoost.expires_at) - Date.now()) / (1000 * 60 * 60)))} hours
            </p>
          </div>
        )}

        {!loading && profile && !activeBoost && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { hours: 1, label: '1 Hour', price: 'Free', desc: 'Quick visibility bump' },
              { hours: 24, label: '24 Hours', price: '$4.99', desc: 'Full day of top placement' },
              { hours: 72, label: '3 Days', price: '$9.99', desc: 'Maximum exposure', popular: true },
            ].map(plan => (
              <div key={plan.hours} className={`bg-gray-900 border rounded-2xl p-6 text-center ${plan.popular ? 'border-brand' : 'border-gray-800'}`}>
                {plan.popular && (
                  <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full font-semibold">Popular</span>
                )}
                <p className="text-2xl font-bold mt-3">{plan.label}</p>
                <p className="text-brand text-xl font-bold mt-2">{plan.price}</p>
                <p className="text-gray-500 text-sm mt-2 mb-4">{plan.desc}</p>
                <button
                  onClick={() => handleBoost(plan.hours)}
                  disabled={boosting}
                  className={`w-full py-2 rounded-lg font-semibold transition disabled:opacity-50 ${
                    plan.popular ? 'bg-brand hover:bg-brand-dark' : 'border border-gray-600 hover:border-brand'
                  }`}
                >
                  {boosting ? 'Boosting...' : 'Boost Now'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
  );
}
