"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface AuthState {
  appId: string | null;
  apiKey: string | null;
  appName: string | null;
}

interface AuthContextType {
  auth: AuthState;
  setAuth: (appId: string, apiKey: string, appName: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    appId: null,
    apiKey: null,
    appName: null,
  });

  const setAuth = (appId: string, apiKey: string, appName: string) => {
    setAuthState({ appId, apiKey, appName });
  };

  const logout = () => {
    setAuthState({ appId: null, apiKey: null, appName: null });
  };

  return (
    <AuthContext.Provider value={{ auth, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
