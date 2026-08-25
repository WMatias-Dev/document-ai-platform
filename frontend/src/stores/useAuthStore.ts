import { create } from "zustand";
import { User } from "@/types/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  initFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    localStorage.setItem("doc_ai_token", token);
    localStorage.setItem("doc_ai_user", JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("doc_ai_token");
    localStorage.removeItem("doc_ai_user");
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  initFromStorage: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("doc_ai_token");
      const userRaw = localStorage.getItem("doc_ai_user");
      if (token && userRaw) {
        try {
          const user = JSON.parse(userRaw);
          set({ user, token, isAuthenticated: true, isLoading: false });
          return;
        } catch {
          localStorage.removeItem("doc_ai_user");
        }
      }
    }
    set({ isLoading: false });
  },
}));
