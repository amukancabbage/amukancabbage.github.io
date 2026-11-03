import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type Option = { value: number | string; label: string };
export type FormValues = Record<string, string | string[]>;

export type Field<T> = {
  name: keyof T & string;
  label: string;
  type?: 'text' | 'number' | 'url' | 'textarea' | 'select' | 'multiselect';
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
  // tampilan kolom di tabel; default menampilkan nilai field apa adanya
  render?: (row: T) => ReactNode;
  hideInTable?: boolean;
  hideInForm?: boolean;
};

type Props<T> = {
  title: string;
  // keterangan singkat di bawah judul
  description?: ReactNode;
  table: string;
  select: string;
  order?: { column: string; ascending?: boolean };
  fields: Field<T>[];
  // hak akses; default semua diizinkan
  canCreate?: boolean;
  canEdit?: (row: T) => boolean;
  canDelete?: (row: T) => boolean;
  // nilai yang selalu ikut disimpan, mis. dosen_id milik dosen yang login
  fixedValues?: Record<string, unknown>;
  // pemeriksaan sebelum menyimpan; kembalikan pesan error atau null
  validate?: (form: FormValues) => string | null;
};

function emptyForm<T>(fields: Field<T>[]): FormValues {
  return Object.fromEntries(
    fields.map((f) => [f.name, f.type === 'multiselect' ? [...(f.lockedValues ?? [])] : '']),
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
  canCreate = true,
  canEdit = allow,
  canDelete = canEdit,
  fixedValues,
  validate,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editId, setEditId] = useState<T['id'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<Record<string, string>>({});

  const formFields = fields.filter((f) => !f.hideInForm);

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order.column, { ascending: order.ascending ?? true });
    setError(error ? errorMessage(error) : null);
    setRows((data as unknown as T[] | null) ?? []);
    setLoading(false);
  }

  async function loadOptions() {
    const entries = await Promise.all(
      formFields
        .filter((f) => f.source)
        .map(async (f) => {
          const s = f.source!;
          const { data } = await supabase.from(s.table).select(s.select).order(s.order);
          const opts = (data ?? []).map((row: any) => ({ value: row.id, label: s.label(row) }));
          return [f.name, opts] as const;
        }),
    );
    setOptions(Object.fromEntries(entries));
  }

  useEffect(() => {
    loadRows();
    loadOptions();
  }, []);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const invalid = validate?.(form);
    if (invalid) return setError(invalid);
    const payload: Record<string, any> = {
      ...Object.fromEntries(
        formFields
          .filter((f) => f.type !== 'multiselect')
          .map((f) => [f.name, isShown(f) ? toValue(f, form[f.name] as string) : null]),
      ),
      ...fixedValues,
    };

    let id = editId;
    if (editId != null) {
      const { error } = await supabase.from(table).update(payload).eq('id', editId);
      if (error) return setError(errorMessage(error));
    } else {
      const { data, error } = await supabase.from(table).insert(payload).select('id').single();
      if (error) return setError(errorMessage(error));
      id = data.id;
    }

    // simpan relasi banyak-ke-banyak: hapus yang lama, masukkan yang baru
    for (const f of formFields.filter((f) => f.junction)) {
      const j = f.junction!;
      const del = await supabase.from(j.table).delete().eq(j.foreignKey, id);
      if (del.error) return setError(errorMessage(del.error));
      const excluded = j.exclude ? form[j.exclude] : undefined;
      const values = (form[f.name] as string[]).filter((v) => v !== excluded);
      if (values.length === 0) continue;
      const ins = await supabase
        .from(j.table)
        .insert(values.map((v) => ({ [j.foreignKey]: id, [j.valueKey]: toValue(f, v) })));
      if (ins.error) return setError(errorMessage(ins.error));
    }

    setError(null);
    resetForm();
    loadRows();
  }

  function handleEdit(row: T) {
    setEditId(row.id);
    setForm(
      Object.fromEntries(
        formFields.map((f) => [
          f.name,
          f.type === 'multiselect'
            ? [...new Set([...(f.getValues?.(row) ?? []).map(String), ...(f.lockedValues ?? [])])]
            : (f.getValue?.(row) ?? String(row[f.name] ?? '')),
        ]),
      ),
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: T['id']) {
    if (!confirm(`Hapus data ${title.toLowerCase()} ini?`)) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) setError(errorMessage(error));
    else loadRows();
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm(fields));
  }

  function renderInput(f: Field<T>) {
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
            placeholder={`Cari ${f.label.toLowerCase()}... (${selected.length} dipilih)`}
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

  const columns = fields.filter((f) => !f.hideInTable);
  const showForm = canCreate || editId != null;
  const showActions = rows.some((r) => canEdit(r) || canDelete(r));
  const colSpan = columns.length + (showActions ? 2 : 1);

  return (
    <section className="page">
      <h1>{title}</h1>
      {description && <p className="notice">{description}</p>}

      {showForm && (
        <form className="card form" onSubmit={handleSubmit}>
          {formFields.filter(isShown).map((f) => (
            <label
              key={f.name}
              htmlFor={f.type === 'multiselect' ? undefined : f.name}
              className={f.wide ? 'wide' : undefined}
            >
              <span>
                {f.label}
                {f.required && <em> *</em>}
              </span>
              {renderInput(f)}
            </label>
          ))}
          <div className="form-actions">
            <button type="submit">{editId != null ? 'Simpan Perubahan' : 'Tambah'}</button>
            {editId != null && (
              <button type="button" className="secondary" onClick={resetForm}>
                Batal
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              {columns.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
              {showActions && <th>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan}>Memuat...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>Belum ada data</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id}>
                  <td>{i + 1}</td>
                  {columns.map((f) => (
                    <td key={f.name}>{f.render ? f.render(row) : String(row[f.name] ?? '-')}</td>
                  ))}
                  {showActions && (
                    <td className="actions">
                      {canEdit(row) && (
                        <button className="secondary" onClick={() => handleEdit(row)}>
                          Edit
                        </button>
                      )}
                      {canDelete(row) && (
                        <button className="danger" onClick={() => handleDelete(row.id)}>
                          Hapus
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
