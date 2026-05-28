import { useEffect, useRef, useState } from 'react';
import { httpsCallable }                from 'firebase/functions';
import { doc, getDoc, setDoc }                  from 'firebase/firestore';
import { db, funcs }                    from '../../firebase';

const updateContentFn  = httpsCallable(funcs, 'updateContent');
const updateConfigFn   = httpsCallable(funcs, 'updateConfig');
const getAdminConfigFn = httpsCallable(funcs, 'getAdminConfig');

const PAGES = [
  { id: 'about', label: 'Om oss' },
  { id: 'tac',   label: 'Köpvillkor' },
  { id: 'faq',   label: 'Vanliga frågor' },
];

/**
 * Settings page — /admin/installningar (siteAdmin only)
 *
 * Sections:
 *   1. Hero / banner config (type: banner | carousel | none, image, headline, link)
 *   2. Static page editor (About, T&C, FAQ) using Quill rich-text editor
 *   3. Admin role management (add/remove siteAdmins and shopAdmins)
 *      NOTE: role list is in Firestore adminRoles/roles — direct write blocked by rules.
 *      TODO: add an updateRoles Cloud Function.
 *
 * Quill is loaded globally via CDN in index.html as window.Quill.
 */
export default function Settings() {
  const [config,        setConfig]        = useState(null);
  const [adminRoles,    setAdminRoles]    = useState(null);
  const [activePage,    setActivePage]    = useState('about');
  const [pageTitle,     setPageTitle]     = useState('');
  const [saving,        setSaving]        = useState(false);
  const [newCategory,   setNewCategory]   = useState('');
  const [newColourName, setNewColourName] = useState('');
  const [newColourHex,  setNewColourHex]  = useState('#1B36C9');
  const [newSize,       setNewSize]       = useState('');
  const [newSiteAdmin,  setNewSiteAdmin]  = useState('');
  const [newShopAdmin,  setNewShopAdmin]  = useState('');
  const quillRef   = useRef(null);
  const editorRef  = useRef(null);

  // Load site config
  useEffect(() => {
    getAdminConfigFn().then(res => setConfig(res.data));
    // Load admin roles directly from Firestore (rules allow siteAdmin reads)
    getDoc(doc(db, 'config', 'adminRoles')).then(snap => {
      if (snap.exists()) setAdminRoles(snap.data());
      else setAdminRoles({ siteAdmins: [], shopAdmins: [] });
    });
  }, []);

  // Load selected page content into Quill
  useEffect(() => {
    if (!editorRef.current) return;

    // Initialise Quill if not already done
    if (!quillRef.current && window.Quill) {
      quillRef.current = new window.Quill(editorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            ['bold', 'italic'],
            [{ header: [2, 3, false] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link'],
            ['clean'],
          ],
        },
      });
    }

    // Fetch and load page content
    getDoc(doc(db, 'content', activePage)).then(snap => {
      if (snap.exists() && quillRef.current) {
        setPageTitle(snap.data().title || '');
        quillRef.current.root.innerHTML = snap.data().body || '';
      }
    });
  }, [activePage]);

  async function savePage() {
    if (!quillRef.current) return;
    setSaving(true);
    try {
      await updateContentFn({
        pageId: activePage,
        title:  pageTitle,
        body:   quillRef.current.root.innerHTML,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      await updateConfigFn({ config });
    } finally {
      setSaving(false);
    }
  }

  async function saveAdminRoles() {
    if (!adminRoles) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'adminRoles'), adminRoles);
    } finally {
      setSaving(false);
    }
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if ((config.categories || []).includes(name)) return;
    setConfig(c => ({ ...c, categories: [...(c.categories || []), name] }));
    setNewCategory('');
  }

  function removeCategory(name) {
    setConfig(c => ({ ...c, categories: (c.categories || []).filter(x => x !== name) }));
  }

  function addColour() {
    const name = newColourName.trim();
    if (!name) return;
    if ((config.colours || []).some(c => c.name === name)) return;
    setConfig(c => ({
      ...c,
      colours: [...(c.colours || []), { name, hex: newColourHex }],
    }));
    setNewColourName('');
    setNewColourHex('#1B36C9');
  }

  function removeColour(name) {
    setConfig(c => ({
      ...c,
      colours: (c.colours || []).filter(x => x.name !== name),
    }));
  }

  function addSize() {
    const s = newSize.trim();
    if (!s) return;
    if ((config.sizes || []).includes(s)) return;
    setConfig(c => ({ ...c, sizes: [...(c.sizes || []), s] }));
    setNewSize('');
  }

  function removeSize(s) {
    setConfig(c => ({ ...c, sizes: (c.sizes || []).filter(x => x !== s) }));
  }

  return (
    <div style={sp.page}>
      <h1 style={sp.pageTitle}>Inställningar</h1>

      {/* ── Hero / Banner ────────────────────────────────── */}
      {config && (
        <div style={sp.card}>
          <p style={sp.cardTitle}>Startsida — hero</p>

          {/* Use hero toggle */}
          <label style={{ ...sp.checkRow, marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={(config.hero?.type || 'banner') !== 'none'}
              onChange={e => setConfig(c => ({
                ...c,
                hero: {
                  ...c.hero,
                  type: e.target.checked
                    ? (c.hero?.type === 'none' ? 'banner' : (c.hero?.type || 'banner'))
                    : 'none',
                },
              }))}
            />
            <span style={sp.checkLabel}>Visa hero på startsidan</span>
          </label>

          {(config.hero?.type || 'banner') !== 'none' && (<>
            <label style={sp.label}>Typ
              <select
                value={config.hero?.type || 'banner'}
                style={sp.input}
                onChange={e => setConfig(c => ({
                  ...c, hero: { ...c.hero, type: e.target.value }
                }))}>
                <option value="banner">Text (redaktionell rubrik)</option>
                <option value="image">Bild</option>
              </select>
            </label>
            {config.hero?.type !== 'image' && (<>
              <label style={sp.label}>Underrubrik
                <input style={sp.input} value={config.hero?.subheadline || ''}
                  placeholder="Säsong 26 · Vårkollektion"
                  onChange={e => setConfig(c => ({ ...c, hero: { ...c.hero, subheadline: e.target.value } }))} />
              </label>
              <label style={sp.label}>Rubrik (stor)
                <input style={sp.input} value={config.hero?.headline || ''}
                  placeholder="Tränat för"
                  onChange={e => setConfig(c => ({ ...c, hero: { ...c.hero, headline: e.target.value } }))} />
              </label>
              <label style={sp.label}>Kursiv rad 2
                <input style={sp.input} value={config.hero?.heroItalic || ''}
                  placeholder="rörelsen."
                  onChange={e => setConfig(c => ({ ...c, hero: { ...c.hero, heroItalic: e.target.value } }))} />
              </label>
            </>)}
            {config.hero?.type === 'image' && (
              <label style={sp.label}>Bild-URL (≥ 1200px bred)
                <input style={sp.input} type="url" value={config.hero?.imageUrl || ''}
                  placeholder="https://…"
                  onChange={e => setConfig(c => ({ ...c, hero: { ...c.hero, imageUrl: e.target.value } }))} />
              </label>
            )}
            <label style={sp.label}>Länk (valfri)
              <input style={sp.input} type="url" value={config.hero?.linkUrl || ''}
                placeholder="https://…"
                onChange={e => setConfig(c => ({ ...c, hero: { ...c.hero, linkUrl: e.target.value || null } }))} />
            </label>
          </>)}

          {/* Maintenance mode — lives under hero since both control the shop front */}
          <div style={sp.divider} />
          <p style={{ ...sp.cardTitle, marginBottom: 10 }}>Underhållsläge</p>
          <label style={sp.checkRow}>
            <input
              type="checkbox"
              checked={config.maintenanceMode || false}
              onChange={e =>
                setConfig(c => ({ ...c, maintenanceMode: e.target.checked }))
              }
            />
            <span style={sp.checkLabel}>
              Sätt butiken i underhållsläge
              <span style={sp.checkHint}> — kunder ser underhållssidan</span>
            </span>
          </label>

          <button onClick={saveConfig} disabled={saving} style={{ ...sp.saveBtn, marginTop: 14 }}>
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      )}

      {/* ── Static Pages ─────────────────────────────────── */}
      <div style={sp.card}>
        <p style={sp.cardTitle}>Statiska sidor</p>
        <div style={sp.pageTabs}>
          {PAGES.map(p => (
            <button key={p.id} onClick={() => setActivePage(p.id)}
              style={{ ...sp.pageTab, ...(activePage === p.id ? sp.pageTabActive : {}) }}>
              {p.label}
            </button>
          ))}
        </div>
        <label style={sp.label}>Sidrubrik
          <input style={sp.input} value={pageTitle} onChange={e => setPageTitle(e.target.value)} />
        </label>
        {/* Quill mounts into this div */}
        <div ref={editorRef} style={{ minHeight: 200 }} />
        <button onClick={savePage} disabled={saving} style={{ ...sp.saveBtn, marginTop: 12 }}>
          {saving ? 'Sparar…' : 'Spara sida'}
        </button>
      </div>

      {/* ── Shipping ─────────────────────────────────────── */}
      {config && (
        <section>
          <h3>Leverans</h3>

          {/* Master toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={config.shippingEnabled || false}
              onChange={e =>
                setConfig(c => ({ ...c, shippingEnabled: e.target.checked }))
              }
            />
            Erbjud hemleverans (PostNord eller liknande)
          </label>

          <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 12 }}>
            Upphämtning vid träning är alltid tillgänglig och alltid gratis.
            {config.shippingEnabled
              ? ' Hemleverans visas nu som ett alternativ i varukorgen.'
              : ' Hemleverans är dold för kunder tills du aktiverar den ovan.'}
          </p>

          {/* Shipping rules — only shown when delivery is enabled */}
          {config.shippingEnabled && (
            <div>
              <p style={{ fontWeight: 600, marginBottom: 8 }}>
                Fraktregler (baserat på summan av produkternas fraktstorlek)
              </p>

              {(config.shippingRules || [])
                .slice()
                .sort((a, b) => a.maxUnits - b.maxUnits)
                .map((rule, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13 }}>
                      {i === 0
                        ? `Upp till ${rule.maxUnits} enheter`
                        : `${arr[i - 1].maxUnits + 1}–${rule.maxUnits} enheter`}
                    </span>
                    <span>→</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={Math.round(rule.costInOre / 100)}
                      style={{ width: 70 }}
                      onChange={e => {
                        const updated = (config.shippingRules || []).map((r, j) =>
                          j === i
                            ? { ...r, costInOre: Math.round(parseFloat(e.target.value || 0) * 100) }
                            : r
                        );
                        setConfig(c => ({ ...c, shippingRules: updated }));
                      }}
                    />
                    <span>kr</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (config.shippingRules || []).filter((_, j) => j !== i);
                        setConfig(c => ({ ...c, shippingRules: updated }));
                      }}
                      style={{ fontSize: 12, color: '#DC2626' }}>
                      Ta bort
                    </button>
                  </div>
                ))}

              <button
                type="button"
                onClick={() => {
                  const rules   = config.shippingRules || [];
                  const lastMax = rules.length
                    ? Math.max(...rules.map(r => r.maxUnits))
                    : 0;
                  setConfig(c => ({
                    ...c,
                    shippingRules: [
                      ...rules,
                      { maxUnits: lastMax + 5, costInOre: 9900 },
                    ],
                  }));
                }}
                style={{ fontSize: 13, marginTop: 4 }}>
                + Lägg till regel
              </button>

              <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>
                Den sista regeln används som tak — beställningar över dess maxvärde
                debiteras till dess pris.
              </p>
            </div>
          )}

          <button onClick={saveConfig} disabled={saving} style={{ marginTop: 14 }}>
            {saving ? 'Sparar…' : 'Spara leveransinställningar'}
          </button>
        </section>
      )}

      {/* ── Kategorier ───────────────────────────────────── */}
      {config && (
        <div style={sp.card}>
          <p style={sp.cardTitle}>Kategorier</p>
          <p style={{ ...sp.hint, marginBottom: 12 }}>
            Visas i butikens filter och väljs vid produktskapande.
          </p>

          {/* Current categories as removable chips */}
          <div style={sp.chipRow}>
            {(config.categories || []).map(cat => (
              <div key={cat} style={sp.chip}>
                <span style={sp.chipLabel}>{cat}</span>
                <button
                  type="button"
                  onClick={() => removeCategory(cat)}
                  style={sp.chipRm}
                  aria-label={`Ta bort ${cat}`}>
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add new */}
          <div style={sp.addRow}>
            <input
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
              placeholder="Ny kategori"
              style={{ ...sp.input, flex: 1 }}
            />
            <button
              type="button"
              onClick={addCategory}
              disabled={!newCategory.trim()}
              style={sp.addBtn}>
              + Lägg till
            </button>
          </div>

          <button
            onClick={saveConfig}
            disabled={saving}
            style={{ ...sp.saveBtn, marginTop: 12 }}>
            {saving ? 'Sparar…' : 'Spara kategorier'}
          </button>
        </div>
      )}

      {/* ── Färger ───────────────────────────────────────── */}
      {config && (
        <div style={sp.card}>
          <p style={sp.cardTitle}>Färger</p>
          <p style={{ ...sp.hint, marginBottom: 12 }}>
            Tillgängliga färgalternativ att välja från vid produktskapande.
          </p>

          <div style={sp.chipRow}>
            {(config.colours || []).map(({ name, hex }) => {
              const isLight = ['#FFFFFF', '#F4F6FC', '#9CA3AF', '#FBBF24'].includes(hex);
              return (
                <div key={name} style={sp.chip}>
                  <div style={{
                    width:        14,
                    height:       14,
                    borderRadius: 4,
                    background:   hex,
                    border:       `0.5px solid ${isLight ? 'rgba(10,10,10,.2)' : 'transparent'}`,
                    flexShrink:   0,
                  }} />
                  <span style={sp.chipLabel}>{name}</span>
                  <button
                    type="button"
                    onClick={() => removeColour(name)}
                    style={sp.chipRm}
                    aria-label={`Ta bort ${name}`}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ ...sp.addRow, alignItems: 'center' }}>
            <input
              value={newColourName}
              onChange={e => setNewColourName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColour())}
              placeholder="Färgnamn (t.ex. Korall)"
              style={{ ...sp.input, flex: 1 }}
            />
            <input
              type="color"
              value={newColourHex}
              onChange={e => setNewColourHex(e.target.value)}
              style={{
                width:        40,
                height:       40,
                borderRadius: 8,
                border:       '0.5px solid rgba(10,10,10,.12)',
                padding:      3,
                cursor:       'pointer',
                flexShrink:   0,
              }}
              aria-label="Välj färg"
            />
            <button
              type="button"
              onClick={addColour}
              disabled={!newColourName.trim()}
              style={sp.addBtn}>
              + Lägg till
            </button>
          </div>

          <button
            onClick={saveConfig}
            disabled={saving}
            style={{ ...sp.saveBtn, marginTop: 12 }}>
            {saving ? 'Sparar…' : 'Spara färger'}
          </button>
        </div>
      )}

      {/* ── Storlekar ─────────────────────────────────────── */}
      {config && (
        <div style={sp.card}>
          <p style={sp.cardTitle}>Storlekar</p>
          <p style={{ ...sp.hint, marginBottom: 12 }}>
            Alla tillgängliga storlekar. Välj vilka som gäller per produkt.
          </p>

          <div style={sp.chipRow}>
            {(config.sizes || []).map(s => (
              <div key={s} style={sp.chip}>
                <span style={sp.chipLabel}>{s}</span>
                <button
                  type="button"
                  onClick={() => removeSize(s)}
                  style={sp.chipRm}
                  aria-label={`Ta bort ${s}`}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={sp.addRow}>
            <input
              value={newSize}
              onChange={e => setNewSize(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSize())}
              placeholder="Storlek (t.ex. XL eller M (33–37))"
              style={{ ...sp.input, flex: 1 }}
            />
            <button
              type="button"
              onClick={addSize}
              disabled={!newSize.trim()}
              style={sp.addBtn}>
              + Lägg till
            </button>
          </div>

          <button
            onClick={saveConfig}
            disabled={saving}
            style={{ ...sp.saveBtn, marginTop: 12 }}>
            {saving ? 'Sparar…' : 'Spara storlekar'}
          </button>
        </div>
      )}

      {/* ── Adminroller ──────────────────────────────────── */}
      {adminRoles && (
        <div style={sp.card}>
          <p style={sp.cardTitle}>Adminroller</p>
          <p style={{ ...sp.hint, marginBottom: 16 }}>
            Alla Google-konton kan läggas till — ingen domänbegränsning.
          </p>

          {/* Site admins */}
          <p style={{ ...sp.label, marginBottom: 8 }}>
            Site-admins — full åtkomst (ordrar, produkter, inställningar)
          </p>
          <div style={sp.chipRow}>
            {(adminRoles.siteAdmins || []).map(email => (
              <div key={email} style={sp.chip}>
                <span style={sp.chipLabel}>{email}</span>
                <button
                  type="button"
                  onClick={() => setAdminRoles(r => ({
                    ...r,
                    siteAdmins: r.siteAdmins.filter(e => e !== email),
                  }))}
                  style={sp.chipRm}>×</button>
              </div>
            ))}
          </div>
          <div style={{ ...sp.addRow, marginBottom: 18 }}>
            <input
              value={newSiteAdmin}
              onChange={e => setNewSiteAdmin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(),
                newSiteAdmin.trim() && setAdminRoles(r => ({
                  ...r,
                  siteAdmins: [...(r.siteAdmins || []), newSiteAdmin.trim()],
                })) && setNewSiteAdmin('')
              )}
              placeholder="e-postadress"
              style={{ ...sp.input, flex: 1 }}
            />
            <button
              type="button"
              disabled={!newSiteAdmin.trim()}
              onClick={() => {
                if (!newSiteAdmin.trim()) return;
                setAdminRoles(r => ({
                  ...r,
                  siteAdmins: [...(r.siteAdmins || []), newSiteAdmin.trim()],
                }));
                setNewSiteAdmin('');
              }}
              style={sp.addBtn}>
              + Lägg till
            </button>
          </div>

          {/* Shop admins */}
          <p style={{ ...sp.label, marginBottom: 8 }}>
            Shop-admins — ordrar och produkter
          </p>
          <div style={sp.chipRow}>
            {(adminRoles.shopAdmins || []).map(email => (
              <div key={email} style={sp.chip}>
                <span style={sp.chipLabel}>{email}</span>
                <button
                  type="button"
                  onClick={() => setAdminRoles(r => ({
                    ...r,
                    shopAdmins: r.shopAdmins.filter(e => e !== email),
                  }))}
                  style={sp.chipRm}>×</button>
              </div>
            ))}
          </div>
          <div style={sp.addRow}>
            <input
              value={newShopAdmin}
              onChange={e => setNewShopAdmin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(),
                newShopAdmin.trim() && setAdminRoles(r => ({
                  ...r,
                  shopAdmins: [...(r.shopAdmins || []), newShopAdmin.trim()],
                })) && setNewShopAdmin('')
              )}
              placeholder="e-postadress"
              style={{ ...sp.input, flex: 1 }}
            />
            <button
              type="button"
              disabled={!newShopAdmin.trim()}
              onClick={() => {
                if (!newShopAdmin.trim()) return;
                setAdminRoles(r => ({
                  ...r,
                  shopAdmins: [...(r.shopAdmins || []), newShopAdmin.trim()],
                }));
                setNewShopAdmin('');
              }}
              style={sp.addBtn}>
              + Lägg till
            </button>
          </div>

          <button
            onClick={saveAdminRoles}
            disabled={saving}
            style={{ ...sp.saveBtn, marginTop: 14 }}>
            {saving ? 'Sparar…' : 'Spara roller'}
          </button>
        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const sp = {
  page:      { maxWidth: 600 },
  pageTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      22,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
    marginBottom:  20,
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
  checkRow: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        10,
    cursor:     'pointer',
  },
  checkLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13.5,
    fontWeight: 500,
    color:      '#0A0A0A',
  },
  checkHint: {
    color:      'rgba(10,10,10,.45)',
    fontWeight: 400,
  },
  saveBtn: {
    width:         '100%',
    height:        44,
    borderRadius:  999,
    border:        'none',
    background:    '#1B36C9',
    color:         '#fff',
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      13.5,
    fontWeight:    700,
    cursor:        'pointer',
  },
  pageTabs: {
    display:      'flex',
    gap:          4,
    marginBottom: 14,
    flexWrap:     'wrap',
  },
  pageTab: {
    padding:      '6px 12px',
    borderRadius: 999,
    fontSize:     12,
    fontWeight:   600,
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    cursor:       'pointer',
    border:       'none',
    background:   'rgba(10,10,10,.07)',
    color:        'rgba(10,10,10,.6)',
  },
  pageTabActive: {
    background: '#0A0A0A',
    color:      '#fff',
  },
  divider: {
    height:     '0.5px',
    background: 'rgba(10,10,10,.09)',
    margin:     '16px 0',
  },
  chipRow: {
    display:      'flex',
    gap:          6,
    flexWrap:     'wrap',
    marginBottom: 10,
  },
  chip: {
    display:      'flex',
    alignItems:   'center',
    gap:          5,
    padding:      '5px 8px 5px 12px',
    borderRadius: 999,
    background:   '#F4F6FC',
    border:       '0.5px solid rgba(10,10,10,.1)',
  },
  chipLabel: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   13,
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
    padding:    0,
    fontWeight: 400,
  },
  addRow: {
    display: 'flex',
    gap:     8,
  },
  addBtn: {
    flexShrink:   0,
    padding:      '9px 14px',
    borderRadius: 9,
    border:       'none',
    background:   '#0A0A0A',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
    whiteSpace:   'nowrap',
  },
  hint: {
    fontFamily:  "'Space Grotesk', system-ui, sans-serif",
    fontSize:    13,
    color:       'rgba(10,10,10,.52)',
    lineHeight:  1.6,
  },
};