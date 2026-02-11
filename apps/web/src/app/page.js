'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { getProfiles } from '../../lib/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import AgentCard from '../../components/AgentCard';

export default function HomePage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfiles = async () => {
      setLoading(true);
      try {
        const data = await getProfiles();
        setProfiles(data);
      } catch (error) {
        console.error('Failed to load profiles', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfiles();
  }, []);

  if (loading) return <LoadingSpinner text="Loading agents..." />;

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4">
      <h1 className="text-4xl font-bold mb-4">Find Your Perfect Agent</h1>
      <p className="text-gray-400 mb-8">Swipe through profiles to find the best match for your needs.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map(profile => (
          <AgentCard key={profile.id} profile={profile} />
        ))}
      </div>
    </div>
  );
}
