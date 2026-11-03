import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Dosen, Prodi } from '../types';

const emptyForm = { nama: '', nidn: '', prodi_id: '' };

export default function DosenPage() {
  const [dosen, setDosen] = useState<Dosen[]>([]);
  const [prodi, setProdi] = useState<Prodi[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [dosenRes, prodiRes] = await Promise.all([
      supabase
        .from('dosen')
        .select('id, nama, nidn, prodi_id, prodi(id, prodi)')
        .order('id'),
      supabase.from('prodi').select('id, prodi').order('prodi'),
    ]);
    setError(dosenRes.error?.message ?? prodiRes.error?.message ?? null);
    setDosen((dosenRes.data as Dosen[] | null) ?? []);
    setProdi(prodiRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      nama: form.nama.trim(),
      nidn: form.nidn.trim(),
      prodi_id: form.prodi_id ? Number(form.prodi_id) : null,
    };
    const { error } = editId
      ? await supabase.from('dosen').update(payload).eq('id', editId)
      : await supabase.from('dosen').insert(payload);
    if (error) {
      setError(error.message);
      return;
    }
    resetForm();
    loadData();
  }

  function handleEdit(d: Dosen) {
    setEditId(d.id);
    setForm({ nama: d.nama, nidn: d.nidn, prodi_id: d.prodi_id?.toString() ?? '' });
  }

  async function handleDelete(id: number) {
    if (!confirm('Hapus data dosen ini?')) return;
    const { error } = await supabase.from('dosen').delete().eq('id', id);
    if (error) setError(error.message);
    else loadData();
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
  }

  return (
    <section className="page">
      <h1>Data Dosen</h1>

      <form className="form" onSubmit={handleSubmit}>
        <input
          placeholder="Nama"
          value={form.nama}
          onChange={(e) => setForm({ ...form, nama: e.target.value })}
          required
        />
        <input
          placeholder="NIDN"
          value={form.nidn}
          onChange={(e) => setForm({ ...form, nidn: e.target.value })}
          required
        />
        <select
          value={form.prodi_id}
          onChange={(e) => setForm({ ...form, prodi_id: e.target.value })}
          required
        >
          <option value="">-- Pilih Prodi --</option>
          {prodi.map((p) => (
            <option key={p.id} value={p.id}>
              {p.prodi}
            </option>
          ))}
        </select>
        <button type="submit">{editId ? 'Simpan' : 'Tambah'}</button>
        {editId && (
          <button type="button" className="secondary" onClick={resetForm}>
            Batal
          </button>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Memuat...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama</th>
                <th>NIDN</th>
                <th>Prodi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {dosen.length === 0 ? (
                <tr>
                  <td colSpan={5}>Belum ada data</td>
                </tr>
              ) : (
                dosen.map((d) => (
                  <tr key={d.id}>
                    <td>{d.id}</td>
                    <td>{d.nama}</td>
                    <td>{d.nidn}</td>
                    <td>{d.prodi?.prodi ?? '-'}</td>
                    <td className="actions">
                      <button className="secondary" onClick={() => handleEdit(d)}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => handleDelete(d.id)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
