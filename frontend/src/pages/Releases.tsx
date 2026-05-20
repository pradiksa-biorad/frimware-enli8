import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import UploadModal from '../components/UploadModal';

interface Release {
  id: number;
  version: string;
  releaseNotes: string;
  fileName: string;
  fileSize: string;
  createdAt: string;
  uploadedBy: { name: string; email: string };
}

const ENVS = ['dev', 'qa', 'production'] as const;
type Env = typeof ENVS[number];

export default function Releases() {
  const { productId } = useParams<{ productId: string }>();
  const [env, setEnv] = useState<Env>('production');
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const user = useAuthStore(s => s.user);

  async function fetchReleases() {
    setLoading(true);
    try {
      const { data } = await api.get(`/products/${productId}/environments/${env}/releases`);
      setReleases(data);
    } catch {
      toast.error('Failed to load releases');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReleases(); }, [productId, env]);

  async function handleDownload(releaseId: number | 'latest') {
    try {
      const path = releaseId === 'latest'
        ? `/products/${productId}/environments/${env}/releases/latest/download`
        : `/products/${productId}/environments/${env}/releases/${releaseId}/download`;
      const { data } = await api.get(path);
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.fileName;
      a.click();
    } catch {
      toast.error('Failed to get download link');
    }
  }

  function formatBytes(bytes: string) {
    const n = parseInt(bytes, 10);
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
    return `${(n / 1e3).toFixed(0)} KB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Releases</h2>
        <div className="flex items-center gap-3">
          {releases.length > 0 && (
            <button onClick={() => handleDownload('latest')}
              className="border border-brand-600 text-brand-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-50 transition-colors">
              ⬇ Download Latest
            </button>
          )}
          {user?.role === 'ADMIN' && (
            <button onClick={() => setShowUpload(true)}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
              ↑ Upload Build
            </button>
          )}
        </div>
      </div>

      {/* Environment tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {ENVS.map(e => (
          <button key={e} onClick={() => setEnv(e)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              env === e ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {e}
          </button>
        ))}
      </div>

      {/* Release list */}
      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : releases.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No releases in {env} yet.
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map((r, i) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{r.version}</span>
                    {i === 0 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Latest</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {r.fileName} · {formatBytes(r.fileSize)} · Uploaded by {r.uploadedBy.name || r.uploadedBy.email} · {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => handleDownload(r.id)}
                  className="text-sm text-brand-600 hover:underline ml-4 flex-shrink-0">
                  Download
                </button>
              </div>

              {r.releaseNotes && (
                <div className="mt-3">
                  <button onClick={() => setExpandedNotes(expandedNotes === r.id ? null : r.id)}
                    className="text-xs text-gray-500 hover:text-gray-700">
                    {expandedNotes === r.id ? '▲ Hide' : '▼ Release notes'}
                  </button>
                  {expandedNotes === r.id && (
                    <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans">
                      {r.releaseNotes}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showUpload && productId && (
        <UploadModal
          productId={Number(productId)}
          env={env}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); fetchReleases(); }}
        />
      )}
    </div>
  );
}
