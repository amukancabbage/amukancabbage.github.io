import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readPage } from '../lib/pagination';
import { supabase } from '../lib/supabase';
import AsyncState from './AsyncState';
import Dialog from './Dialog';
import { useDraftGuard, useUnsavedDraft } from './DraftGuard';
import ResponsiveList, { type ListColumn } from './ResponsiveList';

export type Option = { value: number | string; label: string };
export type RowValues = Record<string, string>;
export type FormValues = Record<string, string | string[] | RowValues[]>;

export type Field<T> = {
  name: keyof T & string;
  label: string;
  type?: 'text' | 'number' | 'url' | 'textarea' | 'select' | 'multiselect' | 'rows';
  required?: boolean;
  // lebar penuh di form
  wide?: boolean;
  // untuk 'select' / 'multiselect': pilihan diambil dari tabel lain
  source?: { table: string; select: string; order: string; label: (row: any) => string };
  // untuk 'select': pilihan tetap (tidak dari tabel)
  options?: Option[];
  // menyaring pilihan berdasarkan isi form, mis. ketua hanya dari anggota tim
  filterOptions?: (options: Option[], form: FormValues) => Option[];
  // pilihan khusus di akhir daftar; nilainya bukan id sehingga disimpan sebagai null
  extraOptions?: Option[];
  // field hanya tampil (dan disimpan) jika kondisi terpenuhi; jika tidak, disimpan null
  showIf?: (form: FormValues) => boolean;
  // nilai form saat edit; default nilai kolom apa adanya
  getValue?: (row: T) => string;
  // untuk 'multiselect': tabel penghubung banyak-ke-banyak
  // contoh anggota: { table: 'penelitian_anggota', foreignKey: 'penelitian_id', valueKey: 'dosen_id' }
  // exclude: nama field lain yang nilainya tidak ikut disimpan di tabel penghubung
  junction?: { table: string; foreignKey: string; valueKey: string; exclude?: string };
  // untuk 'multiselect': nilai yang sudah tersimpan pada baris
  getValues?: (row: T) => (number | string)[];
  // untuk 'multiselect': nilai yang selalu tercentang dan tidak bisa dihapus
  lockedValues?: string[];
  // untuk 'multiselect': 'checklist' (default) = daftar centang;
  // 'list' = combobox untuk menambah + listbox berisi yang dipilih, dengan tombol Hapus
  picker?: 'checklist' | 'list';
  // untuk 'rows': daftar isian per baris, disimpan sebagai array objek di kolom jsonb
  // contoh: [{ name: 'npm', label: 'NPM' }, { name: 'nama', label: 'Nama', required: true }]
  rowFields?: { name: string; label: string; required?: boolean }[];
  // tampilan kolom di tabel; default menampilkan nilai field apa adanya
  render?: (row: T) => ReactNode;
  hideInTable?: boolean;
  hideInForm?: boolean;
};

type OrderBy = { column: string; ascending?: boolean };

type Props<T> = {
  title: string;
  // keterangan singkat di bawah judul
  description?: ReactNode;
  table: string;
  select: string;
  // satu atau beberapa kolom urutan; kolom tabel relasi ditulis 'tabel(kolom)', mis. 'prodi(prodi)'
  order?: OrderBy | OrderBy[];
  fields: Field<T>[];
  listColumns?: { summary: (keyof T & string)[]; extra?: keyof T & string };
  // hak akses; default semua diizinkan
  canCreate?: boolean;
  canEdit?: (row: T) => boolean;
  canDelete?: (row: T) => boolean;
  // nilai yang selalu ikut disimpan, mis. dosen_id milik dosen yang login
  fixedValues?: Record<string, unknown>;
  // pemeriksaan sebelum menyimpan; kembalikan pesan error atau null
  validate?: (form: FormValues) => string | null;
  // jumlah baris per halaman; jika diisi, data diambil per halaman dari server
  pageSize?: number;
  // kolom teks yang dicari (ilike); jika diisi, muncul kotak pencarian di atas tabel
  searchColumns?: string[];
  // syarat pencarian tambahan dalam format filter PostgREST, mis. 'dosen_id.in.(1,2)'
  searchExtra?: (keyword: string) => Promise<string[]>;
  searchPlaceholder?: string;
};

