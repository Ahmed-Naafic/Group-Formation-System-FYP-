import { createContext, useContext, useState } from 'react';

const CategoryVisibilityContext = createContext(null);

export function CategoryVisibilityProvider({ children }) {
  const [showCategory, setShowCategory] = useState(() => {
    const stored = localStorage.getItem('showPerformanceCategory');
    return stored === null ? false : stored === 'true';
  });

  const toggleCategory = () => {
    setShowCategory((prev) => {
      const next = !prev;
      localStorage.setItem('showPerformanceCategory', String(next));
      return next;
    });
  };

  return (
    <CategoryVisibilityContext.Provider value={{ showCategory, toggleCategory }}>
      {children}
    </CategoryVisibilityContext.Provider>
  );
}

export function useCategoryVisibility() {
  return useContext(CategoryVisibilityContext);
}
