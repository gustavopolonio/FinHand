"use client";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Tags,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { ApiError, type CurrentUser, getCurrentUser } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/class-names";

import { FinHandBrand } from "./finhand-brand";
import { MoneyLoader } from "./money-loader";
import { Button } from "./ui/button";

interface DashboardShellProps {
  children: ReactNode;
}

interface NavigationItem {
  href: string;
  icon: LucideIcon;
  label: string;
  available: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Overview",
    available: true,
  },
  {
    href: "/dashboard/transactions",
    icon: ReceiptText,
    label: "Transactions",
    available: true,
  },
  {
    href: "/dashboard/accounts",
    icon: WalletCards,
    label: "Accounts",
    available: false,
  },
  {
    href: "/dashboard/categories",
    icon: Tags,
    label: "Categories",
    available: false,
  },
];

const DashboardUserContext = createContext<CurrentUser | null>(null);

export function useDashboardUser() {
  const user = useContext(DashboardUserContext);

  if (!user) {
    throw new Error("Dashboard user is not available.");
  }

  return user;
}

function initialsFor(user: CurrentUser) {
  const value = user.displayName?.trim() || user.email;
  const words = value.split(/[\s@._-]+/).filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function UserAvatar({ user }: { user: CurrentUser }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-finhand-primary text-xs font-bold text-white">
      {initialsFor(user)}
    </span>
  );
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    setError(null);

    try {
      setUser(await getCurrentUser());
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/");
        return;
      }

      setError(
        cause instanceof Error ? cause.message : "Unable to load your account.",
      );
    }
  }, [router]);

  useEffect(() => {
    let isActive = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (isActive) setUser(currentUser);
      })
      .catch((cause: unknown) => {
        if (!isActive) return;

        if (cause instanceof ApiError && cause.status === 401) {
          router.replace("/");
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your account.",
        );
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

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-finhand-canvas p-8">
        <div className="max-w-sm text-center">
          <FinHandBrand className="justify-center" />
          <h1 className="mt-8 text-2xl font-semibold text-finhand-ink">
            We couldn&apos;t open your workspace
          </h1>
          <p className="mt-3 text-sm text-finhand-muted">{error}</p>
          <Button className="mt-6" onClick={() => void loadUser()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (!user) {
    return <MoneyLoader />;
  }

  return (
    <DashboardUserContext.Provider value={user}>
      <div className="min-h-screen min-w-[1120px] bg-finhand-canvas text-finhand-ink">
        <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-finhand-border bg-white px-5 py-6">
          <FinHandBrand className="px-2" />

          <nav aria-label="Primary navigation" className="mt-12 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const content = (
                <>
                  <Icon aria-hidden="true" className="size-5" />
                  <span>{item.label}</span>
                  {!item.available ? (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-finhand-subtle">
                      Soon
                    </span>
                  ) : null}
                </>
              );
              const className = cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition",
                isActive
                  ? "bg-finhand-mint-soft text-finhand-primary-strong"
                  : "text-finhand-muted hover:bg-finhand-canvas-muted hover:text-finhand-ink",
                !item.available && "cursor-not-allowed opacity-65",
              );

              return item.available ? (
                <Link className={className} href={item.href} key={item.href}>
                  {content}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={className}
                  key={item.href}
                  title="This page will be implemented in the next design steps."
                >
                  {content}
                </span>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl bg-finhand-mint-soft p-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar user={user} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-finhand-ink">
                  {user.displayName ?? "FinHand user"}
                </p>
                <p className="truncate text-xs text-finhand-muted">
                  {user.email}
                </p>
              </div>
              <button
                aria-label="Sign out"
                className="grid size-9 place-items-center rounded-lg text-finhand-muted transition hover:bg-white hover:text-finhand-expense focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus"
                onClick={() => void signOut()}
                title="Sign out"
                type="button"
              >
                <LogOut aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
        </aside>

        <div className="ml-64 min-h-screen">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-finhand-border bg-finhand-canvas/95 px-10 backdrop-blur-sm">
            <FinHandBrand compact />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-finhand-ink">
                  {user.displayName ?? user.email}
                </p>
                <p className="text-xs text-finhand-muted">
                  {user.defaultCurrency} · {user.timeZone}
                </p>
              </div>
              <UserAvatar user={user} />
            </div>
          </header>

          <main className="mx-auto max-w-[1440px] px-10 py-8">{children}</main>
        </div>
      </div>
    </DashboardUserContext.Provider>
  );
}
