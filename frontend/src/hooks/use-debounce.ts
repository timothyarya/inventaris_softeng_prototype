"use client";

import { useEffect, useState } from "react";

/** Menunda perubahan nilai (mis. input pencarian) agar tidak memanggil API di setiap ketikan. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
