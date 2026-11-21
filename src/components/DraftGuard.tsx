import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import Dialog from './Dialog';

type Draft = {
  dirty: boolean;
  saving?: boolean;
  save?: () => Promise<boolean>;
  discard?: () => void;
};

type Leave = () => void | Promise<void>;
type ReadDraft = () => Draft;
type Guard = {
  register: (read: ReadDraft) => () => void;
  requestLeave: (leave: Leave) => void;
  paused: boolean;
};

const DraftContext = createContext<Guard | null>(null);

export function useDraftGuard() {
  const guard = useContext(DraftContext);
  if (!guard) throw new Error('DraftGuard belum tersedia');
  return guard;
}

export function useUnsavedDraft(draft: Draft) {
  const { register, paused } = useDraftGuard();
  const latest = useRef(draft);
  useLayoutEffect(() => { latest.current = draft; }, [draft]);
  const active = draft.dirty || !!draft.saving;

  useLayoutEffect(() => {
    if (active) return register(() => latest.current);
  }, [active, draft.saving, register]);

  return paused;
}

export default function DraftGuard({ children }: { children: ReactNode }) {
  const drafts = useRef(new Set<ReadDraft>());
  const [, refresh] = useState(0);
  const [leave, setLeave] = useState<Leave | null>(null);
  const [working, setWorking] = useState(false);

  const register = useCallback((read: ReadDraft) => {
    drafts.current.add(read);
    refresh((n) => n + 1);
    return () => {
      drafts.current.delete(read);
      refresh((n) => n + 1);
    };
  }, []);

  const hasDraft = drafts.current.size > 0;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    drafts.current.size > 0 && currentLocation.pathname !== nextLocation.pathname,
  );
  const paused = blocker.state === 'blocked' || leave !== null;

  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  const requestLeave = useCallback((action: Leave) => {
    if (drafts.current.size > 0) setLeave(() => action);
    else void action();
  }, []);

  const cancel = () => {
    if (working) return;
    if (blocker.state === 'blocked') blocker.reset();
    setLeave(null);
  };

  async function finish(save: boolean) {
    if (working) return;
    const active = [...drafts.current];
    if (!save && active.some((read) => read().saving)) return;
    setWorking(true);
    try {
      for (const read of active) {
        const draft = read();
        if (!save) {
          draft.discard?.();
        } else if ((draft.dirty || draft.saving) && !await draft.save?.()) {
          if (blocker.state === 'blocked') blocker.reset();
          setLeave(null);
          return;
        }
      }
      if (blocker.state === 'blocked') blocker.proceed();
      if (leave) await leave();
      setLeave(null);
    } finally {
      setWorking(false);
    }
  }

  const pending = paused ? [...drafts.current].map((read) => read()) : [];
  return (
    <DraftContext.Provider value={{ register, requestLeave, paused }}>
      {children}
      {paused && (
        <Dialog title="Perubahan belum tersimpan" onClose={cancel}>
          <p className="muted">Simpan perubahan sebelum meninggalkan halaman atau buang draf ini.</p>
          {pending.some((draft) => draft.saving) && <p role="status">Sedang menyimpan…</p>}
          <div className="form-actions wrap">
            <button type="button" className="secondary" data-initial-focus onClick={cancel} disabled={working}>
              Tetap di halaman
            </button>
            <button type="button" className="danger" onClick={() => void finish(false)} disabled={working || pending.some((draft) => draft.saving)}>
              {pending.length ? 'Buang perubahan' : 'Lanjut'}
            </button>
            {pending.length > 0 && pending.every((draft) => draft.save) && (
              <button type="button" onClick={() => void finish(true)} disabled={working}>Simpan dan lanjut</button>
            )}
          </div>
        </Dialog>
      )}
    </DraftContext.Provider>
  );
}
