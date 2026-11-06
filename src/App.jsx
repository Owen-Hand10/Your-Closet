import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp, Check, ChevronDown, CircleHelp, Heart, ImagePlus, LayoutGrid,
  Plus, Search, Shirt, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { loadItems, loadLooks, saveItems, saveLooks } from './data/store.js';

const CATEGORIES = ['Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Accessory'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter', 'All season'];
const OCCASIONS = ['Everyday', 'Work', 'Evening', 'Weekend', 'Occasion'];
const HERO_IMAGE = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85';

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function imageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1500 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.84));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This image could not be opened. Try a different photo.'));
    };
    image.src = objectUrl;
  });
}

function cropImage(source, zoom, focusX, focusY) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const aspect = 4 / 5;
      let cropWidth = image.naturalWidth;
      let cropHeight = image.naturalHeight;
      if (cropWidth / cropHeight > aspect) cropWidth = cropHeight * aspect;
      else cropHeight = cropWidth / aspect;
      cropWidth /= zoom;
      cropHeight /= zoom;
      const left = (image.naturalWidth - cropWidth) * focusX;
      const top = (image.naturalHeight - cropHeight) * focusY;
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1000;
      canvas.getContext('2d').drawImage(image, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.onerror = () => reject(new Error('The crop preview could not be created.'));
    image.src = source;
  });
}

function initialForm(item) {
  return {
    name: item?.name ?? '',
    category: item?.category ?? 'Top',
    color: item?.color ?? '',
    season: item?.season ?? 'All season',
    occasion: item?.occasion ?? 'Everyday',
    notes: item?.notes ?? '',
    originalImage: item?.originalImage ?? '',
    image: item?.image ?? '',
  };
}

