import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Cog, Loader2, Plus, Users } from 'lucide-react'
import { Constellation } from '../components/graph/Constellation'
import { MemberEditor, ResourceEditor, TaskEditor, blankTask } from '../components/forms/Editors'
import { Banner, Modal } from '../components/ui/ui'
import { bundledFixture, bundledSummaries } from '../services/fixtures'
import { useStore } from '../state/store'
import type { FamilyMember, Household } from '../types'

const STEPS = [
  { t: 'Model the family', d: 'Members, skills, explicit permissions, availability, shared resources and responsibilities are structured, validated data — never inferred from age.' },
  { t: 'Confirm a disruption', d: 'Describe it with the form, a preset, or plain language (Gemini proposes; you review and confirm every field). Nothing unconfirmed reaches the solver.' },
  { t: 'Trace the cascade', d: 'A typed dependency graph finds what is directly invalidated and which prerequisites downstream are now threatened, keeping every causal path.' },
  { t: 'Optimize recovery', d: 'Google OR-Tools CP-SAT searches legal assignments: Tier 0 coverage first, then Tier 1, then the rest, then the strategy’s preferences.' },
  { t: 'Verify independently', d: 'A separate verifier re-checks 18 rules from raw data. If a critical task cannot be covered, DOMINO says so — and a human must approve.' },
]

export default function Launch() {
  const { fixtures, usingBundled, draft, householdId, apiStatus } = useStore()
  const load = useStore((s) => s.loadHousehold)
  const [hover, setHover] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [how, setHow] = useState(false)
  const [step, setStep] = useState(0)
  const [cfg, setCfg] = useState(false)
  const list = fixtures.length ? fixtures : bundledSummaries()
  const previewId = hover ?? householdId ?? 'amina'
  const preview: Household | null = useMemo(() => (draft && previewId === householdId ? draft : bundledFixture(previewId)), [previewId, draft, householdId])

  const start = async (id: string) => { setLoading(id); await load(id, true); setLoading(null) }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-canvas">{preview && <Constellation h={preview} height={560} />}</div>
        <div style={{ position: 'relative', padding: 'clamp(24px, 4vw, 56px)', maxWidth: 640, pointerEvents: 'none' }}>
          <div className="wordmark">DOMINO · FAMILY RESILIENCE INTELLIGENCE SYSTEM</div>
          <h1 id="hero-title" style={{ margin: '14px 0' }}>When one thing changes, everything connects.</h1>
          <p style={{ fontSize: 17, color: '#cfe1f1', maxWidth: 520 }}>Explore how family responsibilities interact, simulate disruptions, and calculate verified recovery plans.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22, pointerEvents: 'auto' }}>
            <button className="btn primary" style={{ minHeight: 46, padding: '10px 20px', fontSize: 15 }} onClick={() => void start('amina')} disabled={loading !== null}>
              {loading === 'amina' ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />} Explore Amina Family</button>
            <button className="btn" style={{ minHeight: 46, background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => { setStep(0); setHow(true) }}>
              <BookOpen size={16} /> Learn How DOMINO Works</button>
          </div>
          <p className="mono" style={{ fontSize: 11.5, color: '#82b2d6', marginTop: 28, maxWidth: 440 }}>
            Every node you see is a member, responsibility or resource of {preview?.name ?? 'the selected household'} (fictional). Move the pointer to rotate it.
          </p>
        </div>
      </section>

      {apiStatus === 'offline' && <Banner kind="warn"><b>Backend not reachable.</b> Households can still be opened from read-only bundled copies{usingBundled ? '' : ''}, but simulation, optimization and verification stay disabled until the API is online.</Banner>}

      <section aria-labelledby="hh-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <h2 id="hh-title" style={{ fontSize: 22, flex: 1 }}>Choose a fictional household</h2>
          <button className="btn" onClick={() => setCfg(true)}><Cog size={15} /> Configure Household</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 14 }}>
          {list.map((f) => (
            <article key={f.id} className="card card-pad" onPointerEnter={() => setHover(f.id)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(f.id)} onBlur={() => setHover(null)}
              style={{ outline: householdId === f.id ? '2px solid var(--primary)' : undefined }}>
              <div className="eyebrow">{f.id}</div>
              <h3 style={{ fontSize: 18, margin: '2px 0 6px' }}>{f.name}</h3>
              <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>{f.description}</p>
              <div className="mono muted" style={{ fontSize: 12, display: 'flex', gap: 14, marginBottom: 12 }}><span><Users size={12} aria-hidden /> {f.members} members</span><span>{f.tasks} responsibilities</span><span>{f.resources} resources</span></div>
              <button className="btn primary" onClick={() => void start(f.id)} disabled={loading !== null} aria-label={`Explore ${f.name}`}>
                {loading === f.id ? <Loader2 size={15} className="spin" /> : <ArrowRight size={15} />} Explore {f.id === 'amina' ? 'Amina Family' : f.id === 'multigenerational' ? 'Multigenerational Family' : 'Restricted Transportation Family'}</button>
            </article>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>All households are fictional. DOMINO models hypothetical events with the information you give it; it does not predict real emergencies or contact anyone.</p>
      </section>

      <Modal open={how} onClose={() => setHow(false)} title={`How DOMINO works · step ${step + 1} of ${STEPS.length}`}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="eyebrow">0{step + 1}</div>
          <h3 style={{ fontSize: 24 }}>{STEPS[step].t}</h3>
          <p style={{ fontSize: 15, margin: 0 }}>{STEPS[step].d}</p>
          <div style={{ display: 'flex', gap: 6 }} aria-hidden>{STEPS.map((_, i) => <span key={i} style={{ height: 4, flex: 1, borderRadius: 4, background: i <= step ? 'var(--primary)' : 'var(--line)' }} />)}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < STEPS.length - 1 ? <button className="btn primary" onClick={() => setStep(step + 1)}>Next</button>
              : <button className="btn primary" onClick={() => { setHow(false); void start('amina') }}>Try it with the Amina Family</button>}
          </div>
        </div>
      </Modal>
      {cfg && <ConfigureDialog open={cfg} onClose={() => setCfg(false)} />}
    </div>
  )
}

function ConfigureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { draft, validation, issues, householdId } = useStore()
  const load = useStore((s) => s.loadHousehold)
  const edit = useStore((s) => s.editHousehold)
  const go = useStore((s) => s.go)
  const [tab, setTab] = useState<'members' | 'tasks' | 'resources'>('members')
  const [sel, setSel] = useState<string | null>(null)
  const errs = issues.filter((i) => i.severity === 'error')
  const addMember = () => edit((h) => {
    let n = h.members.length + 1
    while (h.members.some((m) => m.id === `P${String(n).padStart(2, '0')}`)) n++
    const m: FamilyMember = { id: `P${String(n).padStart(2, '0')}`, name: 'New member', age: 30, role: 'adult', isDependent: false, skills: [], permissions: [], restrictions: [],
      availability: [{ startMin: h.planningStartMin, endMin: h.planningEndMin }], homeLocationId: h.locations[0]?.id ?? 'L01', authorizedDependentIds: [], baselineWorkloadMinutes: 0 }
    setSel(m.id)
    return { ...h, members: [...h.members, m] }
  })
  const addTask = () => edit((h) => { const t = blankTask(h); setSel(t.id); return { ...h, tasks: [...h.tasks, t] } })
  const items = !draft ? [] : tab === 'members' ? draft.members.map((m) => ({ id: m.id, label: m.name })) : tab === 'tasks' ? draft.tasks.map((t) => ({ id: t.id, label: t.title })) : draft.resources.map((r) => ({ id: r.id, label: r.name }))
  return (
    <Modal open={open} onClose={onClose} title="Configure household" wide>
      <div style={{ display: 'grid', gap: 14 }}>
        <p style={{ margin: 0 }}>Start from a validated fictional template, then edit members, responsibilities and resources. Every change is validated by the backend before simulation is allowed.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="lbl">Template:</span>
          {bundledSummaries().map((f) => <button key={f.id} className={`btn sm ${householdId === f.id ? 'primary' : ''}`} onClick={() => void load(f.id, false)}>{f.name}</button>)}
        </div>
        {!draft ? <Banner>Pick a template to begin.</Banner> : (<>
          <div className="tabs" role="tablist">
            {(['members', 'tasks', 'resources'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className="tab" onClick={() => { setTab(t); setSel(null) }}>{t[0].toUpperCase() + t.slice(1)}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: 16 }}>
            <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
              {items.map((i) => <button key={i.id} className={`btn sm ${sel === i.id ? 'primary' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setSel(i.id)}>{i.label}</button>)}
              {tab === 'members' && <button className="btn sm" onClick={addMember}><Plus size={13} /> Add member</button>}
              {tab === 'tasks' && <button className="btn sm" onClick={addTask}><Plus size={13} /> Add task</button>}
            </div>
            <div>
              {!sel ? <p className="muted">Select an item to edit.</p> : tab === 'members' ? <MemberEditor id={sel} /> : tab === 'tasks' ? <TaskEditor id={sel} /> : <ResourceEditor id={sel} />}
            </div>
          </div>
          {validation === 'checking' && <Banner>Validating…</Banner>}
          {errs.length > 0 && <Banner kind="bad"><b>{errs.length} validation error(s) must be fixed:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{errs.slice(0, 5).map((e, i) => <li key={i}>{e.message}</li>)}</ul></Banner>}
          {validation === 'valid' && <Banner kind="ok">Household passes backend validation{issues.length ? ` (${issues.length} warning(s))` : ''}.</Banner>}
          {validation === 'unchecked' && <Banner kind="warn">Validation unavailable (backend offline). You can keep editing; simulation stays disabled.</Banner>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn primary" disabled={errs.length > 0 || validation === 'checking'} onClick={() => { onClose(); go('network') }}>Open in Family Network</button>
          </div>
        </>)}
      </div>
    </Modal>
  )
}
