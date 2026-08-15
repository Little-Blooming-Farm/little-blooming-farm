import { motion } from 'framer-motion';

/** Shared building blocks for the admin panel — plainer than the guest site. */

export function AdminPage({ title, description, actions, children }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-bloom-300 pb-7">
        <div>
          <h1 className="font-display text-3xl font-light text-moss-800">{title}</h1>
          {description && (
            <p className="mt-2 font-sans text-[14px] font-light text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      <div className="pt-9">{children}</div>
    </div>
  );
}

export function Card({ children, className = '', as: Component = 'div' }) {
  return (
    <Component className={`border border-bloom-300 bg-bloom-50 p-6 ${className}`}>
      {children}
    </Component>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <Card>
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-display text-4xl font-light text-moss-800">{value}</p>
      {sub && <p className="mt-1 font-sans text-[13px] font-light text-ink-muted">{sub}</p>}
    </Card>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && (
        <span className="mt-1.5 block font-sans text-[12px] font-light text-ink-faint">{hint}</span>
      )}
      {error && (
        <span className="mt-1.5 block font-sans text-[12px] text-clay-600">{error}</span>
      )}
    </label>
  );
}

export function Input(props) {
  return <input {...props} className={`field-input ${props.className ?? ''}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`field-input resize-y ${props.className ?? ''}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`field-input ${props.className ?? ''}`}>
      {children}
    </select>
  );
}

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const variants = {
    primary: 'btn-solid',
    quiet: 'btn-quiet text-moss-700',
    danger: 'btn-solid !bg-clay-500 hover:!bg-clay-600',
    ghost:
      'font-sans text-[11px] uppercase tracking-eyebrow text-ink-muted hover:text-ink transition-colors duration-500',
  };
  return (
    <button {...props} className={`${variants[variant]} ${className}`}>
      {variant === 'quiet' ? <span>{children}</span> : children}
    </button>
  );
}

export function StatusPill({ status }) {
  const styles = {
    confirmed: 'border-moss-300 bg-moss-50 text-moss-700',
    pending: 'border-gold-300 bg-[#FBF4E2] text-gold-600',
    cancelled: 'border-clay-200 bg-clay-100 text-clay-600',
  };
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2.5 py-1 font-sans text-[10px] uppercase tracking-label ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}

export function SourcePill({ source }) {
  const styles = {
    manual: 'border-moss-300 bg-moss-50 text-moss-700',
    airbnb: 'border-clay-300 bg-clay-100 text-clay-600',
    vrbo: 'border-gold-300 bg-[#FBF4E2] text-gold-600',
    direct: 'border-bloom-300 bg-bloom-100 text-ink-soft',
  };
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-0.5 font-sans text-[10px] uppercase tracking-label ${
        styles[source] ?? styles.direct
      }`}
    >
      {source}
    </span>
  );
}

export function Banner({ tone = 'moss', children, onDismiss }) {
  const tones = {
    moss: 'border-moss-200 bg-moss-50 text-moss-700',
    clay: 'border-clay-200 bg-clay-100 text-clay-600',
    gold: 'border-gold-200 bg-[#FBF4E2] text-gold-600',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-7 flex items-start justify-between gap-5 border px-5 py-4 font-sans text-[14px] font-light ${tones[tone]}`}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-sans text-[11px] uppercase tracking-eyebrow opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </motion.div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="border border-dashed border-bloom-300 px-8 py-16 text-center">
      <p className="font-display text-2xl font-light text-moss-800">{title}</p>
      {body && (
        <p className="mx-auto mt-3 max-w-[46ch] font-sans text-[14px] font-light text-ink-muted">
          {body}
        </p>
      )}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

export function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-bloom-300">
            {headers.map((header) => (
              <th
                key={header}
                className="px-3 py-3 text-left font-sans text-[10px] uppercase tracking-label text-ink-muted first:pl-0 last:pr-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bloom-300">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-4 align-top font-sans text-[14px] font-light text-ink first:pl-0 last:pr-0 ${className}`}>
      {children}
    </td>
  );
}
