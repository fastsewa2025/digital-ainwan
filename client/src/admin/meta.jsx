import { createContext, useContext } from 'react';
import { useFetch } from '../lib/api.js';
import { Async } from '../components/ui.jsx';

const MetaContext = createContext(null);

/** Loads the description of every content type once (field names, options, ...). The forms are built from it. */
export function MetaProvider({ children }) {
  const res = useFetch('/admin/meta');
  return (
    <Async res={res}>
      {(meta) => <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>}
    </Async>
  );
}

export const useMeta = () => useContext(MetaContext);

/** The three parts of the website, in the order the menu shows them. */
export const SECTIONS = ['sanskriti', 'vikas', 'sampark'];
