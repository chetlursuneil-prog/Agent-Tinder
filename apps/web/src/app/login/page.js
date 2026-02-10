'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signup, login as apiLogin } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  const { loginUser, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <p className="text-green-400 text-lg mb-4">Signed in as {user.name || user.email}</p>
        <a href="/swipe" className="px-8 py-3 bg-brand rounded-full font-semibold hover:bg-brand-dark transition inline-block">Start Swiping</a>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const u = await signup(email, name);
        loginUser(u);
        router.push('/swipe');
      } else {
        const res = await apiLogin(email);
        loginUser(res.user, res.token);
        router.push('/swipe');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <h2 className="text-3xl font-bold mb-6 text-center">
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'signup' && (
          <input
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        )}
        <input
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
          placeholder="Email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button disabled={loading} className="bg-brand py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50">
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>
      <p className="text-center text-gray-500 mt-4 text-sm">
        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
        <button className="text-brand underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Sign Up' : 'Sign In'}
        </button>
      </p>
      {error && <p className="text-red-400 text-center mt-4">{error}</p>}
    </div>
  );
}
