import { useEffect, useRef, useState } from 'react';
import { downloadBlob, errorText, rpc } from '../../haki/api';
import { fmtBytes } from '../../haki/format';
import type { HkiFile } from '../../haki/types';
import { attachFile } from '../../haki/upload';

type Props = {
  recordId: string;
  files: HkiFile[];
  canUpload: boolean;
  jumpPage: number | null;
  onChanged: () => void;
};

// pratinjau berkas: gambar halaman (JPEG) untuk ponsel, PDF asli tetap bisa dibuka
export default function RecordViewer({ recordId, files, canUpload, jumpPage, onChanged }: Props) {
  const [fileId, setFileId] = useState<string | null>(files[0]?.id ?? null);
  const [pageIdx, setPageIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logged = useRef(new Set<string>());
  const input = useRef<HTMLInputElement>(null);

  const file = files.find((f) => f.id === fileId) ?? files[0];
  const pages = file?.prep?.pages ?? [];
  const pageNumbers: number[] = (file?.prep as { page_numbers?: number[] })?.page_numbers ?? pages.map((_, i) => i + 1);

  useEffect(() => {
    if (!fileId && files[0]) setFileId(files[0].id);
  }, [files, fileId]);

  useEffect(() => {
    if (jumpPage == null || !file) return;
    const idx = pageNumbers.indexOf(jumpPage);
    if (idx >= 0) setPageIdx(idx);
  }, [jumpPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!file) return;
    let url: string | null = null;
    let alive = true;
    const path = pages.length > 0 ? pages[Math.min(pageIdx, pages.length - 1)] : file.mime.startsWith('image/') ? file.storage_path : null;
    setSrc(null);
    setError(null);
    if (!logged.current.has(file.id)) {
      logged.current.add(file.id);
      rpc('hki_log', { p_aksi: 'file.view', p_record: recordId, p_detail: { file_id: file.id } }).catch(() => undefined);
    }
    if (!path) return;
    downloadBlob(path)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file?.id, pageIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openOriginal() {
    if (!file) return;
    try {
      const blob = await downloadBlob(file.storage_path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function addAttachment(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const { prepareFile } = await import('../../haki/pdfPrep');
      const prep = await prepareFile(f);
      await attachFile(recordId, prep);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(f: HkiFile) {
    if (!confirm(`Hapus lampiran "${f.nama_asli}"?`)) return;
    try {
      await rpc<string>('hki_delete_file', { p_file: f.id });
      setFileId(null);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="card viewer">
      <div className="card-head">
        <h2>Berkas</h2>
        {canUpload && (
          <>
            <button className="secondary" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? 'Mengunggah...' : files.length === 0 ? 'Unggah berkas utama' : 'Tambah lampiran'}
            </button>
            <input
              ref={input}
              type="file"
              hidden
              accept="application/pdf,image/jpeg,image/png,image/heic,.heic"
              onChange={(e) => {
                addAttachment(e.target.files);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>
      {error && <p className="error pad">{error}</p>}
      {files.length === 0 ? (
        <p className="muted pad">Belum ada berkas.</p>
      ) : (
        <>
          <div className="file-tabs">
            {files.map((f) => (
              <span key={f.id} className={`file-tab${f.id === file?.id ? ' active' : ''}`}>
                <button
                  className="link-button"
                  onClick={() => {
                    setFileId(f.id);
                    setPageIdx(0);
                  }}
                >
                  {f.jenis === 'utama' ? 'Utama' : 'Lampiran'}: {f.nama_asli}
                </button>
                <span className="muted small"> {fmtBytes(f.ukuran)}</span>
                {canUpload && f.jenis === 'lampiran' && (
                  <button className="link-button danger-text" onClick={() => removeFile(f)} aria-label="Hapus lampiran">
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          <div className="viewer-tools">
            {pages.length > 1 && (
              <>
                <button className="secondary" disabled={pageIdx === 0} onClick={() => setPageIdx(pageIdx - 1)}>
                  ‹
                </button>
                <span className="small">
                  Hal. {pageNumbers[pageIdx]} ({pageIdx + 1}/{pages.length} dipratinjau
                  {file?.halaman ? ` dari ${file.halaman}` : ''})
                </span>
                <button className="secondary" disabled={pageIdx >= pages.length - 1} onClick={() => setPageIdx(pageIdx + 1)}>
                  ›
                </button>
              </>
            )}
            <button className="secondary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Perkecil">
              −
            </button>
            <span className="small">{Math.round(zoom * 100)}%</span>
            <button className="secondary" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Perbesar">
              +
            </button>
            <button className="secondary" onClick={() => setRotate((r) => (r + 90) % 360)}>
              Putar
            </button>
            <button className="secondary" onClick={openOriginal}>
              Buka asli
            </button>
          </div>
          <div className="viewer-stage">
            {src ? (
              <img
                src={src}
                alt={`Halaman ${pageNumbers[pageIdx] ?? 1}`}
                style={{ transform: `rotate(${rotate}deg)`, width: `${zoom * 100}%` }}
              />
            ) : file && pages.length === 0 && !file.mime.startsWith('image/') ? (
              <p className="muted pad">Pratinjau halaman tidak tersedia. Gunakan “Buka asli”.</p>
            ) : (
              <p className="muted pad">Memuat pratinjau...</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
