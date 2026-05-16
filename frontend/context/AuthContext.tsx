import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import { api } from "../lib/api";
import type { RegisterResponse, Session } from "../lib/types";

type RegisterPayload = {
  account_type: "owner" | "employee";
  username: string;
  full_name: string;
  password: string;
  email?: string;
  workshop_name?: string;
  workshop_code?: string;
};

type AuthContextValue = {
  session: Session | null;
  initializing: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchWorkshop: (workshopId: string) => Promise<void>;
};

const STORAGE_KEY = "bengkel-auth-session";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const savedSession = await AsyncStorage.getItem(STORAGE_KEY);
      if (!savedSession) {
        setInitializing(false);
        return;
      }

      const parsedSession = JSON.parse(savedSession) as Session;
      setSession(parsedSession);
      try {
        const latestUser = await api.me(parsedSession.token);
        const refreshedSession = { ...parsedSession, user: latestUser };
        setSession(refreshedSession);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(refreshedSession));
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
        setSession(null);
      } finally {
        setInitializing(false);
      }
    };

    bootstrap();
  }, []);

  const persistSession = async (nextSession: Session) => {
    setSession(nextSession);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      signIn: async (username, password) => {
        const response = await api.login(username, password);
        await persistSession({ token: response.access_token, user: response.user });
      },
      register: async (payload) => {
        const response = await api.register(payload);
        if (response.access_token && response.user) {
          await persistSession({ token: response.access_token, user: response.user });
        }
        return response;
      },
      signOut: async () => {
        setSession(null);
        await AsyncStorage.removeItem(STORAGE_KEY);
      },
      refreshProfile: async () => {
        if (!session?.token) {
          return;
        }
        const user = await api.me(session.token);
        await persistSession({ token: session.token, user });
      },
      switchWorkshop: async (workshopId) => {
        if (!session?.token) {
          return;
        }
        const response = await api.switchWorkshop(session.token, workshopId);
        await persistSession({ token: response.access_token, user: response.user });
      },
    }),
    [initializing, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
}