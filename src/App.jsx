import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp, Check, ChevronDown, CircleHelp, Heart, ImagePlus, LayoutGrid,
  Plus, RotateCcw, Search, Shirt, Sparkles, Trash2, Upload, X,
} from 'lucide-react';
import { loadItems, loadLooks, saveItems, saveLooks } from './data/store.js';
import { removeImageBackground } from './services/backgroundRemoval.js';

const CATEGORIES = ['Top', 'Bottom', 'Dress', 'Outerwear', 'Shoes', 'Accessory'];
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter', 'All season'];
const OCCASIONS = ['Everyday', 'Work', 'Evening', 'Weekend', 'Occasion'];
const HERO_IMAGE = 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=90';

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
      const preservesTransparency = file.type === 'image/png' || file.type === 'image/webp';
      resolve(canvas.toDataURL(preservesTransparency ? 'image/webp' : 'image/jpeg', 0.84));
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
      const preservesTransparency = source.startsWith('data:image/png') || source.startsWith('data:image/webp');
      resolve(canvas.toDataURL(preservesTransparency ? 'image/webp' : 'image/jpeg', 0.88));
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
    backgroundRemovedImage: item?.backgroundRemoved ? item.image : '',
    backgroundRemoved: Boolean(item?.backgroundRemoved),
    crop: item?.crop ?? { zoom: 1, focusX: 0.5, focusY: 0.5 },
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The transparent image could not be saved in this browser.'));
    reader.readAsDataURL(blob);
  });
}

const outfitLayerOrder = { Bottom: 1, Shoes: 2, Top: 3, Dress: 4, Outerwear: 5, Accessory: 6 };

function LayeredOutfitPreview({ items, compact = false }) {
  const orderedItems = [...items].sort((a, b) => (outfitLayerOrder[a.category] ?? 3) - (outfitLayerOrder[b.category] ?? 3));
  return (
    <div className={`layered-look${compact ? ' layered-look-compact' : ''}`} role="img" aria-label={`Layered outfit preview with ${items.length} selected pieces`}>
      {orderedItems.length ? orderedItems.map((item, index) => (
        <div className={`layered-piece layered-piece-${(item.category || 'Top').toLowerCase()}`} key={item.id} style={{ '--piece-order': index }}>
          <img src={item.image} alt="" />
        </div>
      )) : <div className="look-empty"><Shirt size={25} /></div>}
      {items.length > 0 && <span className="layered-look-caption">2D LAYERED PREVIEW</span>}
    </div>
  );
}

