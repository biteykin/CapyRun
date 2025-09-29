// app/providers.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type User = any | null;
type Ctx = { user: User; setUser: (u: User) => void };

const UserContext = createContext<Ctx | undefined>(undefined);

export default function PHProvider({ children, initialUser = null }: { children: React.ReactNode; initialUser?: any | null }) {
  const [user, setUser] = useState<any | null>(initialUser ?? null);

  useEffect(() => {
    // Лёгкий debug (можно удалить)
    // console.debug("PHProvider initialUser:", initialUser ? { id: initialUser.id, email: initialUser.email } : null);
  }, [initialUser]);

  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export function useAppUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useAppUser must be used within PHProvider");
  return ctx;
}
