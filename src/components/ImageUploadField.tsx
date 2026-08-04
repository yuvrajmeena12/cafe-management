import { useRef, useState } from 'react'
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react'
import { uploadImage } from '../lib/upload'

interface Props {
  label: string
  value: string
  onChange: (url: string) => void
  folder: string // e.g. 'menu-items' or 'cafe-settings' — keeps uploads organized in Storage
}

export default function ImageUploadField({ label, value, onChange, folder }: Props) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WEBP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const url = await uploadImage(file, folder)
      onChange(url)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed. Check your Storage bucket setup.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="text-sm font-medium text-sage-700 block mb-1">{label}</label>

      {value && (
        <img src={value} alt="Preview" className="w-full h-36 object-cover rounded-lg mb-2 border border-sage-100" />
      )}

      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg font-medium ${mode === 'upload' ? 'bg-saffron-500 text-white' : 'bg-sage-50 text-sage-600'}`}
        >
          <Upload size={14} /> Upload Photo
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg font-medium ${mode === 'url' ? 'bg-saffron-500 text-white' : 'bg-sage-50 text-sage-600'}`}
        >
          <LinkIcon size={14} /> Paste URL Instead
        </button>
      </div>

      {mode === 'upload' ? (
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-sage-200 rounded-lg py-4 text-sm text-sage-500 hover:border-saffron-400 hover:text-saffron-600 flex items-center justify-center gap-2"
          >
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : 'Click to choose a photo from your computer'}
          </button>
        </div>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="w-full px-4 py-2 rounded-lg border border-sage-100"
        />
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
