import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getBranches } from './branches';
import type { Branch } from '../../shared/types';

interface BranchContextValue {
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
  /** Cuenta de invitado/prueba marcada como "solo lectura" (users/{uid}.readOnly)
   * — puede ver todo, pero cualquier intento de escribir se rechaza en el
   * backend. Se usa para mostrar un aviso en vez de dejar que el intento de
   * guardar falle sin explicación. */
  readOnly: boolean;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  branchId: null,
  setBranchId: () => {},
  loading: true,
  reload: async () => {},
  readOnly: false,
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readOnly, setReadOnly] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getBranches();
    setBranches(data);
    setBranchId((current) => current ?? data[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Las reglas de Firestore exigen sesión iniciada para leer `branches`;
    // si se pide antes de que Firebase Auth resuelva, tira "Missing or
    // insufficient permissions". Se espera a que haya usuario autenticado.
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        reload();
        getDoc(doc(db, 'users', user.uid))
          .then((snap) => setReadOnly(snap.data()?.readOnly === true))
          .catch(() => setReadOnly(false));
      } else {
        setBranches([]);
        setBranchId(null);
        setReadOnly(false);
        setLoading(false);
      }
    });
    return unsub;
  }, [reload]);

  return <BranchContext.Provider value={{ branches, branchId, setBranchId, loading, reload, readOnly }}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  return useContext(BranchContext);
}
