'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getConversations, markRead } from '../lib/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import StarRating from '../../components/StarRating';

export default function MessagesListPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    try {
      const data = await getConversations(user.id);
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return <LoadingSpinner text="Loading conversations..." />;

  if (!user) {
    return (
      <div className="mt-12 text-center">
        <p className="text-gray-400 text-lg">Please sign in to view messages.</p>
        <a href="/login" className="text-brand underline mt-2 inline-block">Sign In →</a>
      </div>
    );
  }

  function getOtherName(convo) {
    return convo.user_id_a === user.id ? convo.name_b : convo.name_a;
  }

  function getOtherProfileId(convo) {
    return convo.user_id_a === user.id ? convo.profile_b : convo.profile_a;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="mt-8">
      <h2 className="text-3xl font-bold mb-6">Messages</h2>

      {conversations.length === 0 ? (
        <div className="text-center text-gray-500 mt-12">
          <p className="text-xl mb-2">No conversations yet</p>
          <p className="text-sm">Match with someone and start chatting!</p>
          <a href="/swipe" className="text-brand underline mt-3 inline-block">Start swiping →</a>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map(convo => {
            const otherName = getOtherName(convo);
            const hasUnread = convo.unread_count > 0;
            return (
              <a
                key={convo.match_id}
                href={`/messages/${convo.match_id}`}
                className={`block bg-gray-900 border rounded-xl p-4 hover:border-brand transition ${
                  hasUnread ? 'border-brand/50' : 'border-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-lg shrink-0">
                      {otherName?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold truncate ${hasUnread ? 'text-white' : 'text-gray-300'}`}>
                          {otherName || 'Unknown'}
                          <a
                            href={`/agents/${getOtherProfileId(convo)}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`/agents/${getOtherProfileId(convo)}`, '_blank'); }}
                            className="text-xs text-gray-400 ml-2 underline"
                          >
                            View
                          </a>
                        </p>
                        {hasUnread && (
                          <span className="bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                            {convo.unread_count}
                          </span>
                        )}
                        {/* show small star rating if available */}
                        {(() => {
                          const otherIsB = convo.user_id_a === user.id ? true : false;
                          const rating = otherIsB ? convo.avg_rating_b : convo.avg_rating_a;
                          return rating > 0 ? <div className="ml-1"><StarRating rating={rating} size="text-xs" /></div> : null;
                        })()}
                      </div>
                      <p className={`text-sm truncate ${hasUnread ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
                        {convo.last_message_text ? (
                          <>
                            <span className="text-gray-500">{convo.last_message_from}: </span>
                            {convo.last_message_text}
                          </>
                        ) : (
                          <span className="italic">No messages yet — say hi!</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0 ml-3">
                    {timeAgo(convo.last_message_at || convo.match_created_at)}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
