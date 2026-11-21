import { useProfile } from '../../auth';
import AsyncState from '../../components/AsyncState';
import { loadMaster, masterLabel, toHakiError } from '../../haki/api';
import { JENIS_LABEL, STATUS_HKI_LABEL } from '../../haki/constants';
import { fmtDate } from '../../haki/format';
import type { HkiListRow } from '../../haki/types';
import { supabase } from '../../lib/supabase';
import { useRemoteData } from '../../lib/useRemoteData';

// HKI terarsip milik sendiri / dikonfirmasi sebagai pencipta; siap cetak atau simpan PDF
export default function HakiPortfolioPage() {
  const profile = useProfile();
  const remote = useRemoteData(async () => {
    const [master, result] = await Promise.all([
      loadMaster(),
      supabase.from('hki_record_list').select('*').eq('workflow_status', 'ARCHIVED')
        .order('tgl_permohonan', { ascending: false, nullsFirst: false }),
    ]);
    if (result.error) throw toHakiError(result.error);
    return { master, rows: (result.data as HkiListRow[]) ?? [] };
  });
  const rows = remote.data?.rows;
  const master = remote.data?.master ?? [];

  return (
    <div className="page portfolio">
      <div className="page-header no-print">
        <div>
          <h1>Portofolio HKI</h1>
          <p className="muted">Dokumen terarsip yang Anda miliki atau Anda konfirmasi sebagai pencipta.</p>
        </div>
        <button onClick={() => window.print()} disabled={!rows?.length}>Cetak / simpan PDF</button>
      </div>
      <div className="print-only">
        <h1>Portofolio Hak Kekayaan Intelektual</h1>
        <p>
          {profile.dosen?.nama} · dicetak {fmtDate(new Date().toISOString())}
        </p>
      </div>
      <AsyncState loading={remote.loading} error={remote.error} onRetry={remote.retry} empty={rows?.length === 0 ? 'Belum ada HKI terarsip.' : undefined} />
      {!!rows?.length && (
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
