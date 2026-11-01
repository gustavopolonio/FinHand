interface MoneyLoaderProps {
  label?: string;
}

export function MoneyLoader({
  label = "Checking your session…",
}: MoneyLoaderProps) {
  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center px-6 py-16"
    >
      <div
        aria-live="polite"
        className="flex min-h-32 flex-col items-center justify-center"
        role="status"
      >
        <div
          aria-hidden="true"
          className="flex h-16 items-end justify-center gap-2"
        >
          <span className="money-loader__coin">R$</span>
          <span className="money-loader__coin">R$</span>
          <span className="money-loader__coin">R$</span>
        </div>
        <p className="mt-5 text-sm font-medium text-emerald-950/70">
          {label}
        </p>
      </div>
    </main>
  );
}
