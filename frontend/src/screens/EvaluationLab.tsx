import { useEffect, useMemo, useState } from 'react'
import { Download, FlaskConical, Info, Loader2, Play, RotateCw } from 'lucide-react'
import { Banner, Modal, PageHeader, Stat } from '../components/ui/ui'
import { api, ApiFailure } from '../services/api'
import { useStore } from '../state/store'
import type { BenchCatalog, BenchResult, BenchSuite } from '../types'

type Tab = 'verification' | 'optimization' | 'dependency' | 'ai' | 'scenarios'
const TABS: { id: Tab; label: string }[] = [
  { id: 'verification', label: 'Verification' }, { id: 'optimization', label: 'Optimization' },
  { id: 'dependency', label: 'Dependency Analysis' }, { id: 'ai', label: 'AI Interpretation' }, { id: 'scenarios', label: 'Benchmark Scenarios' },
]
const REC = ['recovery', 'repeat', 'rejection', 'reset', 'alternative']

interface AiEval {
  executed: boolean; reason?: string; total: number; completed?: number; errors?: number; model?: string
  entityAccuracy?: number | null; typeAccuracy?: number | null; timeAccuracy?: number | null; uncertaintyAccuracy?: number | null; exactMatchAccuracy?: number | null
  results: { id: string; text: string; status: string; error?: string; exact?: boolean; observedStatus?: string; expected: { status: string } }[]
}

function download(name: string, mime: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}
const pct = (x?: number | null) => (x == null ? '—' : `${(x * 100).toFixed(0)}%`)

function StatusChip({ s }: { s: BenchResult['status'] }) {
  return <span className={`chip ${s === 'pass' ? 'ok' : s === 'fail' ? 'bad' : 'warn'}`}>{s === 'pass' ? '✓ pass' : s === 'fail' ? '✗ FAIL' : '○ not run'}</span>
}

function CaseRow({ r, onReplay, replaying }: { r: BenchResult; onReplay: (id: string) => void; replaying: boolean }) {
  return (
    <details style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '6px 10px', background: r.status === 'fail' ? 'var(--bad-bg)' : '#fff' }}>
      <summary style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', listStyle: 'none', flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontWeight: 600, minWidth: 34 }}>{r.id}</span><span style={{ flex: 1, minWidth: 200 }}>{r.title}</span>
        <span className="chip mono">{r.kind}</span><StatusChip s={r.status} /><span className="mono muted" style={{ fontSize: 11 }}>{r.elapsedMs} ms</span>
      </summary>
      <div style={{ display: 'grid', gap: 8, padding: '8px 0', fontSize: 13 }}>
        <div><div className="eyebrow">Expected behavior</div><ul style={{ margin: '2px 0', paddingLeft: 18 }}>{r.expected.map((e) => <li key={e}>{e}</li>)}</ul></div>
        <div><div className="eyebrow">Observed behavior</div>{r.notRunReason ? <p style={{ margin: '2px 0' }}>Not run: {r.notRunReason}</p> : <ul style={{ margin: '2px 0', paddingLeft: 18 }} className="mono">{r.observed.map((e, i) => <li key={i} style={{ fontSize: 12 }}>{e}</li>)}</ul>}</div>
        {r.failures.length > 0 && <Banner kind="bad"><b>Failures:</b><ul style={{ margin: '2px 0', paddingLeft: 18 }}>{r.failures.map((f) => <li key={f}>{f}</li>)}</ul></Banner>}
        <details><summary className="muted" style={{ cursor: 'pointer' }}>Saved inputs</summary><pre className="mono" style={{ fontSize: 11, overflow: 'auto', background: 'var(--surface-2)', padding: 8, borderRadius: 8 }}>{JSON.stringify(r.inputs, null, 1)}</pre></details>
        <div><button className="btn sm" disabled={replaying} onClick={() => onReplay(r.id)}><RotateCw size={13} /> Replay scenario</button></div>
      </div>
    </details>
  )
}

