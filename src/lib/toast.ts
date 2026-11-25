import { useSyncExternalStore } from 'react';

export type ToastTone = 'success' | 'danger' | 'info';
export type ToastItem = { id: number; tone: ToastTone; message: string };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, tone: ToastTone = 'success') {
  const id = nextId++;
  items = [...items.slice(-3), { id, tone, message }];
  emit();
  window.setTimeout(() => dismissToast(id), tone === 'danger' ? 7000 : 4000);
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
  );
}
