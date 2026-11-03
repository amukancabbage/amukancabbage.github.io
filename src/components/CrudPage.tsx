import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

type Option = { value: number; label: string };

export type Field<T> = {
  name: keyof T & string;
  label: string;
  type?: 'text' | 'number' | 'url' | 'textarea' | 'select';
  required?: boolean;
  // lebar penuh di form
  wide?: boolean;
  // untuk type 'select': pilihan diambil dari tabel lain
  source?: { table: string; select: string; order: string; label: (row: any) => string };
  // tampilan kolom di tabel; default menampilkan nilai field apa adanya
  render?: (row: T) => ReactNode;
  hideInTable?: boolean;
};

type Props<T> = {
  title: string;
  table: string;
  select: string;
  order?: { column: string; ascending?: boolean };
  fields: Field<T>[];
};

function emptyForm<T>(fields: Field<T>[]) {
  return Object.fromEntries(fields.map((f) => [f.name, ''])) as Record<string, string>;
}

function errorMessage(error: { code?: string; message: string }) {
  if (error.code === '23503') return 'Data masih dipakai oleh data lain, tidak bisa dihapus.';
  if (error.code === '23505') return 'Data sudah ada (duplikat).';
  return error.message;
}

export default function CrudPage<T extends { id: number }>({
  title,
  table,
  select,
  order = { column: 'id' },
  fields,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [form, setForm] = useState(() => emptyForm(fields));
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      fields
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = Object.fromEntries(
      fields.map((f) => {
        const value = form[f.name].trim();
        if (value === '') return [f.name, null];
        return [f.name, f.type === 'number' || f.type === 'select' ? Number(value) : value];
      }),
    ) as Record<string, any>;
    const { error } = editId
      ? await supabase.from(table).update(payload).eq('id', editId)
      : await supabase.from(table).insert(payload);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    resetForm();
    loadRows();
  }

  function handleEdit(row: T) {
    setEditId(row.id);
    setForm(Object.fromEntries(fields.map((f) => [f.name, String(row[f.name] ?? '')])));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id: number) {
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
    const common = {
      id: f.name,
      value: form[f.name],
      required: f.required,
      onChange: (e: { target: { value: string } }) => setForm({ ...form, [f.name]: e.target.value }),
    };
    if (f.type === 'textarea') return <textarea rows={3} {...common} />;
    if (f.type === 'select')
      return (
        <select {...common}>
          <option value="">-- Pilih {f.label} --</option>
          {(options[f.name] ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    return <input type={f.type ?? 'text'} {...common} />;
  }

  const columns = fields.filter((f) => !f.hideInTable);

  return (
    <section className="page">
      <h1>{title}</h1>

      <form className="card form" onSubmit={handleSubmit}>
        {fields.map((f) => (
          <label key={f.name} htmlFor={f.name} className={f.wide ? 'wide' : undefined}>
            <span>
              {f.label}
              {f.required && <em> *</em>}
            </span>
            {renderInput(f)}
          </label>
        ))}
        <div className="form-actions">
          <button type="submit">{editId ? 'Simpan Perubahan' : 'Tambah'}</button>
          {editId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Batal
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              {columns.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 2}>Memuat...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2}>Belum ada data</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  {columns.map((f) => (
                    <td key={f.name}>{f.render ? f.render(row) : String(row[f.name] ?? '-')}</td>
                  ))}
                  <td className="actions">
                    <button className="secondary" onClick={() => handleEdit(row)}>
                      Edit
                    </button>
                    <button className="danger" onClick={() => handleDelete(row.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
