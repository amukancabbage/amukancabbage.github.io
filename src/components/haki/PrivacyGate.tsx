import { useState, type ReactNode } from 'react';
import { useAuth, useProfile } from '../../auth';
import { errorText, rpc } from '../../haki/api';

// pemberitahuan privasi wajib disetujui sebelum unggah
export default function PrivacyGate({ children }: { children: ReactNode }) {
  const profile = useProfile();
  const { refreshProfile } = useAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile.privacy_notice_accepted_at) return <>{children}</>;

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await rpc('hki_accept_privacy');
      await refreshProfile();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card privacy">
      <h2>Pemberitahuan Privasi</h2>
      <p>
        Dokumen HKI yang Anda unggah berisi data pribadi (nama, alamat, kewarganegaraan pencipta dan pemegang hak).
        Data disimpan di penyimpanan privat institusi dan hanya dapat dibuka oleh pemilik, operator unit, validator
        berwenang, serta pencipta yang telah mengonfirmasi keterlibatannya.
      </p>
      <p>
        Jika pembacaan otomatis (AI) diaktifkan admin, gambar halaman dan teks dokumen dikirim ke penyedia model AI
        pihak ketiga untuk diekstrak. Hasilnya tetap harus Anda periksa sebelum diajukan.
      </p>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        Saya memahami dan menyetujui pemrosesan data di atas.
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={!checked || busy} onClick={accept}>
        {busy ? 'Menyimpan...' : 'Setuju dan lanjutkan'}
      </button>
    </div>
  );
}
