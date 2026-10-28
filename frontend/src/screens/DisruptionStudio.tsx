import { useRef, useState } from 'react'
import { CheckCheck, Loader2, Play, Plus, Sparkles, Trash2, Wand2, X } from 'lucide-react'
import { Banner, NumField, PageHeader, Spinner, TimeField } from '../components/ui/ui'
import { api, ApiFailure } from '../services/api'
import { buildPresets, EVENT_TYPE_LABEL } from '../lib/presets'
import { entityLabel } from '../lib/graph'
import { fmtRange, uid } from '../lib/time'
import { useStore } from '../state/store'
import type { Disruption, EventInterpretation, Household } from '../types'

function candidates(h: Household, type: Disruption['type']) {
  if (type === 'member_unavailable' || type === 'availability_changed') return h.members.map((m) => ({ id: m.id, label: m.name }))
  if (type === 'task_rescheduled') return h.tasks.map((t) => ({ id: t.id, label: t.title }))
  return h.resources.map((r) => ({ id: r.id, label: r.name }))
}

function EventFields({ h, ev, onChange }: { h: Household; ev: Disruption; onChange: (e: Disruption) => void }) {
  const opts = candidates(h, ev.type)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="field"><label htmlFor={`t-${ev.id}`}>Event type</label>
        <select id={`t-${ev.id}`} className="input" value={ev.type} onChange={(e) => onChange({ ...ev, type: e.target.value as Disruption['type'], affectedEntityIds: [], value: e.target.value === 'resource_capacity_changed' ? 1 : null })}>
          {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, margin: 0, padding: '6px 10px' }}>
        <legend className="lbl">Affected {ev.type.startsWith('member') || ev.type === 'availability_changed' ? 'member(s)' : ev.type === 'task_rescheduled' ? 'task' : 'resource(s)'}</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {opts.map((o) => (
            <label key={o.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={ev.affectedEntityIds.includes(o.id)} onChange={(e) => onChange({ ...ev, affectedEntityIds: e.target.checked ? [...ev.affectedEntityIds, o.id] : ev.affectedEntityIds.filter((x) => x !== o.id) })} />{o.label}
            </label>))}
        </div>
      </fieldset>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' + (ev.type === 'resource_capacity_changed' ? ' 1fr' : ''), gap: 8 }}>
        <TimeField label={ev.type === 'task_rescheduled' ? 'New window starts' : ev.type === 'availability_changed' ? 'Now available from' : 'From'} value={ev.startMin} max={ev.endMin - 1} onChange={(m) => onChange({ ...ev, startMin: m })} />
        <TimeField label={ev.type === 'task_rescheduled' ? 'New window ends' : ev.type === 'availability_changed' ? 'Until' : 'Until'} value={ev.endMin} min={ev.startMin + 1} onChange={(m) => onChange({ ...ev, endMin: m })} />
        {ev.type === 'resource_capacity_changed' && <NumField label="New capacity" value={ev.value ?? 0} max={100} onChange={(n) => onChange({ ...ev, value: n })} />}
      </div>
      <div className="field"><label htmlFor={`r-${ev.id}`}>Reason (optional)</label><input id={`r-${ev.id}`} className="input" value={ev.reason ?? ''} onChange={(e) => onChange({ ...ev, reason: e.target.value })} /></div>
    </div>
  )
}

const FLOW = ['draft', 'interpreting', 'needs_review', 'confirmed', 'calculating'] as const

