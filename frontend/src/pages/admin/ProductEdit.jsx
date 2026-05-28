import { useEffect, useState }        from 'react';
import { useParams, useNavigate }      from 'react-router-dom';
import { httpsCallable }              from 'firebase/functions';
import { doc, getDoc }                from 'firebase/firestore';
import { db, funcs }                  from '../../firebase';

const updateProductFn    = httpsCallable(funcs, 'updateProduct');
const getUploadUrlFn     = httpsCallable(funcs, 'getProductImageUploadUrl');

// ── ColourPicker ──────────────────────────────────────────────
// configColours: { name: string, hex: string }[]
// value: string[] | null

// ── ColourPicker ──────────────────────────────────────────────
// configColours: { name: string, hex: string }[]
// value: string[] | null

function ColourPicker({ value, onChange, configColours }) {
  const [custom, setCustom] = useState('');
  const selected = value || [];

  function toggle(name) {
    onChange(selected.includes(name)
      ? selected.filter(n => n !== name)
      : [...selected, name]
    );
  }

  function addCustom() {
    const name = custom.trim();
    if (!name || selected.includes(name)) return;
    onChange([...selected, name]);
    setCustom('');
  }

  function remove(name) {
    onChange(selected.filter(n => n !== name));
  }

  const hexFor = name =>
    configColours.find(c => c.name === name)?.hex || '#888';

  const isLight = hex =>
    ['#FFFFFF', '#F4F6FC', '#DCE3FF', '#9CA3AF', '#FBBF24'].includes(hex);

  return (
    <div>
      {/* Config swatches — click to toggle */}
      <div style={cs.presets}>
        {configColours.map(({ name, hex }) => {
          const on = selected.includes(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              title={name}
              aria-label={`${on ? 'Ta bort' : 'Lägg till'} ${name}`}
              style={{
                ...cs.swatch,
                background: hex,
                border:     on
                  ? '2.5px solid #0A0A0A'
                  : `1px solid ${isLight(hex) ? 'rgba(10,10,10,.2)' : 'transparent'}`,
                padding:    on ? 2 : 3,
              }}>
              {on && (
                <div style={{
                  width:        '100%',
                  height:       '100%',
                  borderRadius: 5,
                  background:   hex,
                  border:       `2px solid ${isLight(hex) ? 'rgba(10,10,10,.15)' : '#fff'}`,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={cs.chips}>
          {selected.map(name => (
            <div key={name} style={cs.chip}>
              <div style={{
                width:        12,
                height:       12,
                borderRadius: 3,
                background:   hexFor(name),
                border:       '0.5px solid rgba(10,10,10,.15)',
                flexShrink:   0,
              }} />
              <span style={cs.chipLabel}>{name}</span>
              <button type="button" onClick={() => remove(name)} style={cs.chipRm}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Custom colour not in config */}
      <div style={cs.customRow}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Annan färg (t.ex. Korall)"
          style={cs.customInput}
        />
        <button type="button" onClick={addCustom} disabled={!custom.trim()} style={cs.customBtn}>
          + Lägg till
        </button>
      </div>
    </div>
  );
}

// ── SizePicker ────────────────────────────────────────────────
// configSizes: string[]
// value: string[] | null

function SizePicker({ value, onChange, configSizes }) {
  const [custom, setCustom] = useState('');
  const selected = value || [];

  function toggle(s) {
    onChange(selected.includes(s)
      ? selected.filter(x => x !== s)
      : [...selected, s]
    );
  }

  function addCustom() {
    const s = custom.trim();
    if (!s || selected.includes(s)) return;
    onChange([...selected, s]);
    setCustom('');
  }

  function remove(s) {
    onChange(selected.filter(x => x !== s));
  }

  return (
    <div>
      {/* Config size pills — click to toggle */}
      <div style={cs.presets}>
        {configSizes.map(s => {
          const on = selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-label={`${on ? 'Ta bort' : 'Välj'} ${s}`}
              style={{
                padding:      '5px 10px',
                borderRadius: 8,
                border:       'none',
                fontFamily:   "'Space Grotesk', system-ui, sans-serif",
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                background:   on ? '#0A0A0A' : '#F4F6FC',
                color:        on ? '#fff'     : 'rgba(10,10,10,.55)',
                whiteSpace:   'nowrap',
              }}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={cs.chips}>
          {selected.map(s => (
            <div key={s} style={cs.chip}>
              <span style={cs.chipLabel}>{s}</span>
              <button type="button" onClick={() => remove(s)} style={cs.chipRm}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Custom size not in config */}
      <div style={cs.customRow}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Annan storlek (t.ex. One Size, 36/38)"
          style={cs.customInput}
        />
        <button type="button" onClick={addCustom} disabled={!custom.trim()} style={cs.customBtn}>
          + Lägg till
        </button>
      </div>
    </div>
  );
}

const cs = {
  presets: { display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 },
  swatch:  { width: 32, height: 32, borderRadius: 8, cursor: 'pointer', flexShrink: 0 },
  chips:   { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    display:    'flex',
    alignItems: 'center',
    gap:        5,
    padding:    '4px 8px 4px 7px',
    borderRadius: 999,
    background: '#F4F6FC',
    border:     '0.5px solid rgba(10,10,10,.1)',
  },
  chipLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   12,
    fontWeight: 500,
    color:      '#0A0A0A',
  },
  chipRm: {
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    color:      'rgba(10,10,10,.4)',
    fontSize:   16,
    lineHeight: 1,
    padding:    '0 0 0 2px',
  },
  customRow: { display: 'flex', gap: 7 },
  customInput: {
    flex:         1,
    padding:      '8px 11px',
    borderRadius: 9,
    border:       '0.5px solid rgba(10,10,10,.12)',
    background:   '#F4F6FC',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#0A0A0A',
    outline:      'none',
  },
  customBtn: {
    flexShrink:   0,
    padding:      '8px 12px',
    borderRadius: 9,
    border:       'none',
    background:   '#0A0A0A',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
    whiteSpace:   'nowrap',
  },
};

const EMPTY = {
  name:           '',
  description:    '',
  price:          '',
  category:       '',
  stock:          '',
  visible:        true,
  onSale:         false,
  originalPrice:  '',   // displayed in kr; null means no original price shown
  images:         [],
  imagesByColour: null,
  sizeGuideUrl:   '',
  shippingSize:   1,
  variations: {
    colours:    null,
    sizes:      null,
    customText: false,
  },
};

export default function ProductEdit({ isNew }) {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [form,         setForm]         = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [categories,   setCategories]   = useState(['Kläder', 'Utrustning', 'Tillbehör']);
  const [configColours, setConfigColours] = useState([]);
  const [configSizes,   setConfigSizes]   = useState([]);

  // Load categories, colours, and sizes from config/site
  useEffect(() => {
    getDoc(doc(db, 'config', 'site')).then(snap => {
      const d = snap.data() || {};
      if (d.categories?.length)  setCategories(d.categories);
      if (d.colours?.length)     setConfigColours(d.colours);
      if (d.sizes?.length)       setConfigSizes(d.sizes);
    });
  }, []);

  function addFiles(e) {
    const files = Array.from(e.target.files);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  }

  function removeExistingImage(idx) {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  }

  function removePendingFile(idx) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  }

  // Load existing product when editing
  useEffect(() => {
    if (isNew || !id) return;
    getDoc(doc(db, 'products', id)).then(snap => {
      if (snap.exists()) {
        const p = snap.data();
        setForm({
          ...p,
          price:         (p.price / 100).toString(),
          originalPrice: p.originalPrice ? (p.originalPrice / 100).toString() : '',
          sizeGuideUrl:  p.sizeGuideUrl || '',
        });
      }
    });
  }, [id]);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateVariation(field, value) {
    setForm(prev => ({
      ...prev,
      variations: { ...prev.variations, [field]: value },
    }));
  }

  async function uploadImage(file) {
    const res = await getUploadUrlFn({
      filename:    file.name,
      contentType: file.type,
    });
    const { uploadUrl, publicUrl } = res.data;
    await fetch(uploadUrl, {
      method:  'PUT',
      body:    file,
      headers: { 'Content-Type': file.type },
    });
    return publicUrl;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let images = [...form.images];
      for (const file of pendingFiles) {
        const url = await uploadImage(file);
        images.push(url);
      }

      // colours: already an array (or null when disabled)
      const colours = form.variations.colours?.length
        ? form.variations.colours
        : null;

      // sizes: now also an array (SizePicker stores as array directly)
      const sizes = form.variations.sizes?.length
        ? form.variations.sizes
        : null;

      const originalPrice = form.onSale && form.originalPrice
        ? Math.round(parseFloat(form.originalPrice) * 100)
        : null;

      await updateProductFn({
        productId:     isNew ? undefined : id,
        isNew:         !!isNew,
        ...form,
        price:         Math.round(parseFloat(form.price) * 100),
        onSale:        form.onSale,
        originalPrice: originalPrice,
        shippingSize:  parseInt(form.shippingSize, 10) || 1,
        sizeGuideUrl:  form.sizeGuideUrl?.trim() || null,
        images,
        variations: { colours, sizes, customText: form.variations.customText },
      });

      navigate('/admin/produkter');
    } catch (err) {
      console.error('Save failed', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <h2>{isNew ? 'Ny produkt' : 'Redigera produkt'}</h2>

      <label>Namn
        <input value={form.name} onChange={e => update('name', e.target.value)} required />
      </label>

      <label>Beskrivning
        <textarea value={form.description} onChange={e => update('description', e.target.value)} />
      </label>

      <label>Pris (kr)
        <input type="number" min="0" step="0.01"
          value={form.price} onChange={e => update('price', e.target.value)} required />
      </label>

      <label>Kategori
        <select value={form.category} onChange={e => update('category', e.target.value)}>
          <option value="" disabled>Välj kategori…</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      <label>Lager (lämna tomt för obegränsat)
        <input type="number" min="0"
          value={form.stock} onChange={e => update('stock', e.target.value)} />
      </label>

      <label>
        <input type="checkbox" checked={form.visible}
          onChange={e => update('visible', e.target.checked)} />
        Synlig i butiken
      </label>

      {/* ── On sale ─────────────────────────────────────── */}
      <fieldset>
        <legend>Rea</legend>
        <label>
          <input type="checkbox" checked={form.onSale}
            onChange={e => update('onSale', e.target.checked)} />
          Visa som reapris
        </label>
        {form.onSale && (
          <label>Ursprungspris (kr, visas överstruket)
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="t.ex. 499"
              value={form.originalPrice}
              onChange={e => update('originalPrice', e.target.value)}
            />
          </label>
        )}
      </fieldset>

      {/* ── Images ─────────────────────────────────────── */}
      <fieldset>
        <legend>Bilder</legend>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {/* Existing uploaded images */}
          {form.images.map((url, i) => (
            <div key={url} style={{ position: 'relative' }}>
              <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
              <button
                type="button"
                onClick={() => removeExistingImage(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  border: 'none', background: '#DC2626', color: '#fff',
                  fontSize: 12, cursor: 'pointer', lineHeight: 1,
                }}
                aria-label="Ta bort bild">
                ×
              </button>
            </div>
          ))}

          {/* Pending (not yet uploaded) — show preview */}
          {pendingFiles.map((file, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={URL.createObjectURL(file)}
                alt=""
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, opacity: 0.6 }}
              />
              <div style={{
                position: 'absolute', bottom: 2, left: 0, right: 0,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                textAlign: 'center', color: '#fff', background: 'rgba(0,0,0,.5)',
                borderRadius: '0 0 6px 6px',
              }}>
                väntar…
              </div>
              <button
                type="button"
                onClick={() => removePendingFile(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 20, height: 20, borderRadius: '50%',
                  border: 'none', background: '#DC2626', color: '#fff',
                  fontSize: 12, cursor: 'pointer',
                }}
                aria-label="Ta bort">
                ×
              </button>
            </div>
          ))}

          {/* Add image button */}
          <label style={{
            width: 80, height: 80, borderRadius: 8,
            border: '1.5px dashed rgba(10,10,10,.2)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', gap: 4,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 10, color: 'rgba(10,10,10,.4)',
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
            <span>Lägg till</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={addFiles}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <small style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: 'rgba(10,10,10,.38)', letterSpacing: '.3px' }}>
          JPEG · PNG · WEBP · Max 5 MB per bild
        </small>
      </fieldset>

      {/* Shipping */}
      <fieldset>
        <legend>Frakt</legend>

        <label>Fraktstorlek
          <input
            type="number"
            min="1"
            step="1"
            value={form.shippingSize}
            onChange={e => update('shippingSize', parseInt(e.target.value, 10) || 1)}
          />
          <small>1 = t-shirt / strumpor &nbsp;·&nbsp; 3 = hoodie / vattenflaska &nbsp;·&nbsp; 4 = bag</small>
        </label>

        <label>Länk till storleksguide (valfri)
          <input
            type="url"
            placeholder="https://…"
            value={form.sizeGuideUrl || ''}
            onChange={e => update('sizeGuideUrl', e.target.value)}
          />
        </label>
      </fieldset>

      {/* Variations */}
      <fieldset>
        <legend>Varianter</legend>

        <label>
          <input type="checkbox"
            checked={form.variations.colours !== null}
            onChange={e => updateVariation('colours', e.target.checked ? [] : null)} />
          Färgval
        </label>
        {form.variations.colours !== null && (
          <ColourPicker
            value={form.variations.colours}
            onChange={colours => updateVariation('colours', colours)}
            configColours={configColours}
          />
        )}

        <label>
          <input type="checkbox"
            checked={form.variations.sizes !== null}
            onChange={e => updateVariation('sizes', e.target.checked ? [] : null)} />
          Storleksval
        </label>
        {form.variations.sizes !== null && (
          <SizePicker
            value={form.variations.sizes}
            onChange={sizes => updateVariation('sizes', sizes)}
            configSizes={configSizes}
          />
        )}

        <label>
          <input type="checkbox"
            checked={form.variations.customText}
            onChange={e => updateVariation('customText', e.target.checked)} />
          Anpassad text (tryck)
        </label>
      </fieldset>

      <button type="submit" disabled={saving}>
        {saving ? 'Sparar…' : 'Spara produkt'}
      </button>
      <button type="button" onClick={() => navigate('/admin/produkter')}>Avbryt</button>
    </form>
  );
}

// ── Admin form shared styles ──────────────────────────────────
export const adminFormStyles = {
  page:       { maxWidth: 560 },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      22,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },
  card: {
    background:   '#fff',
    borderRadius: 14,
    border:       '0.5px solid rgba(10,10,10,.07)',
    padding:      '16px',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      11,
    fontWeight:    600,
    letterSpacing: '.8px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.4)',
    marginBottom:  12,
  },
  label: {
    display:       'flex',
    flexDirection: 'column',
    gap:           5,
    marginBottom:  12,
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      13,
    fontWeight:    600,
    color:         '#0A0A0A',
  },
  input: {
    padding:      '10px 12px',
    borderRadius: 10,
    border:       '0.5px solid rgba(10,10,10,.12)',
    background:   '#F4F6FC',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#0A0A0A',
    outline:      'none',
    width:        '100%',
  },
  saveBtn: {
    width:         '100%',
    height:        50,
    borderRadius:  999,
    border:        'none',
    background:    '#1B36C9',
    color:         '#fff',
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      14,
    fontWeight:    700,
    cursor:        'pointer',
    marginBottom:  8,
  },
  cancelBtn: {
    width:         '100%',
    height:        44,
    borderRadius:  999,
    border:        '0.5px solid rgba(10,10,10,.12)',
    background:    '#fff',
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      13,
    fontWeight:    600,
    cursor:        'pointer',
    color:         '#0A0A0A',
  },
};
