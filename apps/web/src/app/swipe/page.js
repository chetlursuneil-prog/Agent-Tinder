'use client';
import { useState, useEffect } from 'react';
import { getProfiles, createMatch, getProfileByUserId } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import AgentCard from '../../components/AgentCard';
import LoadingSpinner from '../../components/LoadingSpinner';

const DEMO_PROFILES = [
  { id: 'demo_1', skills: ['Python', 'ML', 'NLP'], about: 'AI researcher specializing in NLP and transformer architectures.', price: 120 },
  { id: 'demo_2', skills: ['React', 'Node.js', 'TypeScript'], about: 'Full-stack developer with 8 years experience building SaaS.', price: 95 },
  { id: 'demo_3', skills: ['Solidity', 'Rust', 'DeFi'], about: 'Smart contract auditor and blockchain architect.', price: 200 },
  { id: 'demo_4', skills: ['Design', 'Figma', 'UX'], about: 'Product designer focused on developer tools and dashboards.', price: 85 },
  { id: 'demo_5', skills: ['DevOps', 'Kubernetes', 'AWS'], about: 'Cloud infrastructure engineer. CI/CD pipelines and observability.', price: 140 },
];

export default function SwipePage() {
  const { user } = useAuth();
  const [myProfile, setMyProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [index, setIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [anim, setAnim] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadProfiles = async (q) => {
    setLoading(true);
    try {
      let foundProfile = null;
      if (user && user.id) {
        try {
          foundProfile = await getProfileByUserId(user.id);
          setMyProfile(foundProfile);
        } catch (err) {
          foundProfile = null;
          setMyProfile(null);
        }
      }

      const params = { q: q || undefined };
      if (foundProfile) params.excludeForProfileId = foundProfile.id;

      try {
        const data = await getProfiles(params);
        console.log('Swipe.loadProfiles: getProfiles response', data);
        // client-side filter: drop profiles without a sensible name (test seeds like "A"/"B")
        const filtered = (data || []).filter(p => {
          if (!p) return false;
          // exclude the signed-in user's own profile
          if (foundProfile && p.id === foundProfile.id) return false;
          if (user && user.id && p.user_id === user.id) return false;
          const name = (p.name || '').trim();
          if (!name) return false;
          if (name.length <= 1) return false;
          return true;
        });
        setProfiles(filtered);
      } catch (err) {
        console.error('Swipe.loadProfiles: getProfiles failed', err);
        // Retry without exclude in case myProfile lookup or exclude caused an error
        try {
          const data2 = await getProfiles({ q: q || undefined });
          console.log('Swipe.loadProfiles: retry getProfiles response', data2);
          const filtered2 = (data2 || []).filter(p => {
            if (!p) return false;
            // exclude the signed-in user's own profile
            if (foundProfile && p.id === foundProfile.id) return false;
            if (user && user.id && p.user_id === user.id) return false;
            const name = (p.name || '').trim();
            if (!name) return false;
            if (name.length <= 1) return false;
            return true;
          });
          setProfiles(filtered2);
        } catch (err2) {
          setProfiles(DEMO_PROFILES);
        }
      }
    } catch {
      setProfiles(DEMO_PROFILES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles(filter);
  }, [filter, user && user.id]);

  const refreshProfiles = async () => {
    setIndex(0);
    setLoading(true);
    await loadProfiles(filter);
    setLoading(false);
  };

  const current = profiles[index];

  async function swipe(direction) {
    if (!current) return;
    setAnim(direction === 'right' ? 'animate-slide-right' : 'animate-slide-left');
    if (direction === 'right') {
      // use the signed-in user's profile id when creating matches
      const useProfile = myProfile || (user?.id ? await getProfileByUserId(user.id).catch(() => null) : null);
      if (!useProfile) {
        // user has not created a profile yet
        setMessage('💚 Liked! Create a profile to enable matches.');
      } else {
        createMatch(useProfile.id, current.id)
          .then(data => {
            if (data && data.id) {
              setMessage('💚 It\'s a match!');
            } else if (data && data.liked) {
              setMessage('💚 Liked! Waiting for mutual match.');
            } else {
              setMessage('💚 Liked!');
            }
          })
          .catch(() => { setMessage('💚 Liked!'); });
      }
    } else {
      setMessage('👎 Passed');
    }
    setTimeout(() => {
      setAnim('');
      setMessage('');
      setIndex(i => i + 1);
    }, 400);
  }

  if (loading) return <LoadingSpinner text="Finding agents..." />;

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-2xl text-gray-400">No more agents to swipe on!</p>
        <a href="/matches" className="text-brand underline">View your matches →</a>
        <button onClick={refreshProfiles} className="px-6 py-2 border border-gray-700 rounded-lg text-sm hover:border-brand transition">
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center mt-8 gap-6">
      <h2 className="text-2xl font-bold">Discover Agents</h2>

      {/* Debug output removed: Fetched profiles list */}

      <div className="flex gap-2 w-full max-w-md">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-brand outline-none"
          placeholder="Filter by skill (e.g. Python, React)"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setIndex(0); setLoading(true); loadProfiles(filter).finally(() => setLoading(false)); } }}
        />
      </div>

      <div className={`transition-all duration-300 ${anim}`}>
        <AgentCard
          profile={current}
          onLike={(p) => swipe('right')}
          onPass={(p) => swipe('left')}
        />
      </div>

      {message && <p className="text-lg font-semibold animate-pulse">{message}</p>}
      <p className="text-gray-600 text-sm">{index + 1} / {profiles.length}</p>
    </div>
  );
}
