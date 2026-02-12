'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/api';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();
  }, [user?.id]);

  async function loadNotifications() {
    try {
      const data = await getNotifications(user.id);
      setNotifs(data);
    } catch {}
    setLoading(false);
  }

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead(user.id);
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  }

  const typeIcons = {
    review: '⭐',
    referral: '🎁',
    match: '💜',
    like: '❤️',
    report: '🚩',
    boost: '🚀',
  };

  if (!user) return <div className="text-center mt-20 text-gray-400">Please sign in.</div>;

  return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">🔔 Notifications</h1>
          {notifs.some(n => !n.read) && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-brand hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading && <p className="text-gray-500">Loading...</p>}

        {!loading && notifs.length === 0 && (
          <p className="text-gray-500">No notifications yet.</p>
        )}

        <div className="space-y-2">
          {notifs.map(n => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                n.read
                  ? 'bg-gray-900 border-gray-800 opacity-60'
                  : 'bg-gray-900 border-brand/40 hover:border-brand'
              }`}
              onClick={() => {
                if (!n.read) handleMarkRead(n.id);
                if (n.link) window.location.href = n.link;
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl">{typeIcons[n.type] || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{n.title}</p>
                  {n.body && <p className="text-gray-400 text-sm mt-1">{n.body}</p>}
                  <p className="text-gray-600 text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.read && <span className="w-2 h-2 bg-brand rounded-full mt-2 shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      </div>
  );
}
