export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'positive' | 'critical';
  action?: { label: string; to: string };
}

const toasts = ref<Toast[]>([]);
let nextId = 0;

/** Lightweight confirmations for actions that would otherwise happen silently. */
export function useToast() {
  function push(message: string, options: { tone?: Toast['tone']; action?: Toast['action']; duration?: number } = {}) {
    const toast: Toast = { id: nextId++, message, tone: options.tone ?? 'neutral', action: options.action };
    toasts.value = [...toasts.value, toast];
    setTimeout(() => dismiss(toast.id), options.duration ?? 4200);
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  return {
    toasts: readonly(toasts),
    dismiss,
    notify: (message: string, action?: Toast['action']) => push(message, { action }),
    success: (message: string, action?: Toast['action']) => push(message, { tone: 'positive', action }),
    error: (message: string) => push(message, { tone: 'critical', duration: 6000 }),
  };
}
