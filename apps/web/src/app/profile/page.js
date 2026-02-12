'use client';
import { useState, useEffect } from 'react';
import { createProfile, getProfileByUserId } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function ProfilePage() {
  const { user } = useAuth();
  const [skills, setSkills] = useState('');
  const [about, setAbout] = useState('');
  const [price, setPrice] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const profile = await getProfileByUserId(user.id);
        if (profile) {
          setSkills(profile.skills?.join(', ') || '');
          setAbout(profile.about || '');
          setPrice(profile.price?.toString() || '');
        }
      } catch (err) {
        // Profile doesn't exist yet, that's fine
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!user) return setError('Please log in first');
    try {
      const skillArr = skills.split(',').map(s => s.trim()).filter(Boolean);
      await createProfile(user.id, skillArr, about, parseFloat(price) || null);
      setSaved(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save profile');
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <div className="text-center text-gray-500">Loading profile...</div>
      </div>
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!user) return setError('Please log in first');
    try {
      const skillArr = skills.split(',').map(s => s.trim()).filter(Boolean);
      await createProfile(user.id, skillArr, about, parseFloat(price) || null);
      setSaved(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save profile');
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10">
      <h2 className="text-3xl font-bold mb-6">Your Profile</h2>
      {!user && (
        <p className="text-gray-500">
          <a href="/login" className="text-brand underline">Sign in</a> to create your profile.
        </p>
      )}
      {user && (
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="text-gray-400 text-sm">Signed in as</label>
            <p className="font-semibold">{user.name || user.email}</p>
          </div>
          <input
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
            placeholder="Skills (comma separated, e.g. Python, ML, NLP)"
            value={skills}
            onChange={e => setSkills(e.target.value)}
          />
          <textarea
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none h-28 resize-none"
            placeholder="About you — what do you bring to a collaboration?"
            value={about}
            onChange={e => setAbout(e.target.value)}
          />
          <input
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
            placeholder="Hourly rate ($)"
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
          <button className="bg-brand py-3 rounded-lg font-semibold hover:bg-brand-dark transition">
            Save Profile
          </button>
          {saved && <p className="text-green-400 text-center">Profile saved!</p>}
          {error && <p className="text-red-400 text-center">{error}</p>}
        </form>
      )}
    </div>
  );
}
