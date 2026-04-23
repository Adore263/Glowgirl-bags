"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseClientAuth, signUpWithRole, UserRole } from "@/lib/firebase/client";

const DEFAULT_STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID ?? "default";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");
  const [storeId, setStoreId] = useState(DEFAULT_STORE_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/");
      }
    });

    return unsubscribe;
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await signUpWithRole(email.trim(), password, role, storeId.trim());
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create account</h1>
        <p className="mt-1 text-sm text-slate-700">Register as admin or cashier.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
            Confirm Password
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
            Store ID
            <input
              required
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">Role</legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole("cashier")}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  role === "cashier"
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                Cashier
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  role === "admin"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                Admin
              </button>
            </div>
          </fieldset>

          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-700">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-emerald-900 underline decoration-2 underline-offset-2 hover:text-emerald-950">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
