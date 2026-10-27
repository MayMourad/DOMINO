import { Plus, Trash2 } from 'lucide-react'
import type { FamilyMember, Household, HouseholdResource, HouseholdTask, TimeWindow } from '../../types'
import { fmtRange } from '../../lib/time'
import { useStore } from '../../state/store'
import { NumField, Tags, TimeField } from '../ui/ui'

const SKILLS = ['driving', 'shopping', 'homework_assist', 'meal_prep', 'household_checkin']
const PERMS = ['drive', 'pickup_authorized']

export function Windows({ label, value, onChange }: { label: string; value: TimeWindow[]; onChange: (w: TimeWindow[]) => void }) {
  return (
    <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, margin: 0 }}>
      <legend className="lbl" style={{ padding: '0 6px' }}>{label}</legend>
      {value.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No windows — never available.</div>}
      {value.map((w, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end', marginBottom: 6 }}>
          <TimeField label="From" value={w.startMin} max={w.endMin - 1} onChange={(m) => onChange(value.map((x, j) => (j === i ? { ...x, startMin: m } : x)))} />
          <TimeField label="Until" value={w.endMin} min={w.startMin + 1} onChange={(m) => onChange(value.map((x, j) => (j === i ? { ...x, endMin: m } : x)))} />
          <button className="btn sm danger" aria-label={`Remove window ${fmtRange(w.startMin, w.endMin)}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="btn sm" onClick={() => onChange([...value, { startMin: 900, endMin: 960 }])}><Plus size={14} /> Add window</button>
    </fieldset>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
}

export function MemberEditor({ id }: { id: string }) {
  const h = useStore((s) => s.draft)!
  const edit = useStore((s) => s.editHousehold)
  const m = h.members.find((x) => x.id === id)
  if (!m) return null
  const set = (patch: Partial<FamilyMember>) => edit((d) => ({ ...d, members: d.members.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const deps = h.members.filter((x) => x.isDependent)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
        <div className="field"><label htmlFor="m-name">Name</label><input id="m-name" className="input" value={m.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={!m.name.trim()} /></div>
        <NumField label="Age" value={m.age} max={120} onChange={(n) => set({ age: n })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field"><label htmlFor="m-role">Role</label>
          <select id="m-role" className="input" value={m.role} onChange={(e) => set({ role: e.target.value as FamilyMember['role'] })}>
            {['adult', 'teen', 'child', 'senior'].map((r) => <option key={r}>{r}</option>)}</select></div>
        <div className="field"><label>&nbsp;</label><Check label="Dependent (never assigned tasks)" checked={m.isDependent} onChange={(v) => set({ isDependent: v, authorizedDependentIds: v ? [] : m.authorizedDependentIds })} /></div>
      </div>
      <Windows label="Availability" value={m.availability} onChange={(w) => set({ availability: w })} />
      <Tags label="Skills" values={m.skills} suggestions={SKILLS} onChange={(v) => set({ skills: v })} />
      <Tags label="Explicit permissions (age never grants any)" values={m.permissions} suggestions={PERMS} onChange={(v) => set({ permissions: v })} />
      <Tags label="Restrictions" values={m.restrictions} suggestions={PERMS} onChange={(v) => set({ restrictions: v })} />
      {!m.isDependent && deps.length > 0 && (
        <div className="field"><span className="lbl">Authorized to care for</span>
          {deps.map((d) => <Check key={d.id} label={d.name} checked={m.authorizedDependentIds.includes(d.id)}
            onChange={(v) => set({ authorizedDependentIds: v ? [...m.authorizedDependentIds, d.id] : m.authorizedDependentIds.filter((x) => x !== d.id) })} />)}
        </div>
      )}
      <NumField label="Existing workload outside DOMINO (min)" value={m.baselineWorkloadMinutes} max={1440} onChange={(n) => set({ baselineWorkloadMinutes: n })} />
    </div>
  )
}

export function ResourceEditor({ id }: { id: string }) {
  const h = useStore((s) => s.draft)!
  const edit = useStore((s) => s.editHousehold)
  const r = h.resources.find((x) => x.id === id)
  if (!r) return null
  const set = (patch: Partial<HouseholdResource>) => edit((d) => ({ ...d, resources: d.resources.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="field"><label htmlFor="r-name">Name</label><input id="r-name" className="input" value={r.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field"><label htmlFor="r-type">Type</label><input id="r-type" className="input" value={r.type} onChange={(e) => set({ type: e.target.value.trim().toLowerCase().replace(/\s+/g, '_') })} /></div>
        <NumField label="Capacity (units)" value={r.capacity} max={100} onChange={(n) => set({ capacity: n })} />
      </div>
      <Check label="Exclusive (one task at a time)" checked={r.exclusive} onChange={(v) => set({ exclusive: v })} />
      <Windows label="Available" value={r.availability} onChange={(w) => set({ availability: w })} />
      <Windows label="Unavailable (blocked)" value={r.unavailableWindows} onChange={(w) => set({ unavailableWindows: w })} />
    </div>
  )
}

export function TaskEditor({ id }: { id: string }) {
  const h = useStore((s) => s.draft)!
  const edit = useStore((s) => s.editHousehold)
  const t = h.tasks.find((x) => x.id === id)
  if (!t) return null
  const base = h.baselineAssignments.find((a) => a.taskId === id)
  const set = (patch: Partial<HouseholdTask>) => edit((d) => ({
    ...d,
    tasks: d.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    // keep the declared baseline consistent with an edited duration
    baselineAssignments: d.baselineAssignments.map((a) => (a.taskId === id && patch.durationMin ? { ...a, endMin: a.startMin + patch.durationMin } : a)),
  }))
  const setBase = (memberId: string | '', start?: number) => edit((d) => {
    const rest = d.baselineAssignments.filter((a) => a.taskId !== id)
    if (!memberId) return { ...d, baselineAssignments: rest }
    const s = start ?? base?.startMin ?? t.earliestStartMin
    const res = t.requiredResourceTypes.map((ty) => d.resources.find((r) => r.type === ty)?.id).filter((x): x is string => !!x)
    return { ...d, baselineAssignments: [...rest, { taskId: id, memberId, startMin: s, endMin: s + t.durationMin, resourceIds: res, itineraryId: base?.itineraryId ?? null, changedFromBaseline: false }] }
  })
  const others = h.tasks.filter((x) => x.id !== id)
  const toggle = (arr: string[], v: string, on: boolean) => (on ? [...arr, v] : arr.filter((x) => x !== v))
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="field"><label htmlFor="t-title">Title</label><input id="t-title" className="input" value={t.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={!t.title.trim()} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="field"><label htmlFor="t-tier">Priority tier</label>
          <select id="t-tier" className="input" value={t.tier} onChange={(e) => set({ tier: Number(e.target.value) as HouseholdTask['tier'] })}>
            <option value={0}>0 · Essential</option><option value={1}>1 · Important</option><option value={2}>2 · Routine</option><option value={3}>3 · Deferrable</option></select></div>
        <NumField label="Weight" value={t.priorityWeight} min={1} max={100} onChange={(n) => set({ priorityWeight: n })} />
        <NumField label="Duration (min)" value={t.durationMin} min={5} max={720} onChange={(n) => set({ durationMin: n })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TimeField label="Earliest start" value={t.earliestStartMin} onChange={(m) => set({ earliestStartMin: m })} />
        <TimeField label="Latest end" value={t.latestEndMin} onChange={(m) => set({ latestEndMin: m })} />
      </div>
      {t.latestEndMin - t.earliestStartMin < t.durationMin && <div className="chip warn">Window shorter than duration — this task can never be scheduled.</div>}
      <Check label="Fixed start time" checked={t.fixedStartMin != null} onChange={(v) => set({ fixedStartMin: v ? t.earliestStartMin : null })} />
      {t.fixedStartMin != null && <TimeField label="Fixed start" value={t.fixedStartMin} onChange={(m) => set({ fixedStartMin: m })} />}
      <Tags label="Required skills" values={t.requiredSkills} suggestions={SKILLS} onChange={(v) => set({ requiredSkills: v })} />
      <Tags label="Required permissions" values={t.requiredPermissions} suggestions={PERMS} onChange={(v) => set({ requiredPermissions: v })} />
      <Tags label="Required resource types" values={t.requiredResourceTypes} suggestions={[...new Set(h.resources.map((r) => r.type))]} onChange={(v) => set({ requiredResourceTypes: v })} />
      <div className="field"><span className="lbl">Prerequisite tasks</span>
        {others.length === 0 && <span className="muted">No other tasks.</span>}
        {others.map((o) => <Check key={o.id} label={`${o.id} · ${o.title}`} checked={t.predecessorTaskIds.includes(o.id)} onChange={(v) => set({ predecessorTaskIds: toggle(t.predecessorTaskIds, o.id, v) })} />)}</div>
      {h.milestones.length > 0 && <div className="field"><span className="lbl">Required milestones</span>
        {h.milestones.map((o) => <Check key={o.id} label={o.title} checked={t.requiredMilestoneIds.includes(o.id)} onChange={(v) => set({ requiredMilestoneIds: toggle(t.requiredMilestoneIds, o.id, v) })} />)}</div>}
      <div className="field"><span className="lbl">Serves dependent</span>
        {h.members.filter((m) => m.isDependent).map((d) => <Check key={d.id} label={d.name} checked={t.requiredDependentIds.includes(d.id)} onChange={(v) => set({ requiredDependentIds: toggle(t.requiredDependentIds, d.id, v) })} />)}</div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Check label="Needs assignee's consent" checked={t.requiredConsent} onChange={(v) => set({ requiredConsent: v })} />
        <Check label="Optional" checked={t.isOptional} onChange={(v) => set({ isOptional: v })} />
      </div>
      <fieldset style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, margin: 0 }}>
        <legend className="lbl" style={{ padding: '0 6px' }}>Baseline assignment (the schedule before any disruption)</legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="field"><label htmlFor="t-base">Assigned to</label>
            <select id="t-base" className="input" value={base?.memberId ?? ''} onChange={(e) => setBase(e.target.value)}>
              <option value="">— nobody —</option>{h.members.filter((m) => !m.isDependent).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          {base && <TimeField label="Starts" value={base.startMin} onChange={(m) => setBase(base.memberId, m)} />}
        </div>
      </fieldset>
    </div>
  )
}

export function newTaskId(h: Household): string {
  let n = h.tasks.length + 1
  while (h.tasks.some((t) => t.id === `T${String(n).padStart(2, '0')}`)) n++
  return `T${String(n).padStart(2, '0')}`
}

export function blankTask(h: Household): HouseholdTask {
  const loc = h.locations[0]?.id ?? 'L01'
  return {
    id: newTaskId(h), title: 'New household task', description: '', tier: 2, priorityWeight: 3, durationMin: 30,
    earliestStartMin: h.planningStartMin + 60, latestEndMin: h.planningStartMin + 240, fixedStartMin: null, requiredSkills: [], requiredPermissions: [],
    eligibleMemberIds: null, excludedMemberIds: [], requiredResourceTypes: [], resourceUnits: {}, requiredDependentIds: [], predecessorTaskIds: [],
    requiredMilestoneIds: [], originLocationId: loc, destinationLocationId: loc, requiredConsent: false, isOptional: false,
  }
}
