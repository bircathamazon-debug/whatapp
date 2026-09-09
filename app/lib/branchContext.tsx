import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getBranches } from './branches';
import type { Branch } from '../../shared/types';

interface BranchContextValue {
  branches: Branch[];
  branchId: string | null;
  setBranchId: (id: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  branchId: null,
  setBranchId: () => {},
  loading: true,
  reload: async () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const data = await getBranches();
    setBranches(data);
    setBranchId((current) => current ?? data[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return <BranchContext.Provider value={{ branches, branchId, setBranchId, loading, reload }}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  return useContext(BranchContext);
}
