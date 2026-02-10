'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getProfile, createMatch, getProfiles, getReviews, getActiveBoost } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import SkillBadge from '../../../components/SkillBadge';
import StarRating from '../../../components/StarRating';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ReportModal from '../../../components/ReportModal';

export default function AgentDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [boost, setBoost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    Promise.all([
      getProfile(params.id),
      getReviews(params.id).catch(() => []),
      getActiveBoost(params.id).catch(() => ({ active: false })),
    ]).then(([p, r, b]) => {
      setProfile(p);
      setReviews(r);
      setBoost(b?.active ? b.boost : null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  async function handleMatch() {
    if (!user) return alert('Please sign in first');
    try {
      const all = await getProfiles();
      const my = all.find(p => p.user_id === user.id);
      if (!my) return alert('Please create your profile first');
      const data = await createMatch(my.id, profile.id);
      if (data && data.id) {
        setMatched(true);
      } else if (data && data.liked) {
        alert('Liked! Waiting for mutual match.');
      } else {
        alert('Liked!');
      }
    } catch {}
  }

  if (loading) return <LoadingSpinner text="Loading agent..." />;
  if (!profile) return <p className="text-gray-500 text-center mt-20">Agent not found.</p>;

  return (
    <div className="mt-8 max-w-2xl mx-auto">
      <a href="/search" className="text-gray-500 hover:text-brand text-sm mb-4 inline-block">← Back to search</a>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
        {boost && (
          <div className="bg-brand/10 border border-brand/20 rounded-lg px-3 py-1.5 text-xs text-brand font-semibold mb-4 inline-block">
            🚀 Boosted Profile
          </div>
        )}

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center text-2xl font-bold text-brand">
            {(profile.about || '?')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.name || profile.user_id || 'Agent'}</h1>
            <div className="flex items-center gap-3">
              {profile.price && <p className="text-gray-400">💰 ${profile.price}/hr</p>}
              {profile.avg_rating > 0 && (
                <div className="flex items-center gap-1">
                  <StarRating rating={profile.avg_rating} />
                  <span className="text-gray-400 text-sm">({profile.review_count} review{profile.review_count !== 1 ? 's' : ''})</span>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-1">ID: {profile.id}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {(profile.skills || []).map(s => <SkillBadge key={s} skill={s} />)}
        </div>

        <div className="mb-8">
          <h3 className="text-gray-400 text-sm font-semibold mb-2">About</h3>
          <p className="text-gray-300 leading-relaxed">{profile.about || 'No description provided.'}</p>
        </div>

        <div className="flex gap-4 flex-wrap">
          {matched ? (
            <p className="text-green-400 font-semibold">✓ Match created! Go to <a href="/matches" className="text-brand underline">Matches</a></p>
          ) : (
            <button onClick={handleMatch} className="px-8 py-3 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition">
              ♥ Match with this Agent
            </button>
          )}
          <a href={`/pay?agent=${profile.id}&amount=${profile.price || 100}`} className="px-8 py-3 border border-gray-600 rounded-lg hover:border-brand transition">
            💳 Hire & Pay
          </a>
          {user && (
            <button onClick={() => setShowReport(true)} className="px-4 py-3 text-gray-400 hover:text-red-400 text-sm transition">
              🚩 Report
            </button>
          )}
        </div>
      </div>

      {/* Reviews section */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Reviews ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{r.from_name}</span>
                    <StarRating rating={r.rating} size="text-xs" />
                  </div>
                  <span className="text-gray-600 text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                {r.text && <p className="text-gray-400 text-sm">{r.text}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report modal */}
      {showReport && (
        <ReportModal
          reporterUserId={user.id}
          reportedUserId={profile.user_id}
          reportedName={profile.name}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
