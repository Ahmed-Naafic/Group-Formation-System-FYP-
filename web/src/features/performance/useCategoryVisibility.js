import { useState } from 'react';
import { useGetPerformanceSettingsQuery } from './performanceApi';

// Gates the per-page "Show Category" toggle behind the admin's global
// switch (PerformanceSettingsPage) — canShow decides whether the button
// exists on this page at all; visible is the viewer's own on/off state
// once it does. Local (not persisted) on purpose: this is "let me peek at
// category while I'm looking at this page," not a saved preference.
export function useCategoryVisibility() {
  const { data: settings } = useGetPerformanceSettingsQuery();
  const [visible, setVisible] = useState(false);
  const canShow = !!settings?.categoryVisibleToInstructors;
  return { canShow, visible: canShow && visible, toggle: () => setVisible((v) => !v) };
}
