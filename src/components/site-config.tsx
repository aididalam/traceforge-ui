"use client";

import { createContext, useContext, type ReactNode } from "react";

const SiteOrigin = createContext<string | null>(null);

export function SiteConfig({ origin, children }: { origin: string | null; children: ReactNode }) {
  return <SiteOrigin.Provider value={origin}>{children}</SiteOrigin.Provider>;
}

export function useSiteOrigin() {
  return useContext(SiteOrigin);
}
