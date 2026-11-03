import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Prodi } from '../types';

export default function ProdiPage() {
  const [prodi, setProdi] = useState<Prodi[]>([]);
  const [nama, setNama] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase.from('prodi').select('id, prodi').order('id');
    setError(error?.message ?? null);
    setProdi(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = { prodi: nama.trim() };
    const { error } = editId
      ? await supabase.from('prodi').update(payload).eq('id', editId)
      : await supabase.from('prodi').insert(payload);
    if (error) {
      setError(error.message);
      return;
    }
    resetForm();
    loadData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Hapus prodi ini?')) return;
    const { error } = await supabase.from('prodi').delete().eq('id', id);
    // 23503 = foreign key violation (masih dipakai oleh dosen)
    if (error?.code === '23503') setError('Prodi masih dipakai oleh data dosen.');
    else if (error) setError(error.message);
    else loadData();
  }

  function resetForm() {
    setEditId(null);
    setNama('');
  }

  return (
    <section className="page">
      <h1>Data Prodi</h1>

      <form className="form" onSubmit={handleSubmit}>
        <input
          placeholder="Nama Prodi"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          required
        />
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
                <th>Prodi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {prodi.length === 0 ? (
                <tr>
                  <td colSpan={3}>Belum ada data</td>
                </tr>
              ) : (
                prodi.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.prodi}</td>
                    <td className="actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditId(p.id);
                          setNama(p.prodi);
                        }}
                      >
                        Edit
                      </button>
                      <button className="danger" onClick={() => handleDelete(p.id)}>
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
