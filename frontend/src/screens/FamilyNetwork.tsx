import { useMemo, useState } from 'react'
import { ArrowRight, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { FamilyGraph, GraphLegend } from '../components/graph/FamilyGraph'
import { GraphTextAlternative, ScheduleStrip } from '../components/timeline/Timelines'
import { MemberEditor, ResourceEditor, TaskEditor, blankTask } from '../components/forms/Editors'
import { Banner, Modal, PageHeader, Stat } from '../components/ui/ui'
import { buildEdges, entityLabel } from '../lib/graph'
import { blankMember, blankResource, removeEntity } from '../lib/householdOps'
import { fmtRange } from '../lib/time'
import { useStore } from '../state/store'

export default function FamilyNetwork() {
  const { draft: h, reference, undoStack, selectedNodeId, issues, validation, apiStatus, events } = useStore()
  const { editHousehold, undo, resetHousehold, select, go } = useStore.getState()
  const [perm, setPerm] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const edges = useMemo(() => (h ? buildEdges(h, h.baselineAssignments).filter((e) => e.type !== 'requires_permission').length : 0), [h])
  if (!h) return null
  const selTask = h.tasks.find((t) => t.id === selectedNodeId)
  const selMember = h.members.find((m) => m.id === selectedNodeId)
  const selRes = h.resources.find((r) => r.id === selectedNodeId)
  const selMs = h.milestones.find((m) => m.id === selectedNodeId)
  const errs = issues.filter((i) => i.severity === 'error')
  const warns = issues.filter((i) => i.severity === 'warning')
  const changed = JSON.stringify(h) !== JSON.stringify(reference)
  const covered = h.baselineAssignments.length

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PageHeader eyebrow="02 · Family Network" title={h.name}>
        <button className="btn" onClick={undo} disabled={!undoStack.length}><Undo2 size={15} /> Undo</button>
        <button className="btn" onClick={resetHousehold} disabled={!changed && undoStack.length === 0 && events.length === 0}><RotateCcw size={15} /> Reset household</button>
        <button className="btn primary" disabled={validation === 'invalid' || validation === 'checking'} onClick={() => go('studio')}>Continue to Disruption Studio <ArrowRight size={15} /></button>
      </PageHeader>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <Stat label="Members" value={h.members.length} sub={`${h.members.filter((m) => m.isDependent).length} dependent`} />
        <Stat label="Responsibilities" value={h.tasks.length} sub={`${h.tasks.filter((t) => t.tier <= 1).length} critical (T0–1)`} />
        <Stat label="Resources" value={h.resources.length} />
        <Stat label="Relationships" value={edges} sub="typed edges" />
        <Stat label="Baseline coverage" value={`${covered}/${h.tasks.length}`} sub="tasks with a declared assignee" tone={covered < h.tasks.length ? 'warn' : undefined} />
        <Stat label="Validation" value={validation === 'valid' ? '✓' : validation === 'invalid' ? '✗' : validation === 'checking' ? '…' : '—'} sub={validation === 'unchecked' ? 'backend offline' : `${errs.length} errors · ${warns.length} warnings`} tone={errs.length ? 'bad' : warns.length ? 'warn' : validation === 'valid' ? 'ok' : undefined} />
      </div>

      {errs.length > 0 && <Banner kind="bad"><b>Simulation is blocked until these are fixed:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{errs.map((e, i) => <li key={i}>{e.message}</li>)}</ul></Banner>}
      {warns.length > 0 && <Banner kind="warn"><b>Warnings:</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{warns.map((e, i) => <li key={i}>{e.message}</li>)}</ul></Banner>}
      {apiStatus === 'offline' && undoStack.length > 0 && <Banner kind="info">Your edits are kept in this browser until the backend returns.</Banner>}

      <div className="grid-3">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn sm" onClick={() => editHousehold((d) => { const t = blankTask(d); select(t.id); return { ...d, tasks: [...d.tasks, t] } })}><Plus size={14} /> Add task</button>
            <button className="btn sm" onClick={() => editHousehold((d) => { const m = blankMember(d); select(m.id); return { ...d, members: [...d.members, m] } })}><Plus size={14} /> Add member</button>
            <button className="btn sm" onClick={() => editHousehold((d) => { const r = blankResource(d); select(r.id); return { ...d, resources: [...d.resources, r] } })}><Plus size={14} /> Add resource</button>
            <button className="btn sm danger" disabled={!(selTask || selMember || selRes)} onClick={() => setConfirmDel(true)}><Trash2 size={14} /> Remove selected</button>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={perm} onChange={(e) => setPerm(e.target.checked)} /> Show permission edges</label>
            <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>Drag nodes to rearrange · scroll to zoom · select to edit</span>
          </div>
          <FamilyGraph h={h} assignments={h.baselineAssignments} draggable showPermissionEdges={perm} selectedId={selectedNodeId} onSelect={select} height={560} />
          <GraphLegend mode="network" />
          <div className="card card-pad" style={{ marginTop: 14 }}>
            <h3 style={{ marginBottom: 8 }}>Baseline schedule</h3>
            <ScheduleStrip h={h} assignments={h.baselineAssignments} onSelect={select} selectedId={selectedNodeId} />
          </div>
          <GraphTextAlternative h={h} assignments={h.baselineAssignments} />
        </div>

        <aside className="card card-pad" aria-label="Inspector" style={{ position: 'sticky', top: 70, maxHeight: 'calc(100vh - 90px)', overflow: 'auto' }}>
          {!selectedNodeId && <><h3>Inspector</h3><p className="muted">Select a person, responsibility, resource or milestone in the graph to inspect and edit it. Edits change the canonical household; any previous plan is invalidated.</p></>}
          {selMember && (<><div className="eyebrow">Family member · {selMember.id}</div><h3 style={{ marginBottom: 10 }}>{selMember.name}</h3><MemberEditor id={selMember.id} /></>)}
          {selTask && (<><div className="eyebrow">Responsibility · {selTask.id}</div><h3 style={{ marginBottom: 4 }}>{selTask.title}</h3>
            <p className="muted mono" style={{ fontSize: 12, marginTop: 0 }}>{fmtRange(selTask.earliestStartMin, selTask.latestEndMin)} · {selTask.durationMin} min</p><TaskEditor id={selTask.id} /></>)}
          {selRes && (<><div className="eyebrow">Resource · {selRes.id}</div><h3 style={{ marginBottom: 10 }}>{selRes.name}</h3><ResourceEditor id={selRes.id} /></>)}
          {selMs && (<><div className="eyebrow">Milestone · {selMs.id}</div><h3>{selMs.title}</h3>
            <p>Satisfied when <b>{selMs.enabledByTaskIds.map((t) => entityLabel(h, t)).join(', ')}</b> completes. Tasks depending on it: {h.tasks.filter((t) => t.requiredMilestoneIds.includes(selMs.id)).map((t) => t.title).join(', ') || 'none'}.</p></>)}
        </aside>
      </div>

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title="Remove from household?">
        <p>Remove <b>{selTask?.title ?? selMember?.name ?? selRes?.name}</b>? Everything that referred to it (assignments, prerequisites, permissions lists) is cleaned up so the household stays valid. You can undo this.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setConfirmDel(false)}>Cancel</button>
          <button className="btn danger" onClick={() => {
            const id = (selTask ?? selMember ?? selRes)!.id
            editHousehold((d) => removeEntity(d, id))
            select(null); setConfirmDel(false)
          }}>Remove</button>
        </div>
      </Modal>
    </div>
  )
}
