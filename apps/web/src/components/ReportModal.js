'use client';
import { useState } from 'react';
import { createReport } from '../lib/api';

export default function ReportModal({ reporterUserId, reportedUserId, reportedName, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = [
    'Spam / Fake profile',
    'Inappropriate content',
    'Harassment',
    'Misleading information',
    'Other',
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason) return alert('Please select a reason');
    setSubmitting(true);
    try {
      await createReport({ reporterUserId, reportedUserId, reason, details });
      setSubmitted(true);
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
        {submitted ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-semibold text-lg mb-2">Report Submitted</p>
            <p className="text-gray-400 text-sm mb-4">We&apos;ll review this report and take appropriate action.</p>
            <button onClick={onClose} className="px-6 py-2 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">🚩 Report {reportedName || 'User'}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Reason</label>
                <div className="space-y-2">
                  {reasons.map(r => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="accent-brand"
                      />
                      <span className="text-sm">{r}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">Details (optional)</label>
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-brand focus:outline-none"
                  placeholder="Provide additional context..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || !reason}
                  className="px-6 py-2 bg-red-500 rounded-lg font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-600 rounded-lg hover:border-brand transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
