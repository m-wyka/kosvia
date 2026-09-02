export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'positive' | 'critical';
  action?: { label: string; to: string };
}

interface PushOptions {
  tone?: Toast['tone'];
  action?: Toast['action'];
  duration?: number;
}

const DEFAULT_DURATION_MS = 4200;
const ERROR_DURATION_MS = 6000;
const MAX_VISIBLE_TOASTS = 3;

const toasts = ref<Toast[]>([]);
let nextId = 0;

export const useToast = () => {
  const dismiss = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  };

  const push = (message: string, options: PushOptions = {}) => {
    const toast: Toast = {
      id: nextId++,
      message,
      tone: options.tone ?? 'neutral',
      action: options.action,
    };
    toasts.value = [...toasts.value, toast].slice(-MAX_VISIBLE_TOASTS);
    setTimeout(() => dismiss(toast.id), options.duration ?? DEFAULT_DURATION_MS);
  };

  const clear = () => {
    toasts.value = [];
  };

  return {
    toasts: readonly(toasts),
    dismiss,
    clear,
    notify: (message: string, action?: Toast['action']) => push(message, { action }),
    success: (message: string, action?: Toast['action']) =>
      push(message, { tone: 'positive', action }),
    error: (message: string) => push(message, { tone: 'critical', duration: ERROR_DURATION_MS }),
  };
};
