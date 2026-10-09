import React, { useState, useRef } from 'react';
import { X, Plus, Link, Upload } from 'lucide-react';

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
}

/**
 * IMAGE UPLOAD NOTE:
 * For free cloud storage, we recommend Cloudinary (cloudinary.com)
 * 1. Sign up free at cloudinary.com
 * 2. Get your Cloud Name, Upload Preset (unsigned) from Settings > Upload
 * 3. Put REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET in .env
 */
const CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

const ImageUploader: React.FC<ImageUploaderProps> = ({ images, onChange }) => {
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) { setError('Please enter a valid URL starting with http'); return; }
    if (images.includes(url)) { setError('This URL is already added'); return; }
    onChange([...images, url]);
    setUrlInput('');
    setError('');
  };

  const uploadFile = async (file: File) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError('Cloudinary not configured. Please set REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET in .env');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST', body: form,
      });
      const data = await res.json();
      if (data.secure_url) {
        onChange([...images, data.secure_url]);
      } else {
        setError('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch {
      setError('Upload failed. Check your Cloudinary settings.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    e.target.value = '';
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {/* URL + File input row */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Paste image URL or upload file →"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange/50 outline-none dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <button type="button" onClick={addUrl}
          className="px-3 py-2 bg-orange text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add URL
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50">
          <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {!CLOUD_NAME && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
          💡 <strong>File upload requires Cloudinary (free):</strong> Sign up at cloudinary.com → get Cloud Name + Upload Preset → add to .env as REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET
        </p>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group">
              <img src={url} alt={`img-${idx}`} className="w-full h-full object-cover" onError={e => (e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f3f4f6"/%3E%3Ctext x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="30"%3E🖼%3C/text%3E%3C/svg%3E')} />
              <button type="button" onClick={() => remove(idx)}
                className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
              {idx === 0 && <span className="absolute bottom-0 left-0 right-0 text-center text-[10px] bg-orange text-white font-bold">Cover</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
