"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountsPanel } from "@/components/accounts-panel";
import { CategoriesPanel } from "@/components/categories-panel";
import { MoneyLoader } from "@/components/money-loader";
import { TransactionsPanel } from "@/components/transactions-panel";
import { ApiError, type CurrentUser, getCurrentUser } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let isActive = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (isActive) {
          setUser(currentUser);
        }
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/");
        }
      });

    return () => {
      isActive = false;
    };
  }, [router]);

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  if (!user) {
    return <MoneyLoader />;
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <section className="mx-auto max-w-5xl rounded-3xl border border-emerald-950/10 bg-white p-10 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-emerald-700 uppercase">
              FinHand
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-emerald-950">
              {`Welcome, ${user.displayName ?? user.email}`}
            </h1>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </div>

        <div className="mt-10 rounded-2xl bg-emerald-50 p-6 text-emerald-950">
          Add your financial accounts, categories, and transactions to start
          organizing your money.
        </div>

        <AccountsPanel defaultCurrency={user.defaultCurrency} />
        <CategoriesPanel />
        <TransactionsPanel />
      </section>
    </main>
  );
}
