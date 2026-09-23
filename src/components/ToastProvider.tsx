"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Loader2, Info, X } from "lucide-react";

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: "success" | "error" | "info" | "loading";
  step?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, "id"> & { id?: string }) => string;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, "id">>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, "id"> & { id?: string }) => {
      const id = toast.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Loading toasts stay until explicitly dismissed; success/info toasts disappear after 5s by default
      const duration = toast.duration ?? (toast.type === "loading" ? 0 : 5000);
      const newToast: ToastItem = {
        ...toast,
        id,
        duration,
      };

      setToasts((prev) => [...prev.filter((t) => t.id !== id), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const updateToast = useCallback(
    (id: string, updates: Partial<Omit<ToastItem, "id">>) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            const updated = { ...t, ...updates };
            const duration = updates.duration ?? (updated.type === "loading" ? 0 : 5000);
            if (duration > 0) {
              setTimeout(() => {
                removeToast(id);
              }, duration);
            }
            return { ...updated, duration };
          }
          return t;
        })
      );
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, updateToast, removeToast }}>
      {children}
      {/* Floating Toasted Notification Stack on Top-Right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex flex-col p-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 ${
              toast.type === "loading"
                ? "bg-zinc-950/95 border-indigo-500/50 text-zinc-100 shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                : toast.type === "success"
                ? "bg-[#0b1610]/95 border-emerald-500/50 text-emerald-200 shadow-emerald-500/10 ring-1 ring-emerald-500/20"
                : toast.type === "error"
                ? "bg-[#180d0d]/95 border-red-500/50 text-red-200 shadow-red-500/10 ring-1 ring-red-500/20"
                : "bg-zinc-950/95 border-zinc-700/50 text-zinc-100"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                {toast.type === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                ) : toast.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : toast.type === "error" ? (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                ) : (
                  <Info className="h-4 w-4 text-blue-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="text-xs font-semibold text-white leading-tight mb-0.5 flex items-center justify-between">
                    <span>{toast.title}</span>
                    {toast.type === "loading" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono animate-pulse">
                        Sending...
                      </span>
                    )}
                    {toast.type === "success" && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                        Done • 5s
                      </span>
                    )}
                  </div>
                )}
                <div className="text-[11px] text-zinc-300 leading-snug">
                  {toast.message}
                </div>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-0.5 text-zinc-400 hover:text-white rounded transition-colors ml-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Live Sending Process Bar (Only while sending) */}
            {toast.type === "loading" && (
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 w-full">
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500 w-full rounded-full animate-pulse" />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="truncate">{toast.step || "Delivering through Gmail API..."}</span>
                  <span className="text-indigo-400 font-mono font-medium shrink-0 ml-1">Active</span>
                </div>
              </div>
            )}

            {/* 5-second auto-dismiss indicator on completion */}
            {toast.type === "success" && (
              <div className="mt-2 h-0.5 w-full bg-emerald-950/40 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400/80 rounded-full w-full animate-pulse" />
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
