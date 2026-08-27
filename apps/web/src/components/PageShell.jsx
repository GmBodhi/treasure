import { Link } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'AR view' },
  { to: '/markers', label: 'printable markers' },
  { to: '/studio', label: 'target studio' },
  { to: '/admin', label: 'console' },
  { to: '/dev/tracking-test', label: 'tracking test' },
];

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-stroke bg-white/[0.03] px-5 py-[18px] ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children }) {
  return (
    <h2 className="mt-10 mb-3.5 text-[13px] font-normal tracking-[0.14em] uppercase text-muted">
      {children}
    </h2>
  );
}

/** Scrollable chrome shared by the three operator routes. */
export default function PageShell({ title, lede, width = 'max-w-[860px]', children }) {
  return (
    <div className={`mx-auto ${width} px-5 pt-10 pb-20 print:p-0`}>
      <h1 className="mb-1.5 text-[27px] tracking-[-0.02em] print:hidden">{title}</h1>
      {lede && <p className="mb-2 max-w-[62ch] text-muted print:hidden">{lede}</p>}

      <nav className="font-mono text-[13px] text-muted print:hidden">
        {LINKS.map((link, i) => (
          <span key={link.to}>
            {i > 0 && ' · '}
            <Link className="text-accent no-underline hover:underline" to={link.to}>
              {link.label}
            </Link>
          </span>
        ))}
      </nav>

      {children}
    </div>
  );
}
