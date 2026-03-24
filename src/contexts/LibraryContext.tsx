import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/services/api';

const STORAGE_KEY = 'elidune_library_name';

interface LibraryContextValue {
  libraryName: string | null;
}

const LibraryContext = createContext<LibraryContextValue>({ libraryName: null });

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [libraryName, setLibraryName] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );

  // GET /library-info is public — fetch on mount regardless of auth state
  useEffect(() => {
    api.getLibraryInfo()
      .then((info) => {
        const name = info.name ?? null;
        setLibraryName(name);
        if (name) localStorage.setItem(STORAGE_KEY, name);
        else localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {});
  }, []);

  return (
    <LibraryContext.Provider value={{ libraryName }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  return useContext(LibraryContext);
}
