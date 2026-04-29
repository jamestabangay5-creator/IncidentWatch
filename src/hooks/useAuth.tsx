// AuthProvider and useAuth are in separate exports in this file.
// They are kept together intentionally — the context and its consumer
// must share the same Ctx reference. Vite HMR handles this fine on full reload.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";

type Role = "admin" | "user";

export interface AuthCtx {
  user: User | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (opts: { email: string; password: string; full_name: string; contact_number: string }) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthCtx | undefined>(undefined);

async function fetchRoles(uid: string): Promise<Role[]> {
  try {
    const snap = await getDoc(doc(db, "user_role", uid));
    if (!snap.exists()) return ["user"];
    const data = snap.data();
    // Support both string "admin" and array ["admin"]
    const raw = data.roles;
    if (Array.isArray(raw)) return raw as Role[];
    if (typeof raw === "string") return [raw as Role];
    return ["user"];
  } catch {
    return ["user"];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  // Stay true until BOTH auth state AND roles are resolved
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch roles BEFORE clearing loading so the redirect in auth.tsx
        // always sees the correct isAdmin value
        const r = await fetchRoles(firebaseUser.uid);
        setRoles(r);
      } else {
        setRoles([]);
      }
      // Only clear loading after roles are known
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp({
    email,
    password,
    full_name,
    contact_number,
  }: {
    email: string;
    password: string;
    full_name: string;
    contact_number: string;
  }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: full_name });
    await setDoc(doc(db, "profiles", cred.user.uid), {
      full_name,
      email,
      contact_number,
      is_active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    await setDoc(doc(db, "user_role", cred.user.uid), {
      roles: ["user"],
      updated_at: serverTimestamp(),
    });
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  const value: AuthCtx = {
    user,
    roles,
    loading,
    isAdmin: roles.includes("admin"),
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
