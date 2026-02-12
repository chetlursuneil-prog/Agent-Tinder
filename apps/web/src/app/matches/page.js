'use client';
import { useState, useEffect } from 'react';
import { getMatches, unmatch } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import LoadingSpinner from '../../components/LoadingSpinner';
import StarRating from '../../components/StarRating';

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMatches()
      .then(data => {
        // Filter to only show matches involving the current user
        const userMatches = data.filter(m => m.user_id_a === user?.id || m.user_id_b === user?.id);
        setMatches(userMatches);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  async function handleUnmatch(matchId) {
    if (!confirm('Are you sure you want to unmatch? This will delete all messages.')) return;
    try {
      await unmatch(matchId);
      setMatches(prev => prev.filter(m => m.id !== matchId));
    } catch (err) {
      console.error('Failed to unmatch:', err);
    }
  }

  function getOtherName(m) {
    if (!user) return m.name_a + ' ↔ ' + m.name_b;
    return m.user_id_a === user.id ? m.name_b : m.name_a;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return 'just now';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (loading) return <LoadingSpinner text="Loading matches..." />;

  return (
    <div className="mt-8">
      <h2 className="text-3xl font-bold mb-6">Your Matches</h2>
      {matches.length === 0 && (
        <div className="text-center text-gray-500 mt-12">
          <p className="text-xl mb-2">No matches yet</p>
          <a href="/swipe" className="text-brand underline">Start swiping →</a>
        </div>
      )}
      <div className="grid gap-4">
        {matches.map(m => {
          const otherName = getOtherName(m);
          return (
            <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between hover:border-gray-700 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-lg shrink-0">
                  {otherName?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-semibold">
                    <a href={`/agents/${m.user_id_a === user.id ? m.b : m.a}`} className="hover:underline">{otherName}</a>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-500 text-xs">Matched {timeAgo(m.created_at)}</p>
                    {((m.user_id_a === user.id ? m.avg_rating_b : m.avg_rating_a) > 0 || (m.user_id_a === user.id ? m.review_count_b : m.review_count_a) > 0) && (
                      <div className="flex items-center gap-1">
                        <StarRating rating={(m.user_id_a === user.id ? m.avg_rating_b : m.avg_rating_a) || 0} size="text-xs" />
                        <span className="text-gray-500 text-xs">({(m.user_id_a === user.id ? m.review_count_b : m.review_count_a) || 0})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`/messages/${m.id}`} className="px-4 py-2 bg-brand rounded-lg text-sm font-semibold hover:bg-brand-dark transition">
                  Message
                </a>
                <a href={`/pay?match=${m.id}&amount=100`} className="px-4 py-2 border border-gray-600 rounded-lg text-sm hover:border-brand transition">
                  Pay
                </a>
                <button
                  onClick={() => handleUnmatch(m.id)}
                  className="px-4 py-2 border border-red-800 text-red-400 rounded-lg text-sm hover:bg-red-900/30 hover:border-red-600 transition"
                >
                  Unmatch
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
