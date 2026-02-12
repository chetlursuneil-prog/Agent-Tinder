'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getLikesTo, getLikesFrom, getProfiles, createMatch, deleteLike } from '../lib/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import StarRating from '../../components/StarRating';
import SkillBadge from '../../components/SkillBadge';

export default function LikesPage() {
  const { user } = useAuth();
  const [likes, setLikes] = useState([]);
  const [sentLikes, setSentLikes] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [tab, setTab] = useState('received'); // 'received' or 'sent'

  useEffect(() => {
    if (!user) return;
    loadLikes();
  }, [user]);

  async function loadLikes() {
    try {
      setLoading(true);
      const allProfiles = await getProfiles();
      const my = allProfiles.find(p => p.user_id === user.id);
      if (!my) {
        setLoading(false);
        return;
      }
      setMyProfile(my);

      const incomingLikes = await getLikesTo(my.id);
      setLikes(incomingLikes);

      const outgoingLikes = await getLikesFrom(my.id);
      setSentLikes(outgoingLikes);

      // Load profile details for each liker/likee
      const profileMap = {};
      for (const like of incomingLikes) {
        const p = allProfiles.find(prof => prof.id === like.from_profile);
        if (p) profileMap[like.from_profile] = p;
      }
      for (const like of outgoingLikes) {
        const p = allProfiles.find(prof => prof.id === like.to_profile);
        if (p) profileMap[like.to_profile] = p;
      }
      setProfiles(profileMap);
    } catch (err) {
      console.error('Failed to load likes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMatch(like) {
    if (!myProfile) return;
    setActioningId(like.id);
    try {
      const data = await createMatch(myProfile.id, like.from_profile);
      if (data && data.id) {
        // Match created!
        alert(`🎉 It's a match with ${like.from_name}!`);
        loadLikes(); // refresh
      } else if (data && data.liked) {
        // This shouldn't happen since they already liked us, but handle it
        alert('Like recorded!');
        loadLikes();
      }
    } catch (err) {
      console.error('Match failed:', err);
      alert('Failed to create match');
    } finally {
      setActioningId(null);
    }
  }

  async function handleDismiss(like) {
    setActioningId(like.id);
    try {
      await deleteLike(like.from_profile, myProfile.id);
      loadLikes(); // refresh
    } catch (err) {
      console.error('Dismiss failed:', err);
      alert('Failed to dismiss');
    } finally {
      setActioningId(null);
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Please sign in to view likes.</p>
      </div>
    );
  }

  if (loading) return <LoadingSpinner text="Loading likes..." />;

  if (!myProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Create a profile to see who likes you!</p>
          <a href="/profile" className="text-brand underline">Create Profile →</a>
        </div>
      </div>
    );
  }

  if (likes.length === 0 && sentLikes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-2xl text-gray-400 mb-4">No likes yet</p>
          <p className="text-gray-600 mb-6">Start swiping to get matches!</p>
          <a href="/swipe" className="text-brand underline">Go to Swipe →</a>
        </div>
      </div>
    );
  }

  const displayLikes = tab === 'received' ? likes : sentLikes;

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <h2 className="text-2xl font-bold mb-6">Likes</h2>
      
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-800">
        <button
          onClick={() => setTab('received')}
          className={`pb-3 px-4 font-semibold transition ${
            tab === 'received'
              ? 'text-brand border-b-2 border-brand'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Received ({likes.length})
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`pb-3 px-4 font-semibold transition ${
            tab === 'sent'
              ? 'text-brand border-b-2 border-brand'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Sent ({sentLikes.length})
        </button>
      </div>

      {displayLikes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {tab === 'received' ? 'No one has liked you yet' : 'You haven\'t liked anyone yet'}
          </p>
        </div>
      )}
      
      <div className="grid gap-4">
        {displayLikes.map(like => {
          const profileId = tab === 'received' ? like.from_profile : like.to_profile;
          const profile = profiles[profileId];
          if (!profile) return null;

          const displayName = tab === 'received' ? like.from_name : like.to_name;

          return (
            <div key={like.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center gap-6">
              <div className="flex-shrink-0 w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center text-2xl font-bold text-brand">
                {(displayName || profile.about || '?')[0].toUpperCase()}
              </div>
              
              <div className="flex-1">
                <a href={`/agents/${profile.id}`} className="text-xl font-bold hover:text-brand">{displayName || 'Agent'}</a>
                {profile.avg_rating > 0 && (
                  <div className="mt-1">
                    <StarRating rating={profile.avg_rating} size="text-xs" />
                  </div>
                )}
                {profile.price && <p className="text-gray-400 text-sm">💰 ${profile.price}/hr</p>}
                <div className="flex flex-wrap gap-2 mt-2">
                  {(profile.skills || []).slice(0, 4).map(s => <SkillBadge key={s} skill={s} />)}
                </div>
                <p className="text-gray-500 text-sm mt-2">{profile.about?.substring(0, 100)}...</p>
                <p className="text-xs text-gray-600 mt-1">
                  {tab === 'received' ? 'Liked you' : 'You liked'} {new Date(like.created_at).toLocaleDateString()}
                </p>
              </div>

              {tab === 'received' ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleMatch(like)}
                    disabled={actioningId === like.id}
                    className="px-6 py-2 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {actioningId === like.id ? '...' : '💚 Match'}
                  </button>
                  <button
                    onClick={() => handleDismiss(like)}
                    disabled={actioningId === like.id}
                    className="px-6 py-2 border border-gray-700 rounded-lg hover:border-red-500 hover:text-red-500 transition disabled:opacity-50"
                  >
                    {actioningId === like.id ? '...' : '✕ Dismiss'}
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  <span className="px-4 py-2 bg-gray-800 rounded-lg">⏳ Pending</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
