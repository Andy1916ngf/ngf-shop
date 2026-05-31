import { useEffect, useState }                    from 'react';
import { collection, getDocs, setDoc,
         deleteDoc, doc }                         from 'firebase/firestore';
import { IconTag, IconPlus, IconPencil,
         IconTrash, IconRefresh }                 from '@tabler/icons-react';
import { db }                                     from '../../firebase';

const EMPTY = {
  code:       '',
  type:       'percent',
  value:      '',
  validFrom:  '',
  validUntil: '',
  usageLimit: '',
};

function fmtValue(type, value) {
  return type === 'percent'
    ? `${value} %`
    : `${Math.round(value / 100)} kr`;
}

function fmtDate(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Coupons() {
  const [coupons,       setCoupons]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [form,          setForm]          = useState(null);   // null = hidden
  const [editCode,      setEditCode]      = useState(null);   // null = new
  const [saving,        setSaving]        = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      const all  = snap.docs
        .map(d => ({ code: d.id, ...d.data() }))
        .sort((a, b) => a.code.localeCompare(b.code));
      setCoupons(all);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditCode(null);
    setForm({ ...EMPTY });
  }

  function openEdit(c) {
    setEditCode(c.code);
    setForm({
      code:       c.code,
      type:       c.type,
      value:      c.type === 'percent'
                    ? String(c.value)
                    : String((c.value / 100).toFixed(2)),
      validFrom:  c.validFrom?.toDate
                    ? c.validFrom.toDate().toISOString().slice(0, 10)
                    : '',
      validUntil: c.validUntil?.toDate
                    ? c.validUntil.toDate().toISOString().slice(0, 10)
                    : '',
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
    });
  }

  function update(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function save() {
    const code = form.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !form.value) return;
    setSaving(true);
    try {
      const value = form.type === 'percent'
        ? parseFloat(form.value)
        : Math.round(parseFloat(form.value) * 100);

      const existing = coupons.find(c => c.code === editCode);
      await setDoc(doc(db, 'coupons', code), {
        active:     existing?.active ?? true,
        type:       form.type,
        value,
        validFrom:  form.validFrom  ? new Date(form.validFrom)  : null,
        validUntil: form.validUntil ? new Date(form.validUntil) : null,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
        timesUsed:  existing?.timesUsed ?? 0,
      });
      setForm(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c) {
    const { code, ...rest } = c;
    await setDoc(doc(db, 'coupons', code), { ...rest, active: !c.active });
    await load();
  }

  async function remove(code) {
    await deleteDoc(doc(db, 'coupons', code));
    setConfirmDelete(null);
    await load();
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Rabattkoder</h1>
        <button onClick={openNew} style={s.newBtn}>
          <IconPlus size={15} /> Ny kod
        </button>
      </div>

      {/* Create / Edit form */}
      {form && (
        <div style={s.card}>
          <p style={s.cardTitle}>{editCode ? 'Redigera kod' : 'Ny rabattkod'}</p>

          <label style={s.label}>Kod
            <input
              style={s.input}
              value={form.code}
              onChange={e => update('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="T.EX. SOMMAR25"
              readOnly={!!editCode}
              maxLength={20}
            />
          </label>

          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>Typ
              <select style={s.input} value={form.type}
                onChange={e => update('type', e.target.value)}>
                <option value="percent">Procent (%)</option>
                <option value="fixed">Fast belopp (kr)</option>
              </select>
            </label>
            <label style={{ ...s.label, flex: 1 }}>Värde
              <input style={s.input} type="number" min="0" step="0.01"
                value={form.value}
                placeholder={form.type === 'percent' ? '10' : '50'}
                onChange={e => update('value', e.target.value)} />
            </label>
          </div>

          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>Giltig från (valfri)
              <input style={s.input} type="date" value={form.validFrom}
                onChange={e => update('validFrom', e.target.value)} />
            </label>
            <label style={{ ...s.label, flex: 1 }}>Giltig till (valfri)
              <input style={s.input} type="date" value={form.validUntil}
                onChange={e => update('validUntil', e.target.value)} />
            </label>
          </div>

          <label style={s.label}>Max användningar (lämna tomt = obegränsad)
            <input style={s.input} type="number" min="1" step="1"
              value={form.usageLimit}
              placeholder="Obegränsad"
              onChange={e => update('usageLimit', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={save} disabled={saving || !form.code || !form.value}
              style={s.saveBtn}>
              {saving ? 'Sparar…' : 'Spara'}
            </button>
            <button onClick={() => setForm(null)} style={s.cancelBtn}>Avbryt</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={s.empty}>Laddar…</p>
      ) : coupons.length === 0 ? (
        <p style={s.empty}>Inga rabattkoder än.</p>
      ) : (
        <div style={s.card}>
          {coupons.map((c, idx) => (
            <div key={c.code} style={{
              ...s.row2,
              borderTop: idx === 0 ? 'none' : '0.5px solid rgba(10,10,10,.06)',
              opacity: c.active ? 1 : 0.5,
            }}>
              {/* Code + details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={s.code}>{c.code}</span>
                  <span style={s.badge}>{fmtValue(c.type, c.value)}</span>
                </div>
                <p style={s.meta}>
                  {c.validFrom || c.validUntil ? (
                    <>
                      {c.validFrom  ? `Från ${fmtDate(c.validFrom)}` : ''}
                      {c.validFrom && c.validUntil ? ' · ' : ''}
                      {c.validUntil ? `T.o.m. ${fmtDate(c.validUntil)}` : ''}
                    </>
                  ) : 'Obegränsad giltighetstid'}
                  {' · '}
                  {c.usageLimit
                    ? `${c.timesUsed || 0} / ${c.usageLimit} använda`
                    : `${c.timesUsed || 0} använda`}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(c)}
                  style={{ ...s.iconBtn, background: c.active ? '#D1FAE5' : '#F4F6FC' }}
                  title={c.active ? 'Inaktivera' : 'Aktivera'}>
                  <span style={{ fontSize: 14 }}>{c.active ? '✓' : '○'}</span>
                </button>

                {/* Edit */}
                <button onClick={() => openEdit(c)} style={s.iconBtn}
                  title="Redigera">
                  <IconPencil size={14} />
                </button>

                {/* Delete */}
                {confirmDelete === c.code ? (
                  <button onClick={() => remove(c.code)}
                    style={{ ...s.iconBtn, background: '#FEE2E2', color: '#991B1B' }}
                    title="Bekräfta borttagning">
                    <IconTrash size={14} />
                  </button>
                ) : (
                  <button onClick={() => setConfirmDelete(c.code)}
                    style={s.iconBtn} title="Ta bort">
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page:  { maxWidth: 560 },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   16,
  },
  title: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontWeight:    700,
    fontSize:      20,
    letterSpacing: '-0.03em',
    color:         '#0A0A0A',
  },
  newBtn: {
    display:      'flex',
    alignItems:   'center',
    gap:          5,
    padding:      '8px 14px',
    borderRadius: 999,
    border:       'none',
    background:   '#1B36C9',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
  },
  card: {
    background:   '#fff',
    borderRadius: 13,
    border:       '0.5px solid rgba(10,10,10,.07)',
    padding:      16,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      10.5,
    fontWeight:    600,
    letterSpacing: '.8px',
    textTransform: 'uppercase',
    color:         'rgba(10,10,10,.38)',
    marginBottom:  12,
  },
  label: {
    display:       'flex',
    flexDirection: 'column',
    gap:           5,
    marginBottom:  11,
    fontFamily:    "'Space Grotesk', system-ui, sans-serif",
    fontSize:      12.5,
    fontWeight:    600,
    color:         '#0A0A0A',
  },
  input: {
    padding:      '9px 11px',
    borderRadius: 9,
    border:       '0.5px solid rgba(10,10,10,.12)',
    background:   '#F4F6FC',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    color:        '#0A0A0A',
    width:        '100%',
  },
  row: {
    display: 'flex',
    gap:     10,
  },
  row2: {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    padding:    '11px 0',
  },
  saveBtn: {
    flex:         1,
    height:       42,
    borderRadius: 999,
    border:       'none',
    background:   '#1B36C9',
    color:        '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13.5,
    fontWeight:   700,
    cursor:       'pointer',
  },
  cancelBtn: {
    flex:         1,
    height:       42,
    borderRadius: 999,
    border:       '0.5px solid rgba(10,10,10,.12)',
    background:   '#fff',
    fontFamily:   "'Space Grotesk', system-ui, sans-serif",
    fontSize:     13,
    fontWeight:   600,
    cursor:       'pointer',
    color:        '#0A0A0A',
  },
  code: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize:   13,
    fontWeight: 700,
    color:      '#0A0A0A',
    letterSpacing: '.5px',
  },
  badge: {
    padding:      '2px 8px',
    borderRadius: 999,
    background:   '#DCE3FF',
    color:        '#0C447C',
    fontFamily:   "'JetBrains Mono', monospace",
    fontSize:     11,
    fontWeight:   600,
  },
  meta: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   11.5,
    color:      'rgba(10,10,10,.45)',
    marginTop:  3,
  },
  iconBtn: {
    width:        30,
    height:       30,
    borderRadius: 8,
    border:       'none',
    background:   '#F4F6FC',
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    color:        'rgba(10,10,10,.55)',
  },
  empty: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize:   14,
    color:      'rgba(10,10,10,.4)',
    textAlign:  'center',
    padding:    24,
  },
};