export default function DisruptionStudio() {
  const { draft: h, events, sim, apiStatus, health, validation } = useStore()
  const setEvents = useStore((s) => s.setEvents)
  const runScenario = useStore((s) => s.runScenario)
  const go = useStore((s) => s.go)
  const toast = useStore((s) => s.toast)
  const [form, setForm] = useState<Disruption | null>(null)
  const [text, setText] = useState('')
  const [clock, setClock] = useState<number | null>(() => useStore.getState().draft?.planningStartMin ?? null)
  const [interp, setInterp] = useState<'idle' | 'interpreting' | 'review' | 'error'>('idle')
  const [result, setResult] = useState<EventInterpretation | null>(null)
  const [edited, setEdited] = useState<Disruption[]>([])
  const [err, setErr] = useState<{ code: string; msg: string } | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [engine, setEngine] = useState<'auto' | 'gemini' | 'rules'>('auto')
  const ctl = useRef<AbortController | null>(null)
  if (!h) return null
  const geminiOn = !!health?.ai.available
  const aiOn = apiStatus === 'online'            // the built-in rule parser needs no AI key, so interpretation works whenever the API does
  const presets = buildPresets(h)
  const allConfirmed = events.length > 0 && events.every((e) => e.confirmed)
  const calculating = sim.status === 'calculating'
  const flow = calculating ? 'calculating' : interp === 'interpreting' ? 'interpreting' : interp === 'review' ? 'needs_review' : allConfirmed ? 'confirmed' : 'draft'
  const blocked = validation === 'invalid' || apiStatus === 'offline'

  const blank = (): Disruption => ({ id: uid('ev'), type: 'member_unavailable', affectedEntityIds: [], startMin: h.planningStartMin, endMin: Math.min(1080, h.planningEndMin), reason: '', value: null, confirmed: false })
  const formValid = form && form.affectedEntityIds.length > 0 && form.startMin < form.endMin
  const upsert = (e: Disruption) => setEvents(events.some((x) => x.id === e.id) ? events.map((x) => (x.id === e.id ? e : x)) : [...events, e])

  const interpret = async () => {
    ctl.current?.abort(); ctl.current = new AbortController()
    setInterp('interpreting'); setErr(null); setResult(null); setReviewed(false)
    try {
      const r = await api.interpret(h, text, clock, ctl.current.signal, engine)
      setResult(r); setEdited(r.proposedEvents); setInterp('review')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { setInterp('idle'); return }
      const f = e as ApiFailure
      setErr({ code: f.code, msg: f.message }); setInterp('error')
    }
  }
  const confirmInterpretation = () => {
    const ok = edited.filter((e) => e.affectedEntityIds.length && e.startMin < e.endMin).map((e) => ({ ...e, confirmed: true }))
    if (!ok.length) return
    setEvents([...events, ...ok]); setInterp('idle'); setResult(null); setText('')
    toast('success', `${ok.length} interpreted event(s) confirmed and added to the scenario.`)
  }
  const run = async () => { if (await runScenario()) go('cascade') }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PageHeader eyebrow="03 · Disruption Injection Studio" title="What changed?">
        <button className="btn primary" disabled={!allConfirmed || calculating || blocked} onClick={() => void run()} title={blocked ? 'Household invalid or backend offline' : undefined}>
          {calculating ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run scenario</button>
      </PageHeader>

      <ol aria-label="Scenario state" style={{ display: 'flex', gap: 6, listStyle: 'none', padding: 0, margin: 0, flexWrap: 'wrap' }}>
        {FLOW.map((s) => <li key={s} className={`chip ${flow === s ? 'dark' : ''}`} aria-current={flow === s ? 'step' : undefined}>{s.replace('_', ' ')}</li>)}
      </ol>

      {sim.status === 'error' && <Banner kind="bad">Simulation failed: {sim.error} <button className="btn sm" onClick={() => void run()}>Retry</button></Banner>}
      {blocked && <Banner kind="warn">{apiStatus === 'offline' ? 'Backend offline — you can stage events, but cannot run the scenario.' : 'Fix household validation errors in Family Network first.'}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14, alignItems: 'start' }}>
        <section className="card card-pad" aria-labelledby="presets">
          <h3 id="presets"><Wand2 size={15} aria-hidden /> Scenario presets</h3>
          <p className="muted" style={{ marginTop: 2 }}>Derived from this household. Loading a preset stages unconfirmed events for your review.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {presets.map((p) => (
              <button key={p.key} className="btn" style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '10px 12px' }}
                onClick={() => { setEvents(p.events.map((e) => ({ ...e, id: uid('ev') }))); setForm(null) }}>
                <span><b>{p.title}</b><br /><span className="muted" style={{ fontWeight: 500 }}>{p.blurb}</span></span></button>))}
          </div>
        </section>

        <section className="card card-pad" aria-labelledby="manual">
          <h3 id="manual">Manual disruption</h3>
          <p className="muted" style={{ marginTop: 2 }}>Works without any AI.</p>
          {!form ? <button className="btn" onClick={() => setForm(blank())}><Plus size={15} /> New event</button> : (
            <div style={{ display: 'grid', gap: 10 }}>
              <EventFields h={h} ev={form} onChange={setForm} />
              {form.affectedEntityIds.length === 0 && <span className="chip warn">Choose at least one affected entity.</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn primary" disabled={!formValid} onClick={() => { upsert(form); setForm(null) }}>Stage event</button>
                <button className="btn" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </div>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="nl">
          <h3 id="nl"><Sparkles size={15} aria-hidden /> Describe it in plain language</h3>
          {apiStatus === 'offline'
            ? <Banner kind="warn">The backend is offline, so text cannot be interpreted right now. Presets and the manual form can still be staged; they run when the API is back.</Banner>
            : <p className="muted" style={{ margin: '2px 0 0', fontSize: 12.5 }}>
              Interpreter: <b>{geminiOn ? `Gemini (${health?.ai.model}) with automatic fallback to the built-in rule parser` : 'built-in rule parser (deterministic, needs no AI key)'}</b>.
              The result is only a <i>proposal</i> — you review and confirm every field.</p>}
          {geminiOn && (
            <div className="field" style={{ marginTop: 6 }}><label htmlFor="nl-engine">Engine</label>
              <select id="nl-engine" className="input" value={engine} onChange={(e) => setEngine(e.target.value as 'auto' | 'gemini' | 'rules')}>
                <option value="auto">Auto (Gemini, falling back to the built-in parser)</option><option value="gemini">Gemini only</option><option value="rules">Built-in rule parser only</option></select></div>)}
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div className="field"><label htmlFor="nl-text">Message</label>
              <textarea id="nl-text" className="input" rows={3} maxLength={600} value={text} placeholder={`e.g. “${h.members.find((m) => !m.isDependent)?.name ?? 'Amina'} cannot help until 6 PM”`} onChange={(e) => setText(e.target.value)} disabled={!aiOn} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
              <TimeField label={clock === null ? "Scenario clock — NOT SET (edit to set; start times will need clarification)" : "Scenario clock (used if no start time is stated)"} value={clock ?? h.planningStartMin} onChange={setClock} />
              <button className="btn" onClick={() => setClock(null)} disabled={clock === null} title="Without a scenario clock, phrases like 'until 6 PM' need clarification">Unset</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn primary" disabled={!aiOn || !text.trim() || interp === 'interpreting'} onClick={() => void interpret()}>
                {interp === 'interpreting' ? <Spinner label="Interpreting…" /> : 'Interpret with AI'}</button>
              <button className="btn" onClick={() => { ctl.current?.abort(); setText(''); setResult(null); setInterp('idle'); setErr(null) }}>Clear</button>
            </div>
            {interp === 'error' && err && <Banner kind="bad"><b>{err.code}</b> — {err.msg} No interpretation was produced; use the manual form.</Banner>}
          </div>
          {interp === 'review' && result && (
            <div style={{ marginTop: 14, display: 'grid', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="eyebrow">Review extracted details · {result.interpretationStatus.replace('_', ' ')} · interpreted by {result.engine === 'gemini' ? `Gemini (${result.model})` : 'built-in rule parser'}</div>
              {result.engineNote && <Banner kind="info">{result.engineNote}</Banner>}
              {result.warnings.map((w) => <Banner key={w} kind="warn">{w}</Banner>)}
              {result.unresolvedMentions.length > 0 && <Banner kind="bad">Unknown names (not in this household): <b>{result.unresolvedMentions.join(', ')}</b>. They were not invented.</Banner>}
              {result.ambiguities.filter((a) => !a.startsWith('Unknown names')).map((a) => <Banner key={a} kind="warn">{a}</Banner>)}
              {result.assumptions.map((a) => <Banner key={a} kind="info">Assumption: {a}</Banner>)}
              {edited.map((e, i) => (<div key={e.id} className="card card-pad" style={{ background: 'var(--surface-2)' }}><EventFields h={h} ev={e} onChange={(n) => setEdited(edited.map((x, j) => (j === i ? n : x)))} /></div>))}
              {edited.length === 0 && <Banner kind="bad">Nothing could be safely interpreted. Rephrase, or use the manual form.</Banner>}
              {(result.ambiguities.length > 0 || result.requiredConfirmations.length > 1) && (
                <label style={{ display: 'flex', gap: 8 }}><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> I have reviewed and corrected every flagged field.</label>)}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn primary" disabled={!edited.length || edited.some((e) => !e.affectedEntityIds.length) || ((result.ambiguities.length > 0 || result.requiredConfirmations.length > 1) && !reviewed)} onClick={confirmInterpretation}>
                  <CheckCheck size={15} /> Confirm interpretation</button>
                <button className="btn" onClick={() => { setInterp('idle'); setResult(null) }}>Discard</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card card-pad" aria-labelledby="scenario">
        <h3 id="scenario">Scenario ({events.length} event{events.length === 1 ? '' : 's'})</h3>
        {events.length === 0 && <p className="muted">No events yet. Load a preset, add a manual event, or interpret a sentence.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {events.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 10 }}>
              <span className={`chip ${e.confirmed ? 'ok' : 'warn'}`}>{e.confirmed ? '✓ confirmed' : '● needs confirmation'}</span>
              <b>{EVENT_TYPE_LABEL[e.type]}</b>
              <span>{e.affectedEntityIds.map((i) => entityLabel(h, i)).join(', ')}</span>
              <span className="mono muted">{fmtRange(e.startMin, e.endMin)}{e.type === 'resource_capacity_changed' ? ` → cap ${e.value}` : ''}</span>
              {e.reason && <span className="muted" style={{ fontSize: 12 }}>“{e.reason}”</span>}
              <span style={{ flex: 1 }} />
              {!e.confirmed && <button className="btn sm primary" disabled={!e.affectedEntityIds.length} onClick={() => upsert({ ...e, confirmed: true })}>Confirm</button>}
              <button className="btn sm" onClick={() => setForm({ ...e, confirmed: false })}>Edit</button>
              <button className="btn sm danger" aria-label="Remove event" onClick={() => setEvents(events.filter((x) => x.id !== e.id))}><Trash2 size={13} /></button>
            </div>))}
        </div>
        {events.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn" disabled={allConfirmed} onClick={() => setEvents(events.map((e) => (e.affectedEntityIds.length ? { ...e, confirmed: true } : e)))}><CheckCheck size={15} /> Confirm all</button>
            <button className="btn" onClick={() => setEvents([])}><X size={15} /> Clear scenario</button>
            <button className="btn primary" disabled={!allConfirmed || calculating || blocked} onClick={() => void run()}>{calculating ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run scenario</button>
            {!allConfirmed && <span className="muted" style={{ alignSelf: 'center', fontSize: 12.5 }}>Every event must be confirmed before it can run — unconfirmed events never reach the solver.</span>}
          </div>
        )}
      </section>
    </div>
  )
}
