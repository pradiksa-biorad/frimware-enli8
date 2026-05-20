import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Reset password</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send a reset link.</p>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
            If that email exists, a reset link has been sent. Check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-brand-600 hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
