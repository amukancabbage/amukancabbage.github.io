import { Plus, Save, Search, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { readListPage, readListSort, useListParams, type ListSorts } from '../lib/pagination';
import { contains, loadChoiceLabels, searchChoices, textCondition, type Choice, type ChoiceSource } from '../lib/search';
import { supabase } from '../lib/supabase';
import AppIcon, { IconLabel } from './AppIcon';
import AsyncState from './AsyncState';
import DeleteDialog from './DeleteDialog';
import Dialog from './Dialog';
import { useDraftGuard, useUnsavedDraft } from './DraftGuard';
import ListFilter, { validFilter, type FilterField } from './ListFilter';
import ListSort from './ListSort';
import ResponsiveList, { type ListColumn } from './ResponsiveList';
import SearchSelect from './SearchSelect';

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
  source?: ChoiceSource;
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
  // jumlah baris bawaan per halaman
  pageSize?: number;
  // kolom teks yang dicari (ilike); jika diisi, muncul kotak pencarian di atas tabel
  searchColumns?: string[];
  // embed terpisah untuk pencarian supaya data relasi yang ditampilkan tetap lengkap
  searchRelations?: { select: string; column: string; match: string }[];
  listFilter?: FilterField;
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
const yearFilter: FilterField = { kind: 'year', param: 'tahun', column: 'tahun', label: 'Tahun' };

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
  pageSize: defaultSize = 10,
  searchColumns,
  searchRelations = [],
  listFilter,
  searchPlaceholder = 'Cari...',
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [labels, setLabels] = useState<Record<string, Record<string, Choice>>>({});
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editId, setEditId] = useState<T['id'] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  const optionRequest = useRef<AbortController | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const initial = useRef(JSON.stringify(form));
  const inFlight = useRef<Promise<boolean> | null>(null);
  const { requestLeave } = useDraftGuard();
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const list = useListParams(defaultSize);
  const { params, page, pageSize, update } = list;
  const appliedKeyword = params.get('q') ?? '';
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState(appliedKeyword);
  const [saved, setSaved] = useState('');
  const key = table + ':' + params.toString();
  const loading = loadedKey !== key;
  const formFields = fields.filter((f) => !f.hideInForm);
  const listedFields = fields.filter((field) => !field.hideInTable);
  const primary = listedFields.find((field) => field.name.startsWith('judul')) ?? listedFields[0];
  const columnsToSearch = searchColumns ?? [primary.name];
  const hasYear = fields.some((field) => field.name === 'tahun');
  const filter = listFilter ?? (hasYear ? yearFilter : undefined);
  const filterValue = filter ? params.get(filter.param) ?? '' : '';
  const sorts: ListSorts = {
    [primary.name.startsWith('judul') ? 'judul' : primary.name]: { column: primary.name, label: primary.label, ascending: true },
    ...(hasYear ? { tahun: { column: 'tahun', label: 'Tahun', ascending: false, chronological: true } } : {}),
  };
  const selectedOrder = readListSort(params, sorts);
  const orders = selectedOrder ? [selectedOrder] : Array.isArray(order) ? order : [order];

  const loadRows = useEffectEvent(async (signal: AbortSignal) => {
    function build(head = false) {
      const q = appliedKeyword.trim();
      const relations = q ? searchRelations : [];
      const projection = [head ? 'id' : select, ...relations.map((relation) => relation.select)].join(',');
      let query = supabase.from(table).select(projection, { count: 'exact', head });
      if (filter && validFilter(filter, filterValue)) query = query.eq(filter.column, filterValue);
      if (q) {
        for (const relation of relations) query = query.ilike(relation.column, contains(q));
        const conditions = [...columnsToSearch.map((column) => textCondition(column, q)), ...relations.map(({ match }) => match + '.not.is.null')];
        if (hasYear && /^\d{4}$/.test(q)) conditions.push('tahun.eq.' + q);
        query = query.or(conditions.join(','));
      }
      for (const item of orders) query = query.order(item.column, { ascending: item.ascending ?? true, nullsFirst: false });
      if (!orders.some((item) => item.column === 'id')) query = query.order('id');
      return query.abortSignal(signal);
    }
    try {
      const result = await readListPage<T>(page, pageSize,
        (from, to) => build().range(from, to).overrideTypes<T[], { merge: false }>(), () => build(true));
      if (signal.aborted) return;
      setTotal(result.total);
      if (result.page !== page) {
        setLoadedKey(null);
        list.setPage(result.page, true);
        return;
      }
      setRows(result.rows);
      setError(null);
    } catch (reason) {
      if (signal.aborted) return;
      setError(reason && typeof reason === 'object' && 'message' in reason
        ? errorMessage(reason as { message: string; code?: string }) : 'Data gagal dimuat.');
    }
    setLoadedKey(key);
  });

  async function loadOptions(values: FormValues) {
    optionRequest.current?.abort();
    const controller = new AbortController();
    optionRequest.current = controller;
    const sources = new Map<string, { source: ChoiceSource; ids: Set<string> }>();
    for (const field of formFields) {
      if (!field.source) continue;
      const { table } = field.source;
      const value = values[field.name];
      const ids = (Array.isArray(value) ? value : [value]).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id));
      if (!ids.length) continue;
      const entry = sources.get(table) ?? { source: field.source, ids: new Set<string>() };
      ids.forEach((id) => entry.ids.add(id));
      sources.set(table, entry);
    }
    setOptionsError('');
    if (!sources.size) { setOptionsLoading(false); return; }
    setOptionsLoading(true);
    try {
      const entries = await Promise.all([...sources].map(async ([table, { source, ids }]) =>
        [table, await loadChoiceLabels(source, [...ids], controller.signal)] as const));
      if (controller.signal.aborted) return;
      setLabels((current) => {
        const next = { ...current };
        for (const [table, items] of entries) {
          const resolved = Object.fromEntries(items.map((item) => [item.value, item]));
          next[table] = { ...resolved, ...current[table] };
        }
        return next;
      });
    } catch {
      if (!controller.signal.aborted) setOptionsError('Label pilihan tersimpan gagal dimuat.');
    } finally {
      if (!controller.signal.aborted) setOptionsLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadRows(controller.signal);
    return () => controller.abort();
  }, [key, reload]);

  useEffect(() => () => optionRequest.current?.abort(), []);

  // pencarian dijalankan 400 ms setelah berhenti mengetik, dimulai dari halaman 1
  useEffect(() => { setKeyword(appliedKeyword); }, [appliedKeyword]);

  useEffect(() => {
    const value = keyword.trim();
    if (value === appliedKeyword) return;
    const timer = setTimeout(() => {
      update({ q: value }, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [keyword, appliedKeyword, update]);

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
    if (!formRef.current?.reportValidity()) return Promise.resolve(fail('Periksa isian wajib dan format nilai.'));
    const missing = formFields.find((field) => field.source && field.required && isShown(field) && !form[field.name]);
    if (missing) {
      document.getElementById(missing.name)?.focus();
      return Promise.resolve(fail('Pilih ' + missing.label.toLocaleLowerCase('id') + ' dari daftar.'));
    }
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
    setReload((value) => value + 1);
    return true;
  }

  function openForm(values: FormValues, id: T['id'] | null) {
    setForm(values);
    initial.current = JSON.stringify(values);
    setEditId(id);
    setFormError('');
    setLabels({});
    setShowForm(true);
    void loadOptions(values);
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
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw new Error(errorMessage(error));
    setReload((value) => value + 1);
  }

  function resetForm() {
    optionRequest.current?.abort();
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

  function remember(source: ChoiceSource, choice: Choice) {
    setLabels((current) => ({
      ...current, [source.table]: { ...current[source.table], [choice.value]: choice },
    }));
  }

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
                <AppIcon icon={Trash2} />
              </button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => setList([...list, blank()])}>
            <IconLabel icon={Plus}>Tambah {f.label}</IconLabel>
          </button>
        </div>
      );
    }

    if (f.type === 'multiselect' && f.source) {
      const source = f.source;
      const selected = form[f.name] as string[];
      const labelFor = (value: string) => labels[source.table]?.[value]?.label ?? 'Dosen ' + value;
      function remove(value: string) {
        const next = { ...form, [f.name]: selected.filter((id) => id !== value) };
        const leader = f.junction?.exclude;
        if (leader && next[leader] === value) {
          next[leader] = '';
          setFormError('Pilih kembali ketua dari anggota tim atau gunakan opsi ketua luar.');
        }
        setForm(next);
        document.getElementById('add-' + f.name)?.focus();
      }
      return (
        <div className="picker">
          <SearchSelect id={'add-' + f.name} label={'Cari dosen untuk ' + f.label.toLocaleLowerCase('id')}
            placeholder="Ketik nama dosen" disabled={saving} omit={selected}
            lookup={(term, signal) => searchChoices(source, term, signal)}
            onPick={(item) => {
              if (!item || selected.includes(item.value)) return;
              remember(source, item);
              setForm({ ...form, [f.name]: [...selected, item.value] });
            }} />
          {selected.length > 0 && (
            <ul className="member-list" aria-label={f.label + ' terpilih'} role="list">
              {selected.map((value) => (
                <li key={value}>
                  <span>{labelFor(value)}</span>
                  {f.lockedValues?.includes(value)
                    ? <span className="member-locked">Anda</span>
                    : <button type="button" className="secondary" aria-label={'Hapus ' + labelFor(value)}
                        onClick={() => remove(value)}><AppIcon icon={Trash2} /></button>}
                </li>
              ))}
            </ul>
          )}
          <span className="muted small" aria-live="polite">{selected.length} anggota dipilih</span>
        </div>
      );
    }

    if (f.type === 'select' && f.source) {
      const source = f.source;
      const known = labels[source.table] ?? {};
      const extra = (f.extraOptions ?? []).map((item) => ({ ...item, value: String(item.value) }));
      const options: Choice[] = f.filterOptions
        ? [...f.filterOptions(Object.values(known), form).map((item) => ({ ...item, value: String(item.value) })), ...extra]
        : extra;
      const value = form[f.name] as string;
      const selected = value ? (known[value] ?? options.find((item) => item.value === value) ?? { value, label: 'Pilihan tersimpan ' + value }) : null;
      return <SearchSelect id={f.name} label={f.label} selected={selected} items={options} disabled={saving}
        placeholder={f.filterOptions ? 'Pilih ' + f.label.toLocaleLowerCase('id') : 'Cari ' + f.label.toLocaleLowerCase('id')}
        lookup={f.filterOptions ? undefined : (term, signal) => searchChoices(source, term, signal)}
        clearable={!f.required} required={f.required}
        onPick={(item) => {
          if (item) remember(source, item);
          setForm({ ...form, [f.name]: item?.value ?? '' });
          setFormError('');
        }} />;
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
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    return <input type={f.type ?? 'text'} {...common} />;
  }

  const displayOrder = listColumns ? [...listColumns.summary, listColumns.extra] : [primary?.name];
  const orderedFields = [
    ...displayOrder.flatMap((name) => listedFields.filter((field) => field.name === name)),
    ...listedFields.filter((field) => !displayOrder.includes(field.name)),
  ];
  const columns = orderedFields.map((field, index): ListColumn<T> => ({
    id: field.name === 'id' ? undefined : field.name,
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
            <IconLabel icon={Plus}>Tambah {title.toLowerCase()}</IconLabel>
          </button>
        )}
      </header>

      <div className="table-toolbar list-toolbar">
          <label className="field search-field">
            <IconLabel icon={Search}>Pencarian</IconLabel>
            <input type="search" className="search-input" placeholder={searchPlaceholder} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </label>
          {filter && <ListFilter field={filter} value={validFilter(filter, filterValue) ? filterValue : ''}
            onChange={(value) => update({ [filter.param]: value })} />}
          <ListSort list={list} choices={sorts} />
      </div>
      {saved && <p className="notice" role="status">{saved}</p>}
      <AsyncState
        error={loading ? null : error}
        loading={loading}
        empty={!rows.length ? (appliedKeyword || filterValue ? 'Tidak ada hasil untuk filter ini.' : 'Belum ada data.') : undefined}
        onRetry={() => { setLoadedKey(null); setReload((value) => value + 1); }}
      />

      <ResponsiveList
          rows={rows}
          columns={columns}
          caption={title}
          list={list} total={total} order={orders[0]} pending={loading} failed={!!error}
          actions={rows.some(canEdit) ? (row) => canEdit(row) && (
            <button type="button" className="secondary" onClick={() => handleEdit(row)}><IconLabel icon={SquarePen}>Ubah</IconLabel></button>
          ) : undefined}
          detailActions={(row) => canDelete(row) && (
            <button type="button" className="danger" onClick={() => setDeleting(row)}><IconLabel icon={Trash2}>Hapus</IconLabel></button>
          )}
      />
      {deleting && <DeleteDialog name={String(deleting[primary.name] ?? title.toLocaleLowerCase('id'))}
        remove={() => handleDelete(deleting.id)} onClose={() => setDeleting(null)} />}

      {showForm && (
        <Dialog title={(editId === null ? 'Tambah ' : 'Ubah ') + title.toLowerCase()} className="editor-dialog" onClose={() => requestLeave(resetForm)}>
          <AsyncState loading={optionsLoading} error={optionsError} onRetry={() => void loadOptions(form)} />
          <form ref={formRef} onSubmit={handleSubmit} aria-busy={saving}>
            <fieldset className="form editor-form" disabled={saving}>
              {formFields.filter(isShown).map((f) => {
                const caption = <span>{f.label}{f.required && <em> *</em>}</span>;
                const wide = f.wide ? ' wide' : '';
                return f.type === 'rows' || f.type === 'multiselect'
                  ? <div key={f.name} className={'field' + wide} role="group" aria-label={f.label}>{caption}{renderInput(f)}</div>
                  : <div key={f.name} className={'field' + wide}><label htmlFor={f.name}>{caption}</label>{renderInput(f)}</div>;
              })}
              {formError && <p className="error wide" role="alert">{formError}</p>}
              <div className="form-actions wrap">
                <button type="submit" disabled={saving}><IconLabel icon={Save}>{saving ? 'Menyimpan…' : 'Simpan'}</IconLabel></button>
                <button type="button" className="secondary" onClick={() => requestLeave(resetForm)} disabled={saving}>Batal</button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </section>
  );
}
