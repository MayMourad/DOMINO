import { useEffect } from 'react'
import { motion } from 'motion/react'
import { Activity, BarChart3, FlaskConical, GitBranch, Network, RefreshCw, Rocket, Sparkles, WifiOff, Wrench, X } from 'lucide-react'
import { SCREENS, useStore, type ScreenId } from '../state/store'
import { Banner, Empty } from '../components/ui/ui'
import { COMPETITION, TEAM } from '../lib/team'
import Launch from '../screens/Launch'
import FamilyNetwork from '../screens/FamilyNetwork'
import DisruptionStudio from '../screens/DisruptionStudio'
import CascadeLab from '../screens/CascadeLab'
import RecoveryStudio from '../screens/RecoveryStudio'
import FuturesLab from '../screens/FuturesLab'
import EvaluationLab from '../screens/EvaluationLab'

const ICONS: Record<ScreenId, typeof Rocket> = {
  launch: Rocket, network: Network, studio: Wrench, cascade: GitBranch, recovery: Sparkles, futures: FlaskConical, evaluation: BarChart3,
}

function parseHash(): ScreenId {
  const m = /^#\/(\w+)/.exec(location.hash)
  return (SCREENS.find((s) => s.id === m?.[1])?.id ?? 'launch') as ScreenId
}

export function App() {
  const { screen, draft, householdVersion, scenarioVersion, apiStatus, health, reducedMotion, toasts, usingBundled } = useStore()
  const boot = useStore((s) => s.boot)
  const go = useStore((s) => s.go)

  useEffect(() => {
    void boot()
    const onHash = () => useStore.setState({ screen: parseHash() })
    useStore.setState({ screen: parseHash() })
    window.addEventListener('hashchange', onHash)
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => useStore.getState().setReducedMotion(mq.matches)
    mq.addEventListener('change', onMq)
    return () => { window.removeEventListener('hashchange', onHash); mq.removeEventListener('change', onMq) }
  }, [boot])

  useEffect(() => { document.documentElement.dataset.reducedMotion = String(reducedMotion) }, [reducedMotion])

  const needsHousehold = screen !== 'launch' && screen !== 'evaluation' && !draft
  const view = (() => {
    if (needsHousehold) return <Empty title="No household loaded" action={<button className="btn primary" onClick={() => go('launch')}>Choose a household</button>}>Load one of the fictional households first. Everything on this screen is computed from it.</Empty>
    switch (screen) {
      case 'launch': return <Launch />
      case 'network': return <FamilyNetwork />
      case 'studio': return <DisruptionStudio />
      case 'cascade': return <CascadeLab />
      case 'recovery': return <RecoveryStudio />
      case 'futures': return <FuturesLab />
      case 'evaluation': return <EvaluationLab />
    }
  })()

  return (
    <div className="shell">
      <nav className="rail" aria-label="Primary">
        <svg className="logo" viewBox="0 0 40 40" role="img" aria-label="DOMINO">
          <rect width="40" height="40" rx="10" fill="#17375f" /><rect x="8" y="9" width="10" height="22" rx="2.5" fill="#82b2d6" />
          <rect x="21" y="9" width="11" height="22" rx="2.5" fill="#255e99" transform="rotate(13 26 20)" />
        </svg>
        {SCREENS.map((s, i) => {
          const Icon = ICONS[s.id]
          return (
            <a key={s.id} href={`#/${s.id}`} aria-current={screen === s.id ? 'page' : undefined} title={s.label} onClick={(e) => { e.preventDefault(); go(s.id) }}>
              <Icon size={19} aria-hidden /><span>{s.short}</span><span className="step" aria-hidden>0{i + 1}</span>
            </a>
          )
        })}
      </nav>
      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <span className="wordmark" aria-label="DOMINO">DOMINO</span>
          <span className="muted" style={{ fontSize: 12.5 }}>{draft ? draft.name : 'No household selected'}</span>
          {draft && <span className="chip mono" title="Household edit version / scenario version">h{householdVersion} · s{scenarioVersion}</span>}
          <span style={{ flex: 1 }} />
          <span className={`chip ${apiStatus === 'online' ? 'ok' : apiStatus === 'offline' ? 'bad' : ''}`} role="status" aria-live="polite">
            {apiStatus === 'offline' ? <WifiOff size={12} aria-hidden /> : <Activity size={12} aria-hidden />}
            {apiStatus === 'online' ? `API online · ${health?.solver ?? 'CP-SAT'}` : apiStatus === 'offline' ? 'API offline' : 'Connecting…'}
          </span>
          {health && <span className="chip ok" title="Natural-language interpretation engines">{health.ai.available ? 'Language: Gemini + built-in parser' : 'Language: built-in parser'}</span>}
          {apiStatus === 'offline' && <button className="btn sm" onClick={() => void boot()}><RefreshCw size={13} aria-hidden /> Retry</button>}
        </header>
        <main className="page" id="main">
          {apiStatus === 'offline' && screen !== 'launch' && (
            <div style={{ marginBottom: 12 }}><Banner kind="warn">
              <b>Backend unreachable.</b> You can keep browsing and editing the loaded fictional household (drafts are saved in this browser), but simulation, optimization and verification need the API
              {usingBundled ? ' — the household shown is a read-only bundled copy.' : '.'}
            </Banner></div>
          )}
          <motion.div key={screen} initial={{ opacity: 0.2, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
            {view}
          </motion.div>
        </main>
        <footer className="credits" aria-label="Project team">
          <b>DOMINO</b> — created by {TEAM.map((t, i) => <span key={t.name}>{i > 0 && ' · '}{t.name} <span className="mono">({t.grade})</span></span>)}
          <div className="muted">{COMPETITION}. All households are fictional; no real family data is used.</div>
        </footer>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span style={{ flex: 1 }}>{t.text}</span>
            <button className="btn sm ghost" style={{ color: '#fff' }} aria-label="Dismiss" onClick={() => useStore.getState().dismissToast(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
