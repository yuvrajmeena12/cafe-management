import { useEffect, useState } from 'react'
import { Plus, Trash2, Images } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ImageUploadField from '../../components/ImageUploadField'
import type { GalleryPhoto } from '../../types'

export default function Gallery() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [adding, setAdding] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newCaption, setNewCaption] = useState('')

  async function load() {
    const { data } = await supabase.from('gallery_photos').select('*').order('sort_order')
    setPhotos((data as GalleryPhoto[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function addPhoto() {
    if (!newUrl) return
    await supabase.from('gallery_photos').insert({ image_url: newUrl, caption: newCaption, sort_order: photos.length })
    setNewUrl('')
    setNewCaption('')
    setAdding(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this photo from the About page?')) return
    await supabase.from('gallery_photos').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-700 flex items-center gap-2"><Images size={28} className="text-saffron-500" /> Gallery</h1>
          <p className="text-sage-500">Photos shown on your About page — they auto-arrange into a grid no matter how many you add.</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Photo</button>
      </div>

      {photos.length === 0 ? (
        <p className="text-sage-400 text-center py-16">No photos yet — add your first one above.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-lg overflow-hidden group">
              <img src={p.image_url} className="w-full h-40 object-cover" />
              {p.caption && <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs px-2 py-1">{p.caption}</div>}
              <button onClick={() => remove(p.id)} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-bold text-xl text-sage-700">Add Photo</h2>
            <ImageUploadField label="Photo" value={newUrl} onChange={setNewUrl} folder="gallery" />
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Caption (optional)</label>
              <input value={newCaption} onChange={(e) => setNewCaption(e.target.value)} placeholder="e.g. Our cozy seating area" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setAdding(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addPhoto} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
