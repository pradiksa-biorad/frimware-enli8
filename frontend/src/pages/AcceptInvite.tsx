import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) { setInvalid(true); return; }
    api.get(`/auth/invite/${token}`)
      .then(r => setEmail(r.data.email))
      .catch(() => setInvalid(true));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await api.post('/auth/invite/accept', { token, name, password });
      toast.success('Account activated! Please sign in.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to activate account');
    } finally {
      setLoading(false);
    }
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">This invite link is invalid or has expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Accept your invite</h2>
        {email && <p className="text-sm text-gray-500 mb-6">Activating account for <strong>{email}</strong></p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors">
            {loading ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  );
}
