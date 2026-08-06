import type { ReactNode } from "react";

export function Section({ title, hint, children, action }: {
  title: string;
  hint?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="bg-navy-700 border border-white/5 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white text-sm font-semibold">{title}</h3>
          {hint && <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-slate-600 mt-1 leading-relaxed">{hint}</div>}
    </label>
  );
}

const inputClass =
  "w-full bg-navy-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className || ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} font-mono leading-relaxed resize-y ${props.className || ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className || ""}`} />;
}

export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-2.5 text-left w-full group"
    >
      <span
        className={`mt-0.5 w-8 h-4.5 rounded-full flex-shrink-0 transition-colors relative ${
          checked ? "bg-teal-500/80" : "bg-navy-500"
        }`}
        style={{ height: "18px", width: "32px" }}
      >
        <span
          className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(15px)" : "translateX(2px)" }}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-slate-300 group-hover:text-white transition-colors">{label}</span>
        {hint && <span className="block text-[10px] text-slate-600 leading-relaxed mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

export function Button({ variant = "default", children, ...props }: {
  variant?: "primary" | "default" | "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-teal-600 hover:bg-teal-500 text-white border-teal-500/50",
    default: "bg-navy-600 hover:bg-navy-500 text-slate-200 border-white/10",
    danger: "bg-red-600/20 hover:bg-red-600/30 text-red-300 border-red-500/30",
    ghost: "bg-transparent hover:bg-white/5 text-slate-400 border-transparent"
  };
  return (
    <button
      {...props}
      className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-navy-700 border border-white/5 rounded-xl p-3">
      <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color: accent || "#e2e8f0" }}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" style={{ fontSize: size }} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= rating ? "text-amber-400" : "text-navy-500"}>★</span>
      ))}
    </span>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    red: "bg-red-500/10 text-red-400 border-red-500/30",
    teal: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/30"
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider font-semibold ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3 opacity-20">{icon}</div>
      <div className="text-slate-400 text-sm">{title}</div>
      {hint && <div className="text-slate-600 text-[11px] mt-1 max-w-md mx-auto leading-relaxed">{hint}</div>}
    </div>
  );
}
