import { useEffect, useState, FormEvent } from 'react';
import api from '../api/client';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface User { id: number; email: string; name: string; role: 'ADMIN' | 'VIEWER'; status: string; createdAt: string }

export default function Users() {
  const currentUser = useAuthStore(s => s.user);
  if (currentUser?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  const [users, setUsers] = useState<User[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'VIEWER'>('VIEWER');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      await api.post('/users/invite', { email: inviteEmail, role: inviteRole });
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(id: number, email: string) {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success('User deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Delete failed');
    }
  }

  async function handleRoleChange(id: number, role: 'ADMIN' | 'VIEWER') {
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      toast.success('Role updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Update failed');
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>

      {/* Invite form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Invite User</h3>
        <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
          <input type="email" required placeholder="user@example.com" value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button type="submit" disabled={inviting}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors">
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name / Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{u.name || '—'}</p>
                  <p className="text-gray-400 text-xs">{u.email}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {u.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.id === currentUser?.id ? (
                    <span className="text-xs text-gray-400">{u.role.toLowerCase()} (you)</span>
                  ) : (
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value as any)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs">
                      <option value="VIEWER">Viewer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-right">
                  {u.id !== currentUser?.id && (
                    <button onClick={() => handleDelete(u.id, u.email)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No users yet.</p>
        )}
      </div>
    </div>
  );
}
