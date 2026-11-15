import { LOGO_BASE64 } from '../constants/branding';

export default function SplashScreen({ isFadingOut = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang tải ứng dụng omniEco"
      className={`print:hidden h-screen w-screen fixed inset-0 z-[120] flex flex-col items-center justify-center bg-slate-900 px-6 select-none transition-opacity duration-500 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Subtle ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center text-center space-y-6">
        {/* Brand Emblem + Breathing omniEco Wordmark */}
        <div className="flex flex-col items-center gap-3.5 animate-pulse">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/90 border border-emerald-500/30 shadow-lg shadow-emerald-950/50 p-2.5">
            <img
              src={LOGO_BASE64}
              alt="omniEco Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-emerald-500 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-300 bg-clip-text text-transparent">
            omniEco
          </h1>
        </div>

        {/* Modern Tailwind Spinner + Loading Status */}
        <div className="flex flex-col items-center gap-3.5">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
            <div className="h-10 w-10 rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-400/70 animate-spin" />
          </div>

          <div className="w-48 h-1 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 animate-pulse" />
          </div>

          <p className="text-xs sm:text-sm font-medium tracking-wide text-slate-400">
            Đang tải dữ liệu thiết kế...
          </p>
        </div>
      </div>
    </div>
  );
}
