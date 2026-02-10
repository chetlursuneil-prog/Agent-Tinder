'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { getConversations, checkReview, createReview, getProfileByUserId } from '../../lib/api';

export default function ReviewsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [reviewStatus, setReviewStatus] = useState({});
  const [selected, setSelected] = useState(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getConversations(user.id)
      .then(async (convs) => {
        setConversations(convs);
        const statuses = {};
        for (const c of convs) {
          try {
            const res = await checkReview(c.match_id, user.id);
            statuses[c.match_id] = res;
          } catch { statuses[c.match_id] = { reviewed: false }; }
        }
        setReviewStatus(statuses);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected || !user?.id) return;
    setSubmitting(true);
    try {
      const otherProfileId = selected.user_id_a === user.id
        ? selected.profile_b : selected.profile_a;
      await createReview({
        fromUserId: user.id,
        toProfileId: otherProfileId,
        matchId: selected.match_id,
        rating,
        text,
      });
      setReviewStatus(prev => ({ ...prev, [selected.match_id]: { reviewed: true } }));
      setSelected(null);
      setRating(5);
      setText('');
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return <div className="text-center mt-20 text-gray-400">Please sign in to leave reviews.</div>;

  return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <h1 className="text-2xl font-bold mb-6">⭐ Reviews</h1>
        <p className="text-gray-400 mb-6">Rate agents you&apos;ve matched with to help the community.</p>

        {loading && <p className="text-gray-500">Loading conversations...</p>}

        {!loading && conversations.length === 0 && (
          <p className="text-gray-500">No matches yet. Match with agents to leave reviews!</p>
        )}

        <div className="space-y-3 mb-8">
          {conversations.map((c) => {
            const otherName = c.user_id_a === user.id ? c.name_b : c.name_a;
            const reviewed = reviewStatus[c.match_id]?.reviewed;
            return (
              <div key={c.match_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{otherName}</p>
                  <p className="text-gray-500 text-sm">Match: {new Date(c.match_created_at).toLocaleDateString()}</p>
                </div>
                {reviewed ? (
                  <span className="text-green-400 text-sm font-semibold">✓ Reviewed</span>
                ) : (
                  <button
                    onClick={() => setSelected(c)}
                    className="px-4 py-2 bg-brand rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
                  >
                    Leave Review
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="bg-gray-900 border border-brand rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              Review {selected.user_id_a === user.id ? selected.name_b : selected.name_a}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`text-2xl ${n <= rating ? 'text-yellow-400' : 'text-gray-600'} hover:scale-110 transition`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Comment (optional)</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-brand focus:outline-none"
                  placeholder="Share your experience..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="px-6 py-2 border border-gray-600 rounded-lg hover:border-brand transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
  );
}
