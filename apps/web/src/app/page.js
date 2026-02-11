'use client';
import { useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';

export default function HomePage() {
  const { user } = useAuth();

  useEffect(() => {
    // Any side effects can be handled here
  }, [user]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-4">Find Your Perfect Agent</h1>
      <p className="text-lg mb-8">Connect with top professionals that match your needs.</p>
      <a href="/swipe" className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition font-semibold">Get Started</a>
    </div>
  );
}