function App() {
  const [items, setItems] = useState(loadItems);
  const [looks, setLooks] = useState(loadLooks);
  const [view, setView] = useState('home');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All pieces');
  const [seasonFilter, setSeasonFilter] = useState('Any season');
  const [sortNewest, setSortNewest] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewMode, setPreviewMode] = useState('pieces');
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(initialForm(null));
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveName, setSaveName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [storageError, setStorageError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [removalStatus, setRemovalStatus] = useState('idle');
  const [modelProgress, setModelProgress] = useState('');
  const [crop, setCrop] = useState({ zoom: 1, focusX: 0.5, focusY: 0.5 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const fileInput = useRef(null);
  const previewFrame = useRef(null);
  const itemDialog = useRef(null);
  const confirmDialog = useRef(null);
  const dialogReturnFocus = useRef(null);
  const cropSource = form.backgroundRemovedImage || form.originalImage;

  const cropPreviewStyle = useMemo(() => {
    if (!sourceSize.width || !sourceSize.height || !previewSize.width || !previewSize.height) return undefined;
    const scale = Math.max(previewSize.width / sourceSize.width, previewSize.height / sourceSize.height) * crop.zoom;
    const width = sourceSize.width * scale;
    const height = sourceSize.height * scale;
    return {
      width: `${width}px`,
      height: `${height}px`,
      left: `${(previewSize.width - width) * crop.focusX}px`,
      top: `${(previewSize.height - height) * crop.focusY}px`,
    };
  }, [sourceSize, previewSize, crop]);

  useEffect(() => {
    try { saveItems(items); setStorageError(''); }
    catch { setStorageError('Browser storage is full. Remove a few large photos or use smaller images to keep saving.'); }
  }, [items]);

  useEffect(() => {
    try { saveLooks(looks); setStorageError(''); }
    catch { setStorageError('Browser storage is full. Remove a few large photos or use smaller images to keep saving.'); }
  }, [looks]);

  useEffect(() => {
    const dialog = modalOpen ? itemDialog.current : deleteTarget ? confirmDialog.current : null;
    if (!dialog) {
      const returnTarget = dialogReturnFocus.current?.isConnected
        ? dialogReturnFocus.current
        : document.querySelector('.main-nav .active');
      returnTarget?.focus?.();
      dialogReturnFocus.current = null;
      return undefined;
    }
    const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled):not(.sr-only), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    focusable[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { setModalOpen(false); setDeleteTarget(null); }
      if (event.key === 'Tab' && focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, deleteTarget]);

  useEffect(() => {
    if (!modalOpen || !cropSource || !previewFrame.current) return undefined;
    const node = previewFrame.current;
    const updateSize = () => {
      const { width, height } = node.getBoundingClientRect();
      setPreviewSize((current) => current.width === width && current.height === height ? current : { width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [modalOpen, cropSource]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = window.setTimeout(() => setFeedback(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

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
    dialogReturnFocus.current = document.activeElement;
    setEditingItem(null);
    setForm(initialForm(null));
    setPhotoError('');
    setCrop({ zoom: 1, focusX: 0.5, focusY: 0.5 });
    setRemovalStatus('idle'); setModelProgress('');
    setModalOpen(true);
  }

  function openEditItem(item) {
    dialogReturnFocus.current = document.activeElement;
    setEditingItem(item);
    setForm(initialForm(item));
    setPhotoError('');
    setCrop(item.backgroundRemoved ? { zoom: 1, focusX: 0.5, focusY: 0.5 } : item.crop ?? { zoom: 1, focusX: 0.5, focusY: 0.5 });
    setRemovalStatus(item.backgroundRemoved ? 'success' : 'idle');
    setModelProgress(item.backgroundRemoved ? 'Saved transparent cutout. Original is unchanged.' : '');
    setModalOpen(true);
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Choose an image file to continue.'); return; }
    if (file.size > 15 * 1024 * 1024) { setPhotoError('This photo is larger than 15 MB. Choose a smaller image.'); return; }
    setProcessing(true); setPhotoError('');
    try {
      const image = await imageToDataUrl(file);
      setForm((current) => ({ ...current, originalImage: image, backgroundRemovedImage: '', backgroundRemoved: false, image }));
      setCrop({ zoom: 1, focusX: 0.5, focusY: 0.5 });
      setRemovalStatus('idle'); setModelProgress('');
    } catch (error) { setPhotoError(error.message); }
    finally { setProcessing(false); }
  }

  async function handleBackgroundRemoval() {
    if (!form.originalImage) return;
    setProcessing(true); setPhotoError(''); setRemovalStatus('processing'); setModelProgress('Loading the image model…');
    try {
      const result = await removeImageBackground(form.originalImage, (progress) => {
        if (progress.total > 0) setModelProgress(`${progress.key}: ${Math.round((progress.current / progress.total) * 100)}%`);
      });
      const image = await blobToDataUrl(result);
      setForm((current) => ({ ...current, backgroundRemovedImage: image, backgroundRemoved: true }));
      setRemovalStatus('success'); setModelProgress('Background removed. The original is unchanged.');
    } catch (error) {
      setRemovalStatus('error'); setPhotoError(error.message || 'Background removal failed. Your original photo is unchanged.');
    }
    finally { setProcessing(false); }
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!form.originalImage) { setPhotoError('Add a photo of your clothing item first.'); return; }
    setProcessing(true); setPhotoError('');
    try {
      const image = await cropImage(cropSource, crop.zoom, crop.focusX, crop.focusY);
      const { backgroundRemovedImage, ...itemForm } = form;
      const item = {
        ...itemForm,
        image,
        backgroundRemoved: Boolean(backgroundRemovedImage || form.backgroundRemoved),
        crop,
        id: editingItem?.id ?? makeId(),
        name: form.name.trim() || `${form.color || 'Untitled'} ${form.category.toLowerCase()}`,
        color: form.color.trim(),
        notes: form.notes.trim(),
        createdAt: editingItem?.createdAt ?? Date.now(),
      };
      setItems((current) => editingItem ? current.map((entry) => entry.id === item.id ? item : entry) : [item, ...current]);
      setModalOpen(false); setFeedback(editingItem ? 'Changes saved.' : 'Piece added to your closet.');
    } catch (error) { setPhotoError(error.message); }
    finally { setProcessing(false); }
  }

  function deleteItem() {
    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    setSelectedIds((current) => current.filter((id) => id !== deleteTarget.id));
    setFeedback('Piece removed from your closet.');
    setDeleteTarget(null);
  }

  function toggleSelection(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }

  function changeItemCategory(id, category) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, category } : item));
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
    setFeedback('Look removed from your lookbook.');
    setDeleteTarget(null);
  }

  function requestDelete(target) {
    dialogReturnFocus.current = document.activeElement;
    setDeleteTarget(target);
  }

  function revisitLook(look) {
    setSelectedIds(look.itemIds.filter((id) => items.some((item) => item.id === id)));
    setView('builder');
  }

  function updateHorizontalFocus(value) {
    setCrop((current) => {
      const frameAspect = previewSize.width && previewSize.height ? previewSize.width / previewSize.height : 0;
      const sourceAspect = sourceSize.width && sourceSize.height ? sourceSize.width / sourceSize.height : 0;
      const needsHorizontalRoom = frameAspect && sourceAspect && sourceAspect <= frameAspect;
      return {
        ...current,
        zoom: needsHorizontalRoom ? Math.max(current.zoom, 1.08) : current.zoom,
        focusX: Number(value),
      };
    });
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
          <button className={view === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => setView('home')}>Home</button>
          <button className={view === 'closet' ? 'nav-link active' : 'nav-link'} onClick={() => setView('closet')}>The closet <span>{items.length}</span></button>
          <button className={view === 'builder' ? 'nav-link active' : 'nav-link'} onClick={() => setView('builder')}>Outfit builder</button>
          <button className={view === 'looks' ? 'nav-link active' : 'nav-link'} onClick={() => setView('looks')}>Saved looks <span>{looks.length}</span></button>
        </nav>
        <button className="header-add" onClick={openNewItem}><Plus size={16} /> Add a piece</button>
      </header>

      <main>
        {view !== 'home' && <section className="page-intro">
          <div>
            <p className="eyebrow">A more considered wardrobe</p>
            <h1>{activeLabel}</h1>
          </div>
          <p className="intro-note">Get to know what you own. Find new ways to wear it.</p>
        </section>}

        {storageError && <p className="storage-alert" role="alert">{storageError}</p>}
        {feedback && <p className="feedback-toast" role="status">{feedback}</p>}

        {view === 'home' && (
          <section className="home-view view-motion" aria-label="Your Closet home">
            <div className="home-hero">
              <img src={HERO_IMAGE} alt="Fashion editorial portrait in a layered outfit" />
              <div className="home-hero-shade" />
              <div className="home-hero-copy">
                <p className="eyebrow">Your wardrobe, reimagined</p>
                <h1>See your clothes<br />in a new light.</h1>
                <p>Bring the pieces you already own together and find a look that feels like you.</p>
                <div className="home-hero-actions">
                  <button className="button button-dark" onClick={() => setView('builder')}><Sparkles size={16} /> Build a look</button>
                  <button className="button button-outline home-secondary" onClick={() => setView('closet')}>Explore your closet</button>
                </div>
              </div>
              <span className="home-image-credit">A more personal way to get dressed</span>
            </div>
            <div className="home-overview">
              <div className="home-overview-heading">
                <div><p className="eyebrow">A wardrobe that works harder</p><h2>Your style, all in one place.</h2></div>
                <button className="text-action" onClick={() => setView('closet')}>View the closet <ChevronDown size={14} className="turn-icon" /></button>
              </div>
              <div className="home-card-grid">
                <button className="home-card" onClick={() => setView('closet')}>
                  <span className="home-card-number">{items.length.toString().padStart(2, '0')}</span>
                  <span className="home-card-title">Pieces in your closet</span>
                  <span className="home-card-note">Keep the things you own in view.</span>
                </button>
                <button className="home-card" onClick={() => setView('builder')}>
                  <span className="home-card-number"><LayoutGrid size={25} /></span>
                  <span className="home-card-title">Put a look together</span>
                  <span className="home-card-note">See your selected pieces side by side.</span>
                </button>
                <button className="home-card" onClick={() => setView('looks')}>
                  <span className="home-card-number">{looks.length.toString().padStart(2, '0')}</span>
                  <span className="home-card-title">Looks saved</span>
                  <span className="home-card-note">Return to outfits you want to wear again.</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {view === 'closet' && (
          <section className="closet-view view-motion" aria-label="Virtual closet">
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
                          <button className="text-action" onClick={() => requestDelete({ id: item.id, name: item.name, type: 'item' })}>Remove piece</button>
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
          <section className="builder-layout view-motion" aria-label="Outfit builder">
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
              {selectedItems.length ? <>
                <div className="preview-mode-switch" role="group" aria-label="Outfit preview mode">
                  <button type="button" className={previewMode === 'pieces' ? 'active' : ''} aria-pressed={previewMode === 'pieces'} onClick={() => setPreviewMode('pieces')}>Pieces</button>
                  <button type="button" className={previewMode === 'look' ? 'active' : ''} aria-pressed={previewMode === 'look'} onClick={() => setPreviewMode('look')}>See your look</button>
                </div>
                {previewMode === 'look' ? <>
                  <LayeredOutfitPreview items={selectedItems} />
                  <p className="layering-hint">Set each piece’s Type below to place it: tops above bottoms, outerwear on top. Light photo backgrounds blend into the preview.</p>
                </> : <div className="outfit-board" role="img" aria-label={`Outfit preview with ${selectedItems.length} selected pieces`}>
                  {selectedItems.map((item) => <div className="board-piece" key={item.id}>
                    <img src={item.image} alt="" />
                    <span>{item.name}</span>
                    <small>{item.category}</small>
                  </div>)}
                </div>}
                <div className="outfit-preview" aria-label="Selected outfit pieces">{selectedItems.map((item) => <div className="outfit-piece" key={item.id}><img src={item.image} alt={item.name} /><div><strong>{item.name}</strong><label className="sr-only" htmlFor={`outfit-type-${item.id}`}>Type for {item.name}</label><select id={`outfit-type-${item.id}`} value={item.category} onChange={(event) => changeItemCategory(item.id, event.target.value)}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></div><button className="icon-button" onClick={() => toggleSelection(item.id)} aria-label={`Remove ${item.name} from outfit`}><X size={15} /></button></div>)}</div>
              </> : <div className="outfit-placeholder"><Shirt size={28} strokeWidth={1.3} /><p>Your pieces will find their place here.</p></div>}
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
          <section className="looks-section view-motion" aria-label="Saved outfits">
            <div className="section-heading"><div><p className="eyebrow">Your personal lookbook</p><h2>Saved looks</h2></div><span className="selection-count">{looks.length} {looks.length === 1 ? 'look' : 'looks'}</span></div>
            {looks.length ? <div className="looks-grid">{looks.map((look) => {
              const lookItems = look.itemIds.map((id) => items.find((item) => item.id === id)).filter(Boolean);
              return <article className="look-card" key={look.id}>
                <div className="look-images"><LayeredOutfitPreview items={lookItems} compact /></div>
                <div className="look-details"><div><p className="eyebrow">{new Date(look.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p><h3>{look.name}</h3></div><span>{lookItems.length} {lookItems.length === 1 ? 'piece' : 'pieces'}</span></div>
                {look.notes && <p className="look-notes">{look.notes}</p>}
                <div className="look-actions"><button className="text-action" onClick={() => revisitLook(look)}>Open in builder</button><button className="icon-button" onClick={() => requestDelete({ id: look.id, name: look.name, type: 'look' })} aria-label={`Delete ${look.name}`} title="Delete look"><Trash2 size={16} /></button></div>
              </article>;
            })}</div> : <div className="looks-empty"><div className="empty-heart"><Heart size={25} /></div><h3>Your lookbook starts here.</h3><p>Choose a few pieces in the outfit builder and save a look to come back to it later.</p><button className="button button-dark" onClick={() => setView('builder')}>Start an outfit <ChevronDown size={15} className="turn-icon" /></button></div>}
          </section>
        )}
      </main>

      <footer className="site-footer"><span>YOUR CLOSET, YOURS ALONE.</span><span>Made for wearing, not just collecting.</span><button onClick={() => setView('home')}>Back to home <ChevronDown size={13} className="turn-icon" /></button></footer>

      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <section className="item-modal" ref={itemDialog} role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
          <header className="modal-header"><div><p className="eyebrow">A piece of your story</p><h2 id="item-modal-title">{editingItem ? 'Edit this piece' : 'Add to your closet'}</h2></div><button className="icon-button close-button" onClick={() => setModalOpen(false)} aria-label="Close"><X size={19} /></button></header>
          <form onSubmit={saveItem}>
            <div className="modal-content">
              <div className="photo-column">
                <div className="upload-zone">
                  {form.originalImage ? <div className="photo-compare">
                    <figure><div className="original-frame"><img src={form.originalImage} alt="Original clothing upload, unchanged" /></div><figcaption>Original upload</figcaption></figure>
                    <figure><div className="live-crop-frame transparent-grid" ref={previewFrame}>
                      <img key={cropSource} src={cropSource} alt="Live crop preview" style={cropPreviewStyle} onLoad={(event) => setSourceSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
                      {form.backgroundRemovedImage && <span className="transparent-label">TRANSPARENT</span>}
                    </div><figcaption>{form.backgroundRemovedImage ? 'Background removed' : 'Live crop preview'}</figcaption></figure>
                  </div> : <button type="button" className="upload-prompt" onClick={() => fileInput.current?.click()}><Upload size={23} /><strong>{processing ? 'Preparing photo…' : 'Choose a photo'}</strong><span>JPG, PNG or WebP · up to 15 MB</span></button>}
                  <input ref={fileInput} className="sr-only" type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
                  {form.originalImage && <button className="text-action replace-photo" type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={15} /> Replace photo</button>}
                </div>
                {form.originalImage && <div className="crop-controls">
                  <div className="crop-heading"><div><p className="eyebrow">Image cleanup</p><h3>Refine your frame</h3></div><button className="icon-button reset-crop" type="button" onClick={() => setCrop({ zoom: 1, focusX: 0.5, focusY: 0.5 })} aria-label="Reset crop framing" title="Reset crop framing"><RotateCcw size={15} /></button></div>
                  <p className="prototype-copy">Crop changes appear in the preview immediately and are saved when you add this piece. Background removal runs in this browser; its model downloads on first use.</p>
                  <label className="range-label">Zoom <input type="range" min="1" max="2.5" step="0.05" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))} /><span>{crop.zoom.toFixed(1)}x</span></label>
                  <label className="range-label">Horizontal position <input type="range" min="0" max="1" step="0.01" value={crop.focusX} onChange={(event) => updateHorizontalFocus(event.target.value)} /><span>{Math.round(crop.focusX * 100)}%</span></label>
                  <p className="crop-hint">If the image has no room to pan at the current crop, this control zooms in slightly to create room.</p>
                  <label className="range-label">Vertical <input type="range" min="0" max="1" step="0.01" value={crop.focusY} onChange={(event) => setCrop((current) => ({ ...current, focusY: Number(event.target.value) }))} /><span>{Math.round(crop.focusY * 100)}%</span></label>
                  <div className="background-actions">
                    <button className="button button-outline remove-background" type="button" onClick={handleBackgroundRemoval} disabled={processing}><Sparkles size={15} /> {removalStatus === 'processing' ? 'Removing background…' : removalStatus === 'success' ? 'Try again' : removalStatus === 'error' ? 'Retry removal' : 'Remove background'}</button>
                    <button className="button button-quiet keep-original" type="button" onClick={() => { setForm((current) => ({ ...current, backgroundRemovedImage: '', backgroundRemoved: false })); setRemovalStatus('idle'); setPhotoError(''); setModelProgress(''); }} disabled={!form.backgroundRemovedImage || processing}>Keep original</button>
                  </div>
                  {removalStatus === 'processing' && <p className="processing-status" role="status" aria-live="polite"><span className="loading-dot" /> {modelProgress || 'Preparing model…'}</p>}
                  {removalStatus === 'success' && <p className="success-status" role="status">{modelProgress}</p>}
                  {removalStatus === 'idle' && <p className="provider-note">Photo processing stays on this device. The model is fetched from IMG.LY on first use.</p>}
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
            <div className="modal-footer"><button type="button" className="button button-quiet" onClick={() => setModalOpen(false)}>Cancel</button><button className="button button-dark" type="submit" disabled={processing}><Check size={16} /> {processing ? 'Processing…' : editingItem ? 'Save changes' : 'Add to closet'}</button></div>
          </form>
        </section>
      </div>}

      {deleteTarget && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}>
        <section className="confirm-modal" ref={confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy">
          <div className="confirm-icon"><Trash2 size={20} /></div><h2 id="delete-title">Remove {deleteTarget.type === 'look' ? 'this look' : 'this piece'}?</h2><p id="delete-copy"><strong>{deleteTarget.name}</strong> will be removed from {deleteTarget.type === 'look' ? 'your saved looks' : 'your closet'}. This cannot be undone.</p>
          <div className="confirm-actions"><button className="button button-quiet" onClick={() => setDeleteTarget(null)}>Keep it</button><button className="button button-danger" onClick={deleteTarget.type === 'look' ? deleteLook : deleteItem}>Remove</button></div>
        </section>
      </div>}
    </div>
  );
}

export default App;

