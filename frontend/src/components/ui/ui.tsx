import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, ShieldAlert, X } from 'lucide-react'
import { fmt, parseHHMM } from '../../lib/time'

export function Spinner({ label }: { label?: string }) {
  return <span role="status" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><Loader2 size={16} className="spin" aria-hidden />{label && <span>{label}</span>}</span>
}

export function Banner({ kind = 'info', children, action }: { kind?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode; action?: ReactNode }) {
  const Icon = kind === 'bad' ? ShieldAlert : kind === 'warn' ? AlertTriangle : kind === 'ok' ? CheckCircle2 : Info
  return (
    <div className={`banner ${kind}`} role={kind === 'bad' ? 'alert' : 'status'}>
      <Icon size={17} style={{ flex: 'none', marginTop: 2 }} aria-hidden />
      <div style={{ flex: 1 }}>{children}</div>{action}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '40px 20px' }}>
      <h3 style={{ fontSize: 18 }}>{title}</h3>
      {children && <p className="muted" style={{ maxWidth: 520, margin: '8px auto 16px' }}>{children}</p>}
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="modal" aria-labelledby={id} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose() }}
      style={wide ? { width: 'min(1100px, 96vw)' } : undefined}>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--line)', gap: 10 }}>
            <h2 id={id} style={{ fontSize: 18, flex: 1 }}>{title}</h2>
            <button className="btn sm ghost" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
          </div>
          <div style={{ padding: 20, overflow: 'auto' }}>{children}</div>
        </div>
      )}
    </dialog>
  )
}

export function Tags({ label, values, onChange, suggestions, disabled }: { label: string; values: string[]; onChange: (v: string[]) => void; suggestions?: string[]; disabled?: boolean }) {
  const [v, setV] = useState('')
  const id = useId()
  const add = (x: string) => { const t = x.trim().toLowerCase().replace(/\s+/g, '_'); if (t && !values.includes(t)) onChange([...values, t]); setV('') }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {values.length === 0 && <span className="muted" style={{ fontSize: 12 }}>none</span>}
        {values.map((x) => (
          <span key={x} className="chip">{x}{!disabled && <button aria-label={`Remove ${x}`} onClick={() => onChange(values.filter((y) => y !== x))}><X size={12} /></button>}</span>
        ))}
      </div>
      {!disabled && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input id={id} className="input" list={`${id}-l`} value={v} placeholder="add…" onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(v) } }} />
          <datalist id={`${id}-l`}>{suggestions?.filter((s) => !values.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
          <button className="btn sm" onClick={() => add(v)} disabled={!v.trim()}>Add</button>
        </div>
      )}
    </div>
  )
}

/** HH:MM text field bound to integer minutes; invalid text is flagged and never committed. */
export function TimeField({ label, value, onChange, min = 0, max = 1440 }: { label: string; value: number; onChange: (m: number) => void; min?: number; max?: number }) {
  const [txt, setTxt] = useState(fmt(value))
  const [bad, setBad] = useState(false)
  const id = useId()
  useEffect(() => { setTxt(value >= 1440 ? '24:00' : fmt(value)); setBad(false) }, [value])
  const commit = (s: string) => {
    const m = s.trim() === '24:00' ? 1440 : parseHHMM(s)
    if (m === null || m < min || m > max) { setBad(true); return }
    setBad(false); onChange(m)
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input mono" inputMode="numeric" value={txt} aria-invalid={bad} aria-describedby={bad ? `${id}-e` : undefined}
        onChange={(e) => { setTxt(e.target.value); commit(e.target.value) }} onBlur={() => { if (bad) { setTxt(fmt(value)); setBad(false) } }} placeholder="HH:MM" />
      {bad && <span id={`${id}-e`} style={{ color: 'var(--bad)', fontSize: 11.5 }}>Use HH:MM between {fmt(min)} and {max >= 1440 ? '24:00' : fmt(max)}</span>}
    </div>
  )
}

export function NumField({ label, value, onChange, min = 0, max = 1000 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" className="input mono" min={min} max={max} value={value}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n)))) }} />
    </div>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'bad' | 'ok' | 'warn' }) {
  const c = tone === 'bad' ? 'var(--bad)' : tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--navy)'
  return (
    <div style={{ padding: '10px 14px', borderRight: '1px solid var(--line)', minWidth: 120 }}>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 500, color: c, lineHeight: 1.2 }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5 }}>{sub}</div>}
    </div>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}
