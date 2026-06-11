import { useSyncExternalStore } from 'react';

// The toast model and the imperative store behind the `toast(...)` API. This is a tiny
// external store (subscribe / getSnapshot) rather than a Legend State observable on purpose:
// a toast carries a non-serializable `action.onClick` callback, whereas our Legend State
// stores (e.g. player$) hold ONLY serializable UI state. useSyncExternalStore lets us read it
// from React while `toast(...)` stays callable from anywhere, including non-React code.

export type ToastType = 'normal' | 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  // Named `onClick` to mirror sonner-native's action shape so call sites are a drop-in.
  onClick: () => void;
}

export interface ToastOptions {
  // Pass an explicit id to update an existing toast in place (used by toast.promise).
  id?: string;
  description?: string;
  action?: ToastAction;
  // Auto-dismiss delay in ms. Pass Infinity to keep the toast until it is dismissed.
  duration?: number;
}

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  duration: number;
}

const DEFAULT_DURATION = 4000;

// Newest first: index 0 renders at the very top, older toasts stack below it.
let toasts: ToastData[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastData[] {
  return toasts;
}

// React entry point for the host. Returns the live stack; only changes (new array identity)
// trigger a re-render.
export function useToasts(): ToastData[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

let count = 0;

function show(type: ToastType, title: string, options?: ToastOptions): string {
  const id = options?.id ?? `toast-${(count += 1)}`;
  const data: ToastData = {
    id,
    type,
    title,
    description: options?.description,
    action: options?.action,
    duration: options?.duration ?? DEFAULT_DURATION,
  };
  const existing = toasts.findIndex((t) => t.id === id);
  toasts =
    existing >= 0
      ? toasts.map((t) => (t.id === id ? data : t)) // update in place (same slot, keeps animation)
      : [data, ...toasts];
  emit();
  return id;
}

// Remove a toast from the stack. The host runs the exit animation first, then calls this to
// drop it for good.
export function removeToast(id: string): void {
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

interface PromiseMessages<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: unknown) => string);
}

interface ToastApi {
  (title: string, options?: ToastOptions): string;
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  warning: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  // Dismiss one toast by id, or all toasts when called with no argument.
  dismiss: (id?: string) => void;
  // Show a pending toast that resolves into a success/error toast (a small, common subset of
  // sonner's promise helper; not feature complete by design).
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>) => Promise<T>;
}

const base = (title: string, options?: ToastOptions): string => show('normal', title, options);

export const toast: ToastApi = Object.assign(base, {
  success: (title: string, options?: ToastOptions) => show('success', title, options),
  error: (title: string, options?: ToastOptions) => show('error', title, options),
  warning: (title: string, options?: ToastOptions) => show('warning', title, options),
  info: (title: string, options?: ToastOptions) => show('info', title, options),
  dismiss: (id?: string) => {
    if (id === undefined) {
      toasts = [];
      emit();
    } else {
      removeToast(id);
    }
  },
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>): Promise<T> => {
    const id = show('normal', messages.loading, { duration: Infinity });
    promise.then(
      (data) => {
        const text = typeof messages.success === 'function' ? messages.success(data) : messages.success;
        show('success', text, { id });
      },
      (error: unknown) => {
        const text = typeof messages.error === 'function' ? messages.error(error) : messages.error;
        show('error', text, { id });
      },
    );
    return promise;
  },
});