export default function EvaluationLab() {
  const { bench, apiStatus, health } = useStore()
  const run = useStore((s) => s.runBenchmarks)
  const [tab, setTab] = useState<Tab>('verification')
  const [cat, setCat] = useState<BenchCatalog | null>(null)
  const [catErr, setCatErr] = useState<string | null>(null)
  const [method, setMethod] = useState(false)
  const [replay, setReplay] = useState<{ id: string; r?: BenchResult; same?: boolean; busy: boolean } | null>(null)
  const [ai, setAi] = useState<{ status: 'idle' | 'running' | 'ready' | 'error'; data?: AiEval; error?: string }>({ status: 'idle' })
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail' | 'not_run'>('all')
  const suite: BenchSuite | undefined = bench.data

  useEffect(() => {
    api.benchCatalog().then(setCat).catch((e: ApiFailure) => setCatErr(e.message))
  }, [apiStatus])

  const results = useMemo(() => suite?.results ?? [], [suite])
  const by = (pred: (r: BenchResult) => boolean) => results.filter(pred)
  const shown = useMemo(() => results.filter((r) => filter === 'all' || r.status === filter), [results, filter])

  const doReplay = async (id: string) => {
    setReplay({ id, busy: true })
    try {
      const out = await api.benchRun([id])
      const r = out.results[0]
      const before = results.find((x) => x.id === id)
      setReplay({ id, r, busy: false, same: !!before && JSON.stringify(before.inputs) === JSON.stringify(r.inputs) && before.status === r.status })
    } catch (e) { setReplay({ id, busy: false }); useStore.getState().toast('error', (e as ApiFailure).message) }
  }
  const runAi = async () => {
    setAi({ status: 'running' })
    try {
      const r = await fetch(`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''}/v1/benchmarks/ai-interpretation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!r.ok) throw new Error((await r.json()).error?.message ?? 'Request failed')
      setAi({ status: 'ready', data: await r.json() })
    } catch (e) { setAi({ status: 'error', error: (e as Error).message }) }
  }
  const exportJson = () => suite && download('domino-benchmark.json', 'application/json', JSON.stringify(suite, null, 2))
  const exportCsv = () => suite && download('domino-benchmark.csv', 'text/csv',
    ['id,title,group,kind,status,elapsedMs,failures', ...suite.results.map((r) => [r.id, `"${r.title.replace(/"/g, '""')}"`, r.group, r.kind, r.status, r.elapsedMs, `"${r.failures.join('; ').replace(/"/g, '""')}"`].join(','))].join('\n'))

  const verification = by((r) => ['baseline', 'mutation', 'stale'].includes(r.kind) || r.id === 'E11')
  const optimization = by((r) => REC.includes(r.kind) || ['E05', 'E06'].includes(r.id))
  const dependency = by((r) => 'dependency' in r.metrics || r.group === 'graph')
  const aiCases = by((r) => r.group === 'ai')

  const list = (rs: BenchResult[]) => (
    <div style={{ display: 'grid', gap: 6 }}>
      {rs.length === 0 && <p className="muted">No cases in this group.</p>}
      {rs.map((r) => <CaseRow key={r.id} r={r} onReplay={(id) => void doReplay(id)} replaying={!!replay?.busy} />)}
    </div>)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <PageHeader eyebrow="07 · Intelligence & Evaluation Laboratory" title="Evidence, not claims">
        <button className="btn" onClick={() => setMethod(true)}><Info size={15} /> Open methodology</button>
        <button className="btn" disabled={!suite} onClick={exportJson}><Download size={15} /> JSON</button>
        <button className="btn" disabled={!suite} onClick={exportCsv}><Download size={15} /> CSV</button>
        <button className="btn primary" disabled={bench.status === 'calculating' || apiStatus === 'offline'} onClick={() => void run()}>
          {bench.status === 'calculating' ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run benchmark suite</button>
      </PageHeader>

      {apiStatus === 'offline' && <Banner kind="warn">The backend is offline: benchmarks cannot run, and no numbers are shown.</Banner>}
      {bench.status === 'error' && <Banner kind="bad">Benchmark run failed: {bench.error} {bench.code === 'RATE_LIMITED' ? '(rate limited — wait a minute)' : ''}</Banner>}

      {!suite ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: 40 }}>
          <FlaskConical size={28} aria-hidden color="var(--primary)" />
          <h2 style={{ fontSize: 22, margin: '8px 0' }}>Benchmark not yet executed.</h2>
          <p className="muted" style={{ maxWidth: 560, margin: '0 auto' }}>
            {cat ? `${cat.total} deterministic, executable cases are defined.` : catErr ?? 'Loading the catalog…'} No metric is displayed until a run actually completes; every number below will come from your run.</p>
          {bench.status === 'calculating' && <p role="status"><Loader2 size={15} className="spin" /> Running the real engine on every case…</p>}
          {cat && <details style={{ textAlign: 'left', marginTop: 16 }}><summary style={{ cursor: 'pointer' }}>View case catalog</summary>
            <table className="tbl"><thead><tr><th>ID</th><th>Case</th><th>Kind</th><th>Expected behavior</th></tr></thead><tbody>
              {cat.cases.map((c) => <tr key={c.id}><td className="mono">{c.id}</td><td>{c.title}</td><td><span className="chip mono">{c.kind}</span></td><td>{c.expected.join(' · ')}</td></tr>)}</tbody></table></details>}
        </div>
      ) : (<>
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap' }}>
          <Stat label="Cases" value={suite.totalCases} sub={`run ${suite.executedAt.slice(11, 19)} UTC`} />
          <Stat label="Passed" value={suite.counts.pass} tone="ok" />
          <Stat label="Failed" value={suite.counts.fail} tone={suite.counts.fail ? 'bad' : undefined} sub={suite.counts.fail ? 'shown below' : 'none'} />
          <Stat label="Not run" value={suite.counts.not_run} tone="warn" sub="external / credentials" />
          <Stat label="Wall clock" value={`${(suite.wallClockMs / 1000).toFixed(1)}s`} />
        </div>
        <details className="card card-pad"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Measurement environment</summary>
          <dl className="kv mono" style={{ fontSize: 12, marginTop: 8 }}>{Object.entries(suite.environment).map(([k, v]) => <><dt key={k + 'k'}>{k}</dt><dd key={k + 'v'}>{String(v)}</dd></>)}</dl></details>

        <div className="tabs" role="tablist" aria-label="Evaluation areas">
          {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>

        {tab === 'verification' && (<div style={{ display: 'grid', gap: 10 }}>
          <Banner kind={verification.every((r) => r.status === 'pass') ? 'ok' : 'bad'}>{verification.filter((r) => r.status === 'pass').length}/{verification.length} verifier cases passed. Baselines of all three households validate; deliberately invalid plans (unauthorized driving, double-booked vehicle, stale hash, …) are rejected.</Banner>
          {list(verification)}</div>)}

        {tab === 'optimization' && (<div style={{ display: 'grid', gap: 10 }}>
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Stat label="Recovery solves" value={suite.latency.observations} />
            <Stat label="Median latency" value={suite.latency.medianMs != null ? `${suite.latency.medianMs} ms` : '—'} sub="per case, incl. 3 strategies" />
            <Stat label="p95 latency" value={suite.latency.p95Ms != null ? `${suite.latency.p95Ms} ms` : '—'} sub={suite.latency.note ?? `n=${suite.latency.observations}`} />
          </div>
          {suite.baselineComparison && (<div className="card card-pad"><h3>DOMINO vs. baselines ({suite.baselineComparison.cases} disruption cases)</h3>
            <table className="tbl"><thead><tr><th>Method</th><th>Mean weighted coverage</th><th>Cases with an uncovered critical task</th><th>Mean changes</th><th>All plans verified valid</th></tr></thead><tbody>
              {([['DOMINO (CP-SAT)', suite.baselineComparison.domino], ['Greedy first-fit', suite.baselineComparison.greedy], ['No recovery', suite.baselineComparison.noRecovery]] as const).map(([n, c]) => (
                <tr key={n}><td><b>{n}</b></td><td className="mono">{(c.meanWeightedCoverage * 100).toFixed(1)}%</td><td className="mono">{c.casesWithUncoveredCritical}</td><td className="mono">{c.meanChanges}</td><td>{c.allValid ? '✓' : '✗'}</td></tr>))}</tbody></table>
            <p className="muted" style={{ fontSize: 12.5 }}>Cases where DOMINO left fewer critical tasks uncovered than greedy: <b>{suite.baselineComparison.dominoBeatsGreedyCritical}</b>; where greedy did better: <b>{suite.baselineComparison.greedyBeatsDominoCritical}</b>. Reported as measured — no claim that DOMINO always wins.</p></div>)}
          {list(optimization)}</div>)}

        {tab === 'dependency' && (<div style={{ display: 'grid', gap: 10 }}>
          {suite.dependencyDetection ? (<div className="card" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Stat label="Precision" value={pct(suite.dependencyDetection.precision)} /><Stat label="Recall" value={pct(suite.dependencyDetection.recall)} />
            <Stat label="F1" value={pct(suite.dependencyDetection.f1)} sub={`${suite.dependencyDetection.cases} cases with a manually written expected set`} /></div>) : <Banner>No cases with expected-impact sets ran.</Banner>}
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Expected sets contain direct <i>and</i> indirect task/milestone impacts, written by hand in the case files before running. Scores are micro-averaged over those cases only.</p>
          {list(dependency)}</div>)}

        {tab === 'ai' && (<div style={{ display: 'grid', gap: 10 }}>
          <div className="card card-pad">
            <h3>Annotated-sentence accuracy (real Gemini calls)</h3>
            {!health?.ai.available && <Banner kind="warn"><b>Not executed — Gemini credentials unavailable.</b> No accuracy figure exists, and none is shown. Set <span className="mono">GEMINI_API_KEY</span> on the server to run the 12 annotated sentences.</Banner>}
            <button className="btn primary" style={{ marginTop: 8 }} disabled={ai.status === 'running' || apiStatus === 'offline'} onClick={() => void runAi()}>{ai.status === 'running' ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Run annotated sentences</button>
            {ai.status === 'error' && <Banner kind="bad">{ai.error}</Banner>}
            {ai.data && !ai.data.executed && <Banner kind="warn">{ai.data.reason}</Banner>}
            {ai.data?.executed && (<><div className="card" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 10 }}>
              <Stat label="Entities" value={pct(ai.data.entityAccuracy)} /><Stat label="Event type" value={pct(ai.data.typeAccuracy)} /><Stat label="Time" value={pct(ai.data.timeAccuracy)} />
              <Stat label="Uncertainty" value={pct(ai.data.uncertaintyAccuracy)} /><Stat label="Exact match" value={pct(ai.data.exactMatchAccuracy)} sub={`${ai.data.completed}/${ai.data.total} completed · ${ai.data.model}`} /></div>
              <table className="tbl"><thead><tr><th>ID</th><th>Sentence</th><th>Expected</th><th>Observed</th><th /></tr></thead><tbody>
                {ai.data.results.map((r) => <tr key={r.id}><td className="mono">{r.id}</td><td>{r.text}</td><td className="mono">{r.expected.status}</td><td className="mono">{r.status === 'ok' ? r.observedStatus : r.error}</td><td>{r.exact ? '✓' : '✗'}</td></tr>)}</tbody></table></>)}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Below: deterministic safety logic around the model (entity resolution, injection handling, confirmation gating), tested with a stand-in extractor — these are <i>not</i> Gemini accuracy results.</p>
          {list(aiCases)}</div>)}

        {tab === 'scenarios' && (<div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(['all', 'pass', 'fail', 'not_run'] as const).map((f) => <button key={f} className={`btn sm ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>{f.replace('_', ' ')} ({f === 'all' ? results.length : results.filter((r) => r.status === f).length})</button>)}</div>
          {list(shown)}</div>)}

        {replay && (<div className="card card-pad" role="status"><h3>Replay of {replay.id}</h3>
          {replay.busy ? <Loader2 size={15} className="spin" /> : replay.r ? <p style={{ margin: 0 }}>Re-executed: <StatusChip s={replay.r.status} /> in {replay.r.elapsedMs} ms. Saved inputs {replay.same ? 'reproduced exactly and the outcome matches the original run.' : 'or outcome differ from the original run — investigate.'}</p> : null}</div>)}
      </>)}

      <Modal open={method} onClose={() => setMethod(false)} title="Evaluation methodology">
        <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
          <p>Each benchmark case is a data file: a household fixture, optional edits, confirmed disruptions and declared invariants. The runner loads it, validates it, runs the real engine (dependency graph → CP-SAT → independent verifier), checks the invariants, and records wall-clock time. Nothing is precomputed.</p>
          <ul>
            <li><b>Hard-constraint compliance:</b> every plan shown as valid must have 0 failed mandatory checks (18 rules).</li>
            <li><b>Coverage:</b> weighted coverage per tier, plus the absolute count of uncovered critical tasks — a high average never hides an uncovered Tier 0 task.</li>
            <li><b>Dependency detection:</b> precision / recall / F1 of affected tasks &amp; milestones vs. hand-written expected sets.</li>
            <li><b>Latency:</b> median and p95 are only reported with ≥ 20 observations; the environment is listed above.</li>
            <li><b>Baselines:</b> “No recovery” and “Greedy first-fit” (both independently verified).</li>
            <li><b>Not measured here:</b> real-world family wellbeing. The synthetic households are fictional.</li>
          </ul>
          <p className="muted">Full text: EVALUATION_METHODOLOGY.md in the repository.</p>
        </div>
      </Modal>
    </div>
  )
}
