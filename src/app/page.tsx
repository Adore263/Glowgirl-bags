"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { SaleScanner } from "@/components/sale-scanner";
import {
  getFirebaseClientAuth,
  getUserStoreRole,
  signOutUser,
  UserRole,
} from "@/lib/firebase/client";

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID ?? "default";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = getFirebaseClientAuth();

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        router.replace("/login");
        return;
      }

      const nextRole = await getUserStoreRole(nextUser.uid, DEFAULT_STORE_ID);
      setUser(nextUser);
      setRole(nextRole);
      setLoading(false);
    });

    return unsubscribe;
  }, [router]);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOutUser();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#fbf7f1] via-[#f7f1e8] to-[#f1eadf]">
        <p className="rounded-full border border-[#dbc9ad] bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
          Loading dashboard...
        </p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#fbf7f1] via-[#f7f1e8] to-[#f1eadf] py-6 md:py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-56 w-56 rounded-full bg-[#d8c19d]/30 blur-3xl" />
        <div className="absolute -right-16 top-28 h-64 w-64 rounded-full bg-[#1f2937]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-white/80 bg-white/75 p-4 shadow-[0_20px_60px_rgba(31,41,55,0.08)] backdrop-blur sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">{user.email}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8b6a2f]">
            {role ? `Role: ${role}` : "Role: not assigned"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={busy}
            className="rounded-full border border-[#d8c19d] bg-[#1f2937] px-4 py-2 text-sm font-semibold text-[#faf7f2] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#111827] hover:shadow disabled:opacity-60"
          >
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>

        <SaleScanner />
      </div>
    </main>
  );
}
