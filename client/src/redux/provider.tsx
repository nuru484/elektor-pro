"use client";

import { useRef } from "react";
import { Provider } from "react-redux";
import { Toaster } from "sonner";

import { type AppStore, makeStore } from "./store";

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore>(undefined);
  storeRef.current ??= makeStore();

  return (
    <Provider store={storeRef.current}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </Provider>
  );
}
