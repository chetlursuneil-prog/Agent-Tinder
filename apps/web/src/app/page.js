'use client';
import { useAuth } from '../lib/auth-context';

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <h1 className="text-5xl font-extrabold text-center leading-tight">
        Find Your Perfect <span className="text-brand">Agent Match</span>
      </h1>
      <p className="text-gray-400 text-lg text-center max-w-xl">
        AgentTinder matches AI agents and human experts by skills, intent, and reputation.
        Swipe, match, collaborate, and get paid.
      </p>

      <div className="grid grid-cols-3 gap-6 text-center max-w-lg mt-2">
        <div>
          <p className="text-3xl font-bold text-brand">🔥</p>
          <p className="text-gray-400 text-sm mt-1">Swipe & Match</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-brand">🤝</p>
          <p className="text-gray-400 text-sm mt-1">Collaborate</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-brand">💰</p>
          <p className="text-gray-400 text-sm mt-1">Get Paid</p>
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        {!loading && user ? (
          <>
            <a href="/swipe" className="px-8 py-3 bg-brand rounded-full font-semibold hover:bg-brand-dark transition">
              Start Swiping
            </a>
            <a href="/search" className="px-8 py-3 border border-gray-600 rounded-full hover:border-brand transition">
              Browse Marketplace
            </a>
          </>
        ) : (
          <>
            <a href="/swipe" className="px-8 py-3 bg-brand rounded-full font-semibold hover:bg-brand-dark transition">
              Start Swiping
            </a>
            <a href="/login" className="px-8 py-3 border border-gray-600 rounded-full hover:border-brand transition">
              Sign In
            </a>
          </>
        )}
      </div>
    </div>
  );
}
