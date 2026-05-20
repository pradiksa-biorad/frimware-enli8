import { useState, FormEvent } from 'react';
import api from '../api/client';
import axios from 'axios';
import toast from 'react-hot-toast';

interface Props {
  productId: number;
  env: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PART_SIZE = 100 * 1024 * 1024; // 100 MB

export default function UploadModal({ productId, env, onClose, onSuccess }: Props) {
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) { toast.error('Select a file'); return; }
    setUploading(true);
    setProgress(0);

    try {
      setStatus('Creating release record…');
      const { data } = await api.post(`/products/${productId}/environments/${env}/releases`, {
        version,
        releaseNotes,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || 'application/octet-stream',
      });

      if (data.uploadType === 'single') {
        setStatus('Uploading…');
        await axios.put(data.uploadUrl, file, {
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / (e.total ?? file.size))),
        });
        setStatus('Confirming…');
        await api.post(`/products/${productId}/environments/${env}/releases/${data.releaseId}/confirm`, {});
      } else {
        // Multipart upload
        const { releaseId, uploadId, parts } = data as {
          releaseId: number;
          uploadId: string;
          parts: { partNumber: number; url: string }[];
        };

        const completedParts: { ETag: string; PartNumber: number }[] = [];
        let uploadedBytes = 0;

        for (const part of parts) {
          const start = (part.partNumber - 1) * PART_SIZE;
          const end = Math.min(start + PART_SIZE, file.size);
          const chunk = file.slice(start, end);

          setStatus(`Uploading part ${part.partNumber} of ${parts.length}…`);
          const res = await axios.put(part.url, chunk, {
            headers: { 'Content-Type': 'application/octet-stream' },
            onUploadProgress: (e) => {
              const chunkLoaded = e.loaded;
              setProgress(Math.round(((uploadedBytes + chunkLoaded) * 100) / file.size));
            },
          });

          const etag = res.headers['etag'];
          if (!etag) throw new Error(`No ETag for part ${part.partNumber}`);
          completedParts.push({ ETag: etag, PartNumber: part.partNumber });
          uploadedBytes += (end - start);
        }

        setStatus('Completing upload…');
        await api.post(`/products/${productId}/environments/${env}/releases/${releaseId}/confirm`, {
          uploadId,
          parts: completedParts,
        });
      }

      setProgress(100);
      setStatus('Done!');
      toast.success(`Release ${version} uploaded successfully`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? err.message ?? 'Upload failed');
      setUploading(false);
      setStatus('');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Upload Build — <span className="capitalize">{env}</span></h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
            <input required value={version} onChange={e => setVersion(e.target.value)}
              placeholder="e.g. v1.2.0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Release Notes</label>
            <textarea required rows={4} value={releaseNotes} onChange={e => setReleaseNotes(e.target.value)}
              placeholder="What's changed in this release…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image File</label>
            <input type="file" required onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium hover:file:bg-brand-100" />
            {file && <p className="text-xs text-gray-400 mt-1">{file.name} ({(file.size / 1e6).toFixed(1)} MB)</p>}
          </div>

          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={uploading}
              className="flex-1 bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" onClick={onClose} disabled={uploading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