function emptyForm<T>(fields: Field<T>[]): FormValues {
  return Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.type === 'multiselect' ? [...(f.lockedValues ?? [])] : f.type === 'rows' ? [] : '',
    ]),
  );
}

function errorMessage(error: { code?: string; message: string }) {
  if (error.code === '23503') return 'Data masih dipakai oleh data lain, tidak bisa dihapus.';
  if (error.code === '23505') return 'Data sudah ada (duplikat).';
  if (error.code === '42501') return 'Anda tidak punya hak akses untuk aksi ini.';
  return error.message;
}

const allow = () => true;

export default function CrudPage<T extends { id: number | string }>({
  title,
  description,
  table,
  select,
  order = { column: 'id' },
  fields,
  listColumns,
  canCreate = true,
  canEdit = allow,
  canDelete = canEdit,
  fixedValues,
  validate,
  pageSize,
  searchColumns,
  searchExtra,
  searchPlaceholder = 'Cari...',
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editId, setEditId] = useState<T['id'] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const initial = useRef(JSON.stringify(form));
  const inFlight = useRef<Promise<boolean> | null>(null);
  const { requestLeave } = useDraftGuard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});
  // picker 'list': pilihan di combobox dan baris yang disorot di listbox, per field
  const [pick, setPick] = useState<Record<string, string>>({});
  const [highlight, setHighlight] = useState<Record<string, string[]>>({});
  const [params, setParams] = useSearchParams();
  const page = readPage(params);
  const appliedKeyword = params.get('q') ?? '';
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState(appliedKeyword);
  const [saved, setSaved] = useState('');
  // nomor permintaan terakhir; jawaban dari permintaan lama diabaikan
  const requestId = useRef(0);

  const formFields = fields.filter((f) => !f.hideInForm);

  function setPage(value: number) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value > 1) next.set('page', String(value));
      else next.delete('page');
      return next;
    });
  }

  async function loadRows(keepRows = false) {
    const current = ++requestId.current;
    if (!keepRows) setLoading(true);
    let query = supabase.from(table).select(select, { count: pageSize ? 'exact' : undefined });
    if (appliedKeyword && searchColumns) {
      // tanda kutip & backslash dibuang agar tidak merusak sintaks filter .or()
      const q = appliedKeyword.replace(/["\\]/g, '');
      const conditions = [
        ...searchColumns.map((c) => `${c}.ilike."%${q}%"`),
        ...((await searchExtra?.(q)) ?? []),
      ];
      query = query.or(conditions.join(','));
    }
    for (const o of Array.isArray(order) ? order : [order]) {
      query = query.order(o.column, { ascending: o.ascending ?? true });
    }
    if (pageSize) query = query.range((page - 1) * pageSize, page * pageSize - 1);
    const { data, error, count } = await query;
    if (current !== requestId.current) return;

    // halaman melewati data terakhir (mis. setelah hapus): mundur satu halaman.
    // Supabase mengembalikan error PGRST103 untuk range di luar jumlah data.
    if (pageSize && page > 1 && (error?.code === 'PGRST103' || data?.length === 0)) {
      setPage(page - 1);
      return;
    }
    setError(error ? errorMessage(error) : null);
    setRows((data as unknown as T[] | null) ?? []);
    setTotal(count ?? data?.length ?? 0);
    setLoading(false);
  }

  async function loadOptions() {
    setOptionsLoading(true);
    setOptionsError('');
    try {
      const entries = await Promise.all(
      formFields
        .filter((f) => f.source)
        .map(async (f) => {
          const s = f.source!;
          const { data, error } = await supabase.from(s.table).select(s.select).order(s.order);
          if (error) throw error;
          const opts = (data ?? []).map((row: any) => ({ value: row.id, label: s.label(row) }));
          return [f.name, opts] as const;
        }),
    );
      setOptions(Object.fromEntries(entries));
    } catch {
      setOptionsError('Pilihan formulir gagal dimuat.');
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [page, appliedKeyword]);

  // pencarian dijalankan 400 ms setelah berhenti mengetik, dimulai dari halaman 1
  useEffect(() => { setKeyword(appliedKeyword); }, [appliedKeyword]);

  useEffect(() => {
    const value = keyword.trim();
    if (value === appliedKeyword) return;
    const timer = setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (value) next.set('q', value);
        else next.delete('q');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [keyword, appliedKeyword, setParams]);

  useEffect(() => {
    if (showForm) void loadOptions();
  }, [showForm]);

  // baris yang semua isiannya kosong tidak disimpan
  function toRows(f: Field<T>, rows: RowValues[]) {
    return rows
      .map((r) => Object.fromEntries(f.rowFields!.map((c) => [c.name, (r[c.name] ?? '').trim()])))
      .filter((r) => Object.values(r).some((v) => v !== ''));
  }

  function toValue(f: Field<T>, raw: string) {
    const value = raw.trim();
    if (value === '') return null;
    if (f.type === 'number' || f.source) {
      const n = Number(value);
      return Number.isNaN(n) ? null : n; // pilihan khusus (extraOptions) -> null
    }
    return value;
  }

  const isShown = (f: Field<T>) => !f.showIf || f.showIf(form);

  function fail(message: string) {
    setFormError(message);
    return false;
  }

  function save() {
    if (inFlight.current) return inFlight.current;
    if (optionsLoading || optionsError) return Promise.resolve(false);
    if (!formRef.current?.reportValidity()) return Promise.resolve(fail('Periksa isian wajib dan format nilai.'));
    setSaving(true);
    setFormError('');
    inFlight.current = saveForm()
      .catch(() => fail('Penyimpanan gagal. Periksa koneksi dan coba lagi.'))
      .finally(() => { inFlight.current = null; setSaving(false); });
    return inFlight.current;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void save();
  }

  async function saveForm() {
    const invalid = validate?.(form);
    if (invalid) return fail(invalid);
    const payload: Record<string, any> = {
      ...Object.fromEntries(
        formFields
          .filter((f) => f.type !== 'multiselect')
          .map((f) => [
            f.name,
            f.type === 'rows'
              ? toRows(f, form[f.name] as RowValues[])
              : isShown(f)
                ? toValue(f, form[f.name] as string)
                : null,
          ]),
      ),
      ...fixedValues,
    };

    let id = editId;
    if (editId != null) {
      const { error } = await supabase.from(table).update(payload).eq('id', editId);
      if (error) return fail(errorMessage(error));
    } else {
      const { data, error } = await supabase.from(table).insert(payload).select('id').single();
      if (error) return fail(errorMessage(error));
      id = data.id;
      // Jika relasi gagal, percobaan berikutnya melanjutkan rekaman yang sama.
      setEditId(id);
    }

    // simpan relasi banyak-ke-banyak: hapus yang tidak dipilih lagi, tambah yang baru dipilih.
    // Baris yang tetap dipilih tidak disentuh, sehingga hak akses yang bergantung pada
    // tabel penghubung (mis. dosen anggota boleh mengubah) tetap berlaku selama menyimpan.
    for (const f of formFields.filter((f) => f.junction)) {
      const j = f.junction!;
      const excluded = j.exclude ? form[j.exclude] : undefined;
      const values = (form[f.name] as string[]).filter((v) => v !== excluded);
      const existing = await supabase.from(j.table).select(j.valueKey).eq(j.foreignKey, id);
      if (existing.error) return fail(errorMessage(existing.error));
      const old = (existing.data as any[]).map((r) => String(r[j.valueKey]));

      const removed = old.filter((v) => !values.includes(v));
      if (removed.length > 0) {
        const del = await supabase
          .from(j.table)
          .delete()
          .eq(j.foreignKey, id)
          .in(j.valueKey, removed.map((v) => toValue(f, v)));
        if (del.error) return fail(errorMessage(del.error));
      }
      const added = values.filter((v) => !old.includes(v));
      if (added.length > 0) {
        const ins = await supabase
          .from(j.table)
          .insert(added.map((v) => ({ [j.foreignKey]: id, [j.valueKey]: toValue(f, v) })));
        if (ins.error) return fail(errorMessage(ins.error));
      }
    }

    setSaved('Data tersimpan.');
    resetForm();
    void loadRows(true);
    return true;
  }

  function openForm(values: FormValues, id: T['id'] | null) {
    setForm(values);
    initial.current = JSON.stringify(values);
    setEditId(id);
    setFormError('');
    setPick({});
    setHighlight({});
    setSearch({});
    setShowForm(true);
  }

  function handleEdit(row: T) {
    openForm(
      Object.fromEntries(
        formFields.map((f) => [
          f.name,
          f.type === 'multiselect'
            ? [...new Set([...(f.getValues?.(row) ?? []).map(String), ...(f.lockedValues ?? [])])]
            : f.type === 'rows'
              ? ((row[f.name] as RowValues[] | null) ?? []).map((r) =>
                  Object.fromEntries(f.rowFields!.map((c) => [c.name, String(r[c.name] ?? '')])),
                )
              : (f.getValue?.(row) ?? String(row[f.name] ?? '')),
        ]),
      ),
      row.id,
    );
  }

  async function handleDelete(id: T['id']) {
    if (!confirm(`Hapus data ${title.toLowerCase()} ini?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) setError(errorMessage(error));
    else loadRows();
  }

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setFormError('');
  }

  useUnsavedDraft({
    dirty: showForm && JSON.stringify(form) !== initial.current,
    saving,
    save,
    discard: resetForm,
  });

  function renderInput(f: Field<T>) {
    if (f.type === 'rows') {
      const list = form[f.name] as RowValues[];
      const cols = f.rowFields!;
      const setList = (next: RowValues[]) => setForm({ ...form, [f.name]: next });
      const blank = () => Object.fromEntries(cols.map((c) => [c.name, '']));
      return (
        <div className="row-list">
          {list.map((r, i) => (
            <div key={i} className="row-item">
              {cols.map((c) => (
                <input
                  key={c.name}
                  placeholder={c.label}
                  aria-label={`${c.label} ${i + 1}`}
                  value={r[c.name] ?? ''}
                  required={c.required}
                  onChange={(e) =>
                    setList(list.map((x, k) => (k === i ? { ...x, [c.name]: e.target.value } : x)))
                  }
                />
              ))}
              <button
                type="button"
                className="danger"
                aria-label={`Hapus baris ${i + 1}`}
                onClick={() => setList(list.filter((_, k) => k !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => setList([...list, blank()])}>
            + Tambah {f.label}
          </button>
        </div>
      );
    }

    if (f.type === 'multiselect' && f.picker === 'list') {
      const selected = form[f.name] as string[];
      const locked = f.lockedValues ?? [];
      const opts = options[f.name] ?? [];
      const labelOf = (v: string) => opts.find((o) => String(o.value) === v)?.label ?? v;
      const marked = (highlight[f.name] ?? []).filter((v) => selected.includes(v) && !locked.includes(v));
      const add = () => {
        const v = pick[f.name];
        if (!v || selected.includes(v)) return;
        setForm({ ...form, [f.name]: [...selected, v] });
        setPick({ ...pick, [f.name]: '' });
      };
      const remove = () => {
        setForm({ ...form, [f.name]: selected.filter((v) => !marked.includes(v)) });
        setHighlight({ ...highlight, [f.name]: [] });
      };
      return (
        <div className="picker">
          <div className="picker-add">
            <select
              aria-label={`Pilih ${f.label.toLowerCase()}`}
              value={pick[f.name] ?? ''}
              onChange={(e) => setPick({ ...pick, [f.name]: e.target.value })}
            >
              <option value="">-- Pilih dosen untuk ditambahkan --</option>
              {opts
                .filter((o) => !selected.includes(String(o.value)))
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
            <button type="button" className="secondary" disabled={!pick[f.name]} onClick={add}>
              Tambah
            </button>
          </div>
          <select
            multiple
            aria-label={f.label}
            className="picker-list"
            size={Math.min(Math.max(selected.length, 4), 10)}
            value={marked}
            onChange={(e) =>
              setHighlight({
                ...highlight,
                [f.name]: Array.from(e.target.selectedOptions, (o) => o.value),
              })
            }
          >
            {selected.map((v) => (
              <option key={v} value={v} disabled={locked.includes(v)}>
                {labelOf(v)}
                {locked.includes(v) ? ' (Anda)' : ''}
              </option>
            ))}
          </select>
          <div className="picker-actions">
            <span className="muted">{selected.length} dipilih</span>
            <button type="button" className="danger" disabled={marked.length === 0} onClick={remove}>
              Hapus{marked.length > 1 ? ` (${marked.length})` : ''}
            </button>
          </div>
        </div>
      );
    }

    if (f.type === 'multiselect') {
      const selected = form[f.name] as string[];
      const locked = f.lockedValues ?? [];
      const keyword = (search[f.name] ?? '').toLowerCase();
      const toggle = (v: string) =>
        setForm({
          ...form,
          [f.name]: selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v],
        });
      return (
        <div className="checklist-wrap">
          <input
            type="search"
            aria-label={`Cari ${f.label.toLowerCase()}`}
            placeholder={`Cari ${f.label.toLowerCase()}…`}
            value={search[f.name] ?? ''}
            onChange={(e) => setSearch({ ...search, [f.name]: e.target.value })}
          />
          <div className="checklist">
            {(options[f.name] ?? [])
              // yang sudah dipilih tetap tampil walaupun tidak cocok dengan pencarian
              .filter(
                (o) =>
                  o.label.toLowerCase().includes(keyword) || selected.includes(String(o.value)),
              )
              .map((o) => (
                <label key={o.value}>
                  <input
                    type="checkbox"
                    checked={selected.includes(String(o.value))}
                    disabled={locked.includes(String(o.value))}
                    onChange={() => toggle(String(o.value))}
                  />
                  {o.label}
                </label>
              ))}
          </div>
        </div>
      );
    }

    const common = {
      id: f.name,
      value: form[f.name] as string,
      required: f.required,
      onChange: (e: { target: { value: string } }) => setForm({ ...form, [f.name]: e.target.value }),
    };
    if (f.type === 'textarea') return <textarea rows={3} {...common} />;
    if (f.type === 'select')
      return (
        <select {...common}>
          <option value="">-- Pilih {f.label} --</option>
          {[
            ...(f.filterOptions
              ? f.filterOptions(f.options ?? options[f.name] ?? [], form)
              : (f.options ?? options[f.name] ?? [])),
            ...(f.extraOptions ?? []),
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    return <input type={f.type ?? 'text'} {...common} />;
  }

  const listedFields = fields.filter((field) => !field.hideInTable);
  const primary = listedFields.find((field) => field.name.startsWith('judul')) ?? listedFields[0];
  const displayOrder = listColumns ? [...listColumns.summary, listColumns.extra] : [primary?.name];
  const orderedFields = [
    ...displayOrder.flatMap((name) => listedFields.filter((field) => field.name === name)),
    ...listedFields.filter((field) => !displayOrder.includes(field.name)),
  ];
  const columns = orderedFields.map((field, index): ListColumn<T> => ({
    label: field.label,
    render: (row) => field.render ? field.render(row) : String(row[field.name] ?? '–'),
    visibility: listColumns?.summary.includes(field.name) || (!listColumns && index < 2) ? 'summary'
      : !listColumns || listColumns.extra === field.name ? 'desktop' : 'detail',
  }));

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {description && <p className="muted">{description}</p>}
        </div>
        {canCreate && (
          <button type="button" onClick={() => openForm(emptyForm(fields), null)}>
            Tambah {title.toLowerCase()}
          </button>
        )}
      </header>

      {searchColumns && (
        <div className="table-toolbar">
          <label className="field search-field">
            <span>Pencarian</span>
            <input type="search" className="search-input" placeholder={searchPlaceholder} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </label>
          {!loading && !error && <span className="muted small">{total} hasil</span>}
        </div>
      )}
      {saved && <p className="notice" role="status">{saved}</p>}
      <AsyncState
        error={error}
        loading={loading}
        empty={!rows.length ? (appliedKeyword ? 'Tidak ada hasil untuk pencarian ini.' : 'Belum ada data.') : undefined}
        onRetry={() => void loadRows()}
      />

      {!loading && (
        <ResponsiveList
          rows={rows}
          columns={columns}
          caption={title}
          actions={rows.some(canEdit) ? (row) => canEdit(row) && (
            <button type="button" className="secondary" onClick={() => handleEdit(row)}>Ubah</button>
          ) : undefined}
          detailActions={(row) => canDelete(row) && (
            <button type="button" className="danger" onClick={() => void handleDelete(row.id)}>Hapus</button>
          )}
        />
      )}
      {pageSize && total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />}

      {showForm && (
        <Dialog title={(editId === null ? 'Tambah ' : 'Ubah ') + title.toLowerCase()} className="editor-dialog" onClose={() => requestLeave(resetForm)}>
          <AsyncState loading={optionsLoading} error={optionsError} onRetry={() => void loadOptions()} />
          <form ref={formRef} onSubmit={handleSubmit} aria-busy={saving}>
            <fieldset className="form editor-form" disabled={saving}>
              {formFields.filter(isShown).map((f) => {
                const caption = <span>{f.label}{f.required && <em> *</em>}</span>;
                const wide = f.wide ? ' wide' : '';
                return f.type === 'rows' || f.type === 'multiselect'
                  ? <div key={f.name} className={'field' + wide} role="group" aria-label={f.label}>{caption}{renderInput(f)}</div>
                  : <label key={f.name} htmlFor={f.name} className={'field' + wide}>{caption}{renderInput(f)}</label>;
              })}
              {formError && <p className="error wide" role="alert">{formError}</p>}
              <div className="form-actions wrap">
                <button type="submit" disabled={saving || optionsLoading || !!optionsError}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
                <button type="button" className="secondary" onClick={() => requestLeave(resetForm)} disabled={saving}>Batal</button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </section>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  // tampilkan paling banyak 5 nomor halaman di sekitar halaman aktif
  const start = Math.max(1, Math.min(page - 2, lastPage - 4));
  const pages = Array.from({ length: Math.min(5, lastPage) }, (_, i) => start + i);

  return (
    <div className="pagination">
      <span>
        Menampilkan {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} dari {total}
      </span>
      <div className="pagination-buttons">
        <button className="secondary" disabled={page === 1} onClick={() => onChange(1)} aria-label="Halaman pertama">
          «
        </button>
        <button className="secondary" disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Halaman sebelumnya">
          ‹
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={p === page ? undefined : 'secondary'}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button className="secondary" disabled={page === lastPage} onClick={() => onChange(page + 1)} aria-label="Halaman berikutnya">
          ›
        </button>
        <button className="secondary" disabled={page === lastPage} onClick={() => onChange(lastPage)} aria-label="Halaman terakhir">
          »
        </button>
      </div>
    </div>
  );
}
