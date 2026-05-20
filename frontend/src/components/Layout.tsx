import { Outlet, Link, useNavigate, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';

interface Product { id: number; name: string; slug: string }

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    api.get('/products').then(r => setProducts(r.data)).catch(() => {});
  }, []);

  async function handleLogout() {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-brand-700">Firmware Hub</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Products</p>
          {products.map(p => (
            <NavLink
              key={p.id}
              to={`/products/${p.id}/releases`}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {p.name}
            </NavLink>
          ))}

          {user?.role === 'ADMIN' && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-2">Admin</p>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                User Management
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                Products
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-700 font-medium truncate">{user?.name || user?.email}</p>
          <p className="text-xs text-gray-400 capitalize mb-2">{user?.role?.toLowerCase()}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-600 hover:text-red-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
