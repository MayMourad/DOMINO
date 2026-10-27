// Read-only copies of the fictional fixtures, used ONLY for offline browsing when the backend is unreachable.
// They are never used for computation: simulation and recovery always require the backend.
import type { FixtureSummary, Household } from '../types'

const files = import.meta.glob('../../../data/households/*.json', { eager: true, import: 'default' }) as Record<string, Household>
const byId: Record<string, Household> = {}
for (const h of Object.values(files)) byId[h.id] = h

export const bundledFixture = (id: string): Household | null => (byId[id] ? structuredClone(byId[id]) : null)

export const bundledSummaries = (): FixtureSummary[] =>
  ['amina', 'multigenerational', 'restricted-transport'].filter((id) => byId[id]).map((id) => {
    const h = byId[id]
    return { id, name: h.name, description: h.description, members: h.members.length, tasks: h.tasks.length, resources: h.resources.length }
  })
