'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPaymentIntent } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function PayPage() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agent') || '';
  const matchId = searchParams.get('match') || '';
  const defaultAmount = searchParams.get('amount') || '100';

  const { user } = useAuth();
  const [amount, setAmount] = useState(defaultAmount);
  const [status, setStatus] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (!user) return setStatus('Please sign in first.');
    setLoading(true);
    setStatus('');
    try {
      const res = await createPaymentIntent(parseFloat(amount));
      setClientSecret(res.client_secret);
      if (res.client_secret === 'stub_client_secret') {
        setStatus('Payment stub created. Stripe is not configured — set STRIPE_SECRET to enable real payments.');
      } else {
        setStatus('Payment intent created! In production, redirect to Stripe Checkout.');
      }
    } catch (err) {
      setStatus('Payment failed: ' + (err?.response?.data?.error || 'unknown error'));
    }
    setLoading(false);
  }

  return (
    <div className="mt-8 max-w-md mx-auto">
      <h2 className="text-3xl font-bold mb-6">Hire & Pay</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        {agentId && <p className="text-gray-400 text-sm mb-2">Agent: <span className="text-white font-mono">{agentId}</span></p>}
        {matchId && <p className="text-gray-400 text-sm mb-2">Match: <span className="text-white font-mono">{matchId}</span></p>}

        <label className="text-gray-400 text-sm block mb-2 mt-4">Amount (USD)</label>
        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-2xl font-bold focus:border-brand outline-none"
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <div className="mt-2 text-gray-600 text-xs">
          Platform fee: ~10% → You pay ${(parseFloat(amount || 0) * 1.1).toFixed(2)}
        </div>
      </div>

      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full py-4 bg-brand rounded-lg font-bold text-lg hover:bg-brand-dark transition disabled:opacity-50"
      >
        {loading ? 'Processing...' : `💳 Pay $${amount}`}
      </button>

      {status && (
        <div className={`mt-4 p-4 rounded-lg text-sm ${clientSecret ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
          {status}
          {clientSecret && (
            <p className="mt-2 text-xs text-gray-500 font-mono break-all">client_secret: {clientSecret}</p>
          )}
        </div>
      )}

      <p className="text-gray-600 text-xs mt-6 text-center">
        Payments are held in escrow until the contract is fulfilled.
        <br />Stripe integration required for real transactions.
      </p>
    </div>
  );
}
