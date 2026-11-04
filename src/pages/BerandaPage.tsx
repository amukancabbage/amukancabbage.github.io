import { useEffect, useState } from 'react';
import { useProfile } from '../auth';
import { supabase } from '../lib/supabase';

// hasil fungsi SQL rekap_kegiatan (supabase/beranda.sql); prodi_id null = baris total
type Rekap = { prodi_id: number | null; prodi: string; penelitian: number; pengabdian: number };

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '–'}</div>
    </div>
  );
}

export default function BerandaPage() {
  const profile = useProfile();
  const [tahun, setTahun] = useState('');
  const [daftarTahun, setDaftarTahun] = useState<number[]>([]);
  const [rekap, setRekap] = useState<Rekap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('tahun_kegiatan').then(({ data }) => {
      setDaftarTahun(((data as { tahun: number }[] | null) ?? []).map((t) => t.tahun));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc('rekap_kegiatan', { p_tahun: tahun ? Number(tahun) : null })
      .then(({ data, error }) => {
        setError(error?.message ?? null);
        setRekap((data as Rekap[] | null) ?? []);
        setLoading(false);
      });
  }, [tahun]);

  const total = rekap.find((r) => r.prodi_id == null);
  const perProdi = rekap.filter((r) => r.prodi_id != null);
  const periode = tahun ? `Tahun ${tahun}` : 'Semua tahun';

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Beranda</h1>
          <p className="muted">Selamat datang, {profile.dosen?.nama ?? profile.email}.</p>
        </div>
        <label className="filter">
          <span>Tahun</span>
          <select value={tahun} onChange={(e) => setTahun(e.target.value)}>
            <option value="">Semua tahun</option>
            {daftarTahun.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <h2 className="section-title">Total · {periode}</h2>
      <div className="stats">
        <Stat label="Penelitian" value={loading ? undefined : total?.penelitian} />
        <Stat label="Pengabdian" value={loading ? undefined : total?.pengabdian} />
      </div>

      <h2 className="section-title">Per Program Studi · {periode}</h2>
      <div className="prodi-grid">
        {perProdi.map((r) => (
          <div key={r.prodi_id} className="card prodi-card">
            <h3>{r.prodi}</h3>
            <div className="stats">
              <Stat label="Penelitian" value={loading ? undefined : r.penelitian} />
              <Stat label="Pengabdian" value={loading ? undefined : r.pengabdian} />
            </div>
          </div>
        ))}
      </div>

      <p className="muted footnote">
        Kegiatan dihitung untuk sebuah prodi jika ketua atau salah satu anggota timnya adalah dosen
        prodi tersebut. Kegiatan dengan tim lintas prodi terhitung di setiap prodi yang terlibat,
        sedangkan total menghitungnya satu kali.
      </p>
    </section>
  );
}
