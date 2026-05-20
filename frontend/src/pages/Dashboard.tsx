import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

interface Product { id: number; name: string; slug: string; environments: { name: string }[] }

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data)).catch(() => {});
  }, []);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/products', { name: newName, slug: newSlug });
      setProducts(prev => [data, ...prev]);
      setNewName(''); setNewSlug(''); setShowForm(false);
      toast.success(`Product "${data.name}" created`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Products</h2>
        {user?.role === 'ADMIN' && (
          <button onClick={() => setShowForm(s => !s)}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
            + New Product
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={createProduct} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4 max-w-md">
          <h3 className="font-semibold text-gray-900">Create Product</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input required value={newName} onChange={e => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (lowercase, hyphens only)</label>
            <input required value={newSlug} onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="e.g. enli8"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
              {loading ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <Link key={p.id} to={`/products/${p.id}/releases`}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-brand-500 hover:shadow-sm transition-all">
            <h3 className="font-semibold text-gray-900 mb-1">{p.name}</h3>
            <p className="text-xs text-gray-400 font-mono mb-3">{p.slug}</p>
            <div className="flex gap-2">
              {['dev', 'qa', 'production'].map(env => (
                <span key={env} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{env}</span>
              ))}
            </div>
          </Link>
        ))}
        {products.length === 0 && (
          <p className="text-gray-400 text-sm col-span-3">No products yet.{user?.role === 'ADMIN' ? ' Create one above.' : ''}</p>
        )}
      </div>
    </div>
  );
}
