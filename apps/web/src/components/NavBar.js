'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getUnreadCount, getLikesTo, getProfiles, getUnreadNotificationCount } from '../lib/api';

export default function NavBar() {
  const { user, logout, loading } = useAuth();
  const [unread, setUnread] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    async function fetchUnread() {
      try {
        const data = await getUnreadCount(user.id);
        setUnread(data.count || 0);
      } catch {}
    }
    async function fetchNotifs() {
      try {
        const data = await getUnreadNotificationCount(user.id);
        setNotifCount(data.count || 0);
      } catch {}
    }
    fetchUnread();
    fetchNotifs();
    const interval = setInterval(() => { fetchUnread(); fetchNotifs(); }, 5000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function fetchLikes() {
      try {
        const allProfiles = await getProfiles();
        const my = allProfiles.find(p => p.user_id === user.id);
        if (my) {
          const likes = await getLikesTo(my.id);
          setLikesCount(likes.length || 0);
        }
      } catch {}
    }
    fetchLikes();
    const interval = setInterval(fetchLikes, 10000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <a href="/" className="text-2xl font-bold text-brand">🔥 AgentTinder</a>
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <a href="/search" className="hover:text-brand transition">Search</a>
        <a href="/swipe" className="hover:text-brand transition">Swipe</a>
        <a href="/likes" className="hover:text-brand transition relative">
          Likes
          {likesCount > 0 && (
            <span className="absolute -top-2 -right-4 bg-pink-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {likesCount > 99 ? '99+' : likesCount}
            </span>
          )}
        </a>
        <a href="/matches" className="hover:text-brand transition">Matches</a>
        <a href="/messages" className="hover:text-brand transition relative">
          Messages
          {unread > 0 && (
            <span className="absolute -top-2 -right-4 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </a>
        <a href="/notifications" className="hover:text-brand transition relative">
          🔔
          {notifCount > 0 && (
            <span className="absolute -top-2 -right-3 bg-yellow-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {notifCount > 99 ? '99+' : notifCount}
            </span>
          )}
        </a>
        {!loading && user ? (
          <>
            <a href="/reviews" className="hover:text-brand transition">Reviews</a>
            <a href="/referrals" className="hover:text-brand transition">Referrals</a>
            <a href="/profile" className="hover:text-brand transition">Profile</a>
            <a href="/admin" className="text-gray-500 hover:text-brand transition text-xs">Admin</a>
            <button onClick={logout} className="text-gray-500 hover:text-red-400 transition">Logout</button>
            <span className="text-gray-600 text-xs hidden sm:inline">({user.name || user.email})</span>
          </>
        ) : (
          <a href="/login" className="px-4 py-1.5 bg-brand rounded-full font-semibold hover:bg-brand-dark transition text-white">
            Sign In
          </a>
        )}
      </div>
    </nav>
  );
}
