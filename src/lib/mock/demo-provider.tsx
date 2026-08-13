'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { demoCategories, demoLinks } from './data';
import type { DemoCategory, DemoLink } from './types';

type DemoContextValue = {
  categories: DemoCategory[];
  links: DemoLink[];
  toggleFavorite: (id: string) => void;
  addLink: (link: DemoLink) => void;
  removeLink: (id: string) => void;
  reset: () => void;
};
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState(demoLinks);
  return (
    <DemoContext.Provider
      value={{
        categories: demoCategories,
        links,
        toggleFavorite: (id) =>
          setLinks((items) =>
            items.map((item) =>
              item.id === id ? { ...item, favorite: !item.favorite } : item,
            ),
          ),
        addLink: (link) => setLinks((items) => [link, ...items]),
        removeLink: (id) =>
          setLinks((items) => items.filter((item) => item.id !== id)),
        reset: () => setLinks(demoLinks),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoProvider is required');
  return context;
}
