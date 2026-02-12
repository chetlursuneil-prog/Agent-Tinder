'use client';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth-context';

export default function HomePage() {
  const { user } = useAuth();

  useEffect(() => {
    // Any side effects can be handled here
  }, []);

  return (
    <div className="max-w-2xl mx-auto text-center mt-20">
      <h1 className="text-4xl font-bold mb-4">Your Perfect Agent</h1>
      <p className="text-gray-500 mb-8">Find the best agents tailored to your needs.</p>
      {user ? (
        <p className="text-gray-400">Welcome back, {user.name}!</p>
      ) : (
        <p className="text-gray-400">Please sign in to get started.</p>
      )}
    </div>
  );
}
