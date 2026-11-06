import { useEffect, useState } from 'react';
import { useProfile } from '../../auth';
import { loadMaster, masterLabel } from '../../haki/api';
import { JENIS_LABEL, STATUS_HKI_LABEL } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { HkiListRow, MasterItem } from '../../haki/types';
import { supabase } from '../../lib/supabase';

// HKI terarsip milik sendiri / dikonfirmasi sebagai pencipta; siap cetak atau simpan PDF
export default function HakiPortfolioPage() {
  const profile = useProfile();
  const [rows, setRows] = useState<HkiListRow[] | null>(null);
  const [master, setMaster] = useState<MasterItem[]>([]);

  useEffect(() => {
    loadMaster().then(setMaster);
    supabase
      .from('hki_record_list')
      .select('*')
      .eq('workflow_status', 'ARCHIVED')
      .order('tgl_permohonan', { ascending: false, nullsFirst: false })
      .then(({ data }) => setRows((data as HkiListRow[]) ?? []));
  }, []);

  return (
    <div className="page portfolio">
      <div className="page-header no-print">
        <div>
          <h1>Portofolio HKI</h1>
          <p className="muted">Dokumen terarsip yang Anda miliki atau Anda konfirmasi sebagai pencipta.</p>
        </div>
        <button onClick={() => window.print()}>Cetak / simpan PDF</button>
      </div>
      <div className="print-only">
        <h1>Portofolio Hak Kekayaan Intelektual</h1>
        <p>
          {profile.dosen?.nama} · dicetak {fmtDate(new Date().toISOString())}
        </p>
      </div>
      {!rows ? (
        <p>Memuat...</p>
      ) : rows.length === 0 ? (
        <p className="muted">Belum ada HKI terarsip.</p>
      ) : (
        <ol className="portfolio-list">
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{r.judul}</strong>
              <div>
                {r.jenis ? JENIS_LABEL[r.jenis] : '-'}
                {r.status_hki ? ` · ${STATUS_HKI_LABEL[r.status_hki]}` : ''}
                {r.no_sertifikat ? ` · No. ${r.no_sertifikat}` : ''}
                {r.no_permohonan ? ` · Permohonan ${r.no_permohonan}` : ''}
                {r.tgl_permohonan ? ` (${fmtDate(r.tgl_permohonan)})` : ''}
              </div>
              <div className="muted">
                Pencipta: {r.pencipta ?? '-'} · Pemegang: {r.pemegang ?? '-'}
                {r.berlaku_akhir ? ` · Berlaku s.d. ${fmtDate(r.berlaku_akhir)}` : ''}
                {r.sumber_dana ? ` · ${masterLabel(master, 'sumber_dana', r.sumber_dana)}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