function App() {
  const [items, setItems] = useState(loadItems);
  const [looks, setLooks] = useState(loadLooks);
  const [view, setView] = useState('closet');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All pieces');
  const [seasonFilter, setSeasonFilter] = useState('Any season');
  const [sortNewest, setSortNewest] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(initialForm(null));
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveName, setSaveName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [storageError, setStorageError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.5);
  const fileInput = useRef(null);

  useEffect(() => {
    try { saveItems(items); setStorageError(''); }
    catch { setStorageError('Browser storage is full. Remove a few large photos or use smaller images to keep saving.'); }
  }, [items]);

  useEffect(() => {
    try { saveLooks(looks); setStorageError(''); }
    catch { setStorageError('Browser storage is full. Remove a few large photos or use smaller images to keep saving.'); }
  }, [looks]);

  useEffect(() => {
    if (!modalOpen && !deleteTarget) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setModalOpen(false); setDeleteTarget(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, deleteTarget]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...items]
      .filter((item) => categoryFilter === 'All pieces' || item.category === categoryFilter)
      .filter((item) => seasonFilter === 'Any season' || item.season === seasonFilter)
      .filter((item) => !query || [item.name, item.category, item.color, item.season, item.occasion, item.notes].join(' ').toLowerCase().includes(query))
      .sort((a, b) => sortNewest ? b.createdAt - a.createdAt : a.name.localeCompare(b.name));
  }, [items, search, categoryFilter, seasonFilter, sortNewest]);

  const selectedItems = selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean);

  function openNewItem() {
    setEditingItem(null);
    setForm(initialForm(null));
    setPhotoError('');
    setZoom(1); setFocusX(0.5); setFocusY(0.5);
    setModalOpen(true);
  }

  function openEditItem(item) {
    setEditingItem(item);
    setForm(initialForm(item));
    setPhotoError('');
    setZoom(1); setFocusX(0.5); setFocusY(0.5);
    setModalOpen(true);
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Choose an image file to continue.'); return; }
    if (file.size > 15 * 1024 * 1024) { setPhotoError('This photo is larger than 15 MB. Choose a smaller image.'); return; }
    setProcessing(true); setPhotoError('');
    try {
      const image = await imageToDataUrl(file);
      setForm((current) => ({ ...current, originalImage: image, image }));
      setZoom(1); setFocusX(0.5); setFocusY(0.5);
    } catch (error) { setPhotoError(error.message); }
    finally { setProcessing(false); }
  }

  async function applyCrop() {
    if (!form.originalImage) return;
    setProcessing(true); setPhotoError('');
    try {
      const image = await cropImage(form.originalImage, zoom, focusX, focusY);
      setForm((current) => ({ ...current, image }));
    } catch (error) { setPhotoError(error.message); }
    finally { setProcessing(false); }
  }

  function saveItem(event) {
    event.preventDefault();
    if (!form.originalImage) { setPhotoError('Add a photo of your clothing item first.'); return; }
    const item = {
      ...form,
      id: editingItem?.id ?? makeId(),
      name: form.name.trim() || `${form.color || 'Untitled'} ${form.category.toLowerCase()}`,
      color: form.color.trim(),
      notes: form.notes.trim(),
      createdAt: editingItem?.createdAt ?? Date.now(),
    };
    setItems((current) => editingItem ? current.map((entry) => entry.id === item.id ? item : entry) : [item, ...current]);
    setModalOpen(false);
  }

  function deleteItem() {
    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function toggleSelection(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }

  function saveLook(event) {
    event.preventDefault();
    if (!selectedItems.length) return;
    setLooks((current) => [{
      id: makeId(),
      name: saveName.trim() || `Look ${current.length + 1}`,
      notes: saveNotes.trim(),
      itemIds: selectedItems.map((item) => item.id),
      createdAt: Date.now(),
    }, ...current]);
    setSaveName(''); setSaveNotes(''); setView('looks');
  }

  function deleteLook() {
    setLooks((current) => current.filter((look) => look.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function revisitLook(look) {
    setSelectedIds(look.itemIds.filter((id) => items.some((item) => item.id === id)));
    setView('builder');
  }

  const activeLabel = view === 'closet' ? 'Your wardrobe, at a glance.' : view === 'builder' ? 'A little outfit alchemy.' : 'The looks worth keeping.';

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="#closet" onClick={() => setView('closet')} aria-label="Your Closet home">
          <span className="wordmark-icon"><Shirt size={19} strokeWidth={1.6} /></span>
          <span>your closet<span className="wordmark-period">.</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'closet' ? 'nav-link active' : 'nav-link'} onClick={() => setView('closet')}>The closet <span>{items.length}</span></button>
          <button className={view === 'builder' ? 'nav-link active' : 'nav-link'} onClick={() => setView('builder')}>Outfit builder</button>
          <button className={view === 'looks' ? 'nav-link active' : 'nav-link'} onClick={() => setView('looks')}>Saved looks <span>{looks.length}</span></button>
        </nav>
        <button className="header-add" onClick={openNewItem}><Plus size={16} /> Add a piece</button>
      </header>

      <main>
        <section className="page-intro">
          <div>
            <p className="eyebrow">A more considered wardrobe</p>
            <h1>{activeLabel}</h1>
          </div>
          <p className="intro-note">Get to know what you own. Find new ways to wear it.</p>
        </section>

        {storageError && <p className="storage-alert" role="alert">{storageError}</p>}

        {view === 'closet' && (
          <section aria-label="Virtual closet">
            {items.length === 0 ? (
              <div className="empty-closet">
                <div className="empty-copy">
                  <p className="eyebrow">A good place to begin</p>
                  <h2>Make room for<br />what you already love.</h2>
                  <p>Photograph a favorite piece, add a few details, and start seeing your wardrobe in a new light.</p>
                  <button className="button button-dark" onClick={openNewItem}><Plus size={17} /> Add your first piece</button>
                  <span className="local-note"><CircleHelp size={14} /> Your photos stay in this browser.</span>
                </div>
                <div className="empty-image-wrap">
                  <img src={HERO_IMAGE} alt="A curated arrangement of clothing in soft natural colors" />
                  <span className="image-caption">A wardrobe, made your own</span>
                </div>
              </div>
            ) : (
              <>
                <div className="closet-toolbar">
                  <div className="piece-count"><strong>{items.length}</strong> {items.length === 1 ? 'piece' : 'pieces'} <span>in your closet</span></div>
                  <div className="filters">
                    <label className="search-box"><Search size={16} /><span className="sr-only">Search your closet</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pieces" /></label>
                    <label className="select-wrap"><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All pieces</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={14} /></label>
                    <label className="select-wrap season-filter"><span className="sr-only">Filter by season</span><select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)}><option>Any season</option>{SEASONS.map((season) => <option key={season}>{season}</option>)}</select><ChevronDown size={14} /></label>
                    <button className="icon-button sort-button" onClick={() => setSortNewest((current) => !current)} aria-label={`Sort by ${sortNewest ? 'name' : 'newest first'}`} title={`Sort by ${sortNewest ? 'name' : 'newest first'}`}><ArrowDownUp size={16} /></button>
                    <button className="button button-outline add-toolbar" onClick={openNewItem}><Plus size={16} /> Add piece</button>
                  </div>
                </div>
                {visibleItems.length ? (
                  <div className="closet-grid">
                    {visibleItems.map((item) => (
                      <article className="item-card" key={item.id}>
                        <div className="item-photo"><img src={item.image} alt={item.name} /><span className="category-chip">{item.category}</span></div>
                        <div className="item-info">
                          <div className="item-title"><h3>{item.name}</h3><button className="icon-button more-button" onClick={() => openEditItem(item)} aria-label={`Edit ${item.name}`} title="Edit piece"><span aria-hidden="true">···</span></button></div>
                          <p>{[item.color, item.season, item.occasion].filter(Boolean).join(' · ')}</p>
                          {item.notes && <p className="item-notes">{item.notes}</p>}
                          <button className="text-action" onClick={() => { setDeleteTarget({ id: item.id, name: item.name, type: 'item' }); }}>Remove piece</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <div className="no-results"><Search size={21} /><p>No pieces match those filters.</p><button className="text-action" onClick={() => { setSearch(''); setCategoryFilter('All pieces'); setSeasonFilter('Any season'); }}>Clear filters</button></div>}
              </>
            )}
          </section>
        )}

        {view === 'builder' && (
          <section className="builder-layout" aria-label="Outfit builder">
            <div className="builder-main">
              <div className="section-heading"><div><p className="eyebrow">Choose your pieces</p><h2>Build a look</h2></div><span className="selection-count">{selectedItems.length} selected</span></div>
              {items.length ? <div className="picker-grid">{items.map((item) => {
                const selected = selectedIds.includes(item.id);
                return <button key={item.id} className={`picker-item${selected ? ' selected' : ''}`} onClick={() => toggleSelection(item.id)} aria-pressed={selected}>
                  <span className="picker-image"><img src={item.image} alt="" />{selected && <span className="picked-check"><Check size={15} /></span>}</span>
                  <span className="picker-name">{item.name}</span><span className="picker-meta">{item.category} · {item.color || item.season}</span>
                </button>;
              })}</div> : <div className="builder-empty"><ImagePlus size={30} /><h3>Your closet is waiting</h3><p>Add a piece or two before building your first outfit.</p><button className="button button-dark" onClick={openNewItem}><Plus size={16} /> Add a piece</button></div>}
            </div>
            <aside className="outfit-panel">
              <div className="outfit-panel-top"><span className="eyebrow">On the outfit</span><span className="hanger-icon"><LayoutGrid size={18} /></span></div>
              <h2>Today's edit</h2>
              {selectedItems.length ? <div className="outfit-preview">{selectedItems.map((item) => <div className="outfit-piece" key={item.id}><img src={item.image} alt={item.name} /><div><strong>{item.name}</strong><span>{item.category}</span></div><button className="icon-button" onClick={() => toggleSelection(item.id)} aria-label={`Remove ${item.name} from outfit`}><X size={15} /></button></div>)}</div> : <div className="outfit-placeholder"><Shirt size={28} strokeWidth={1.3} /><p>Your pieces will find their place here.</p></div>}
              <form className="save-look-form" onSubmit={saveLook}>
                <label>Look name <input value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="e.g. Sunday in the city" maxLength={70} /></label>
                <label>Notes <textarea value={saveNotes} onChange={(event) => setSaveNotes(event.target.value)} placeholder="A thought, a mood, the occasion…" rows={2} maxLength={240} /></label>
                <button className="button button-dark save-look-button" type="submit" disabled={!selectedItems.length}><Heart size={16} /> Save this look</button>
              </form>
              <p className="sample-note"><Sparkles size={14} /> Your selections stay yours. No pieces are added for you.</p>
            </aside>
          </section>
        )}

        {view === 'looks' && (
          <section className="looks-section" aria-label="Saved outfits">
            <div className="section-heading"><div><p className="eyebrow">Your personal lookbook</p><h2>Saved looks</h2></div><span className="selection-count">{looks.length} {looks.length === 1 ? 'look' : 'looks'}</span></div>
            {looks.length ? <div className="looks-grid">{looks.map((look) => {
              const lookItems = look.itemIds.map((id) => items.find((item) => item.id === id)).filter(Boolean);
              return <article className="look-card" key={look.id}>
                <div className="look-images">{lookItems.slice(0, 3).map((item) => <img src={item.image} alt={item.name} key={item.id} />)}{!lookItems.length && <div className="look-empty"><Shirt size={25} /></div>}</div>
                <div className="look-details"><div><p className="eyebrow">{new Date(look.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p><h3>{look.name}</h3></div><span>{lookItems.length} {lookItems.length === 1 ? 'piece' : 'pieces'}</span></div>
                {look.notes && <p className="look-notes">{look.notes}</p>}
                <div className="look-actions"><button className="text-action" onClick={() => revisitLook(look)}>Open in builder</button><button className="icon-button" onClick={() => setDeleteTarget({ id: look.id, name: look.name, type: 'look' })} aria-label={`Delete ${look.name}`} title="Delete look"><Trash2 size={16} /></button></div>
              </article>;
            })}</div> : <div className="looks-empty"><div className="empty-heart"><Heart size={25} /></div><h3>Your lookbook starts here.</h3><p>Choose a few pieces in the outfit builder and save a look to come back to it later.</p><button className="button button-dark" onClick={() => setView('builder')}>Start an outfit <ChevronDown size={15} className="turn-icon" /></button></div>}
          </section>
        )}
      </main>

      <footer className="site-footer"><span>YOUR CLOSET, YOURS ALONE.</span><span>Made for wearing, not just collecting.</span><button onClick={() => setView('closet')}>Back to your closet <ChevronDown size={13} className="turn-icon" /></button></footer>

      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
          <header className="modal-header"><div><p className="eyebrow">A piece of your story</p><h2 id="item-modal-title">{editingItem ? 'Edit this piece' : 'Add to your closet'}</h2></div><button className="icon-button close-button" onClick={() => setModalOpen(false)} aria-label="Close"><X size={19} /></button></header>
          <form onSubmit={saveItem}>
            <div className="modal-content">
              <div className="photo-column">
                <div className="upload-zone">
                  {form.originalImage ? <div className="photo-compare"><figure><img src={form.originalImage} alt="Original clothing photo" /><figcaption>Original</figcaption></figure><figure><img src={form.image || form.originalImage} alt="Clothing photo preview" /><figcaption>Closet preview</figcaption></figure></div> : <button type="button" className="upload-prompt" onClick={() => fileInput.current?.click()}><Upload size={23} /><strong>{processing ? 'Preparing photo…' : 'Choose a photo'}</strong><span>JPG, PNG or WebP · up to 15 MB</span></button>}
                  <input ref={fileInput} className="sr-only" type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
                  {form.originalImage && <button className="text-action replace-photo" type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={15} /> Replace photo</button>}
                </div>
                {form.originalImage && <div className="crop-controls">
                  <div className="crop-heading"><div><p className="eyebrow">Image cleanup</p><h3>Find your frame</h3></div><span className="prototype-tag">Crop prototype</span></div>
                  <p className="prototype-copy">Adjust the crop to give your piece a little breathing room. Background removal is not connected; your original stays untouched.</p>
                  <label className="range-label">Zoom <input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><span>{zoom.toFixed(1)}x</span></label>
                  <label className="range-label">Horizontal <input type="range" min="0" max="1" step="0.01" value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} /><span>{Math.round(focusX * 100)}%</span></label>
                  <label className="range-label">Vertical <input type="range" min="0" max="1" step="0.01" value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} /><span>{Math.round(focusY * 100)}%</span></label>
                  <button className="button button-outline crop-apply" type="button" onClick={applyCrop} disabled={processing}><Check size={15} /> {processing ? 'Working…' : 'Apply crop'}</button>
                </div>}
                {photoError && <p className="form-error" role="alert">{photoError}</p>}
              </div>
              <div className="details-column">
                <label>Piece name <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. The blue linen shirt" maxLength={70} /></label>
                <div className="form-row"><label>Type <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Color <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} placeholder="e.g. Soft blue" maxLength={35} /></label></div>
                <div className="form-row"><label>Season <select value={form.season} onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))}>{SEASONS.map((season) => <option key={season}>{season}</option>)}</select></label><label>Occasion <select value={form.occasion} onChange={(event) => setForm((current) => ({ ...current, occasion: event.target.value }))}>{OCCASIONS.map((occasion) => <option key={occasion}>{occasion}</option>)}</select></label></div>
                <label>Notes <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Fabric, fit, a detail you love…" rows={4} maxLength={240} /></label>
                <p className="form-footnote">A photo is needed. Every other detail can be changed later.</p>
              </div>
            </div>
            <div className="modal-footer"><button type="button" className="button button-quiet" onClick={() => setModalOpen(false)}>Cancel</button><button className="button button-dark" type="submit" disabled={processing}><Check size={16} /> {editingItem ? 'Save changes' : 'Add to closet'}</button></div>
          </form>
        </section>
      </div>}

      {deleteTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
        <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy">
          <div className="confirm-icon"><Trash2 size={20} /></div><h2 id="delete-title">Remove {deleteTarget.type === 'look' ? 'this look' : 'this piece'}?</h2><p id="delete-copy"><strong>{deleteTarget.name}</strong> will be removed from {deleteTarget.type === 'look' ? 'your saved looks' : 'your closet'}. This cannot be undone.</p>
          <div className="confirm-actions"><button className="button button-quiet" onClick={() => setDeleteTarget(null)}>Keep it</button><button className="button button-danger" onClick={deleteTarget.type === 'look' ? deleteLook : deleteItem}>Remove</button></div>
        </section>
      </div>}
    </div>
  );
}

export default App;