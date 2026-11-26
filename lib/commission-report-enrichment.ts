import type { SupabaseClient } from "@supabase/supabase-js"

export interface CommissionReportSummary {
  developers: string[]
  developer_display: string
  agents: string[]
  agents_display: string
  clients: string[]
  clients_display: string
  total_commission: number
  total_net_commission: number
  breakdown_count: number
  has_unencoded: boolean
  comm_types: string[]
}

export const EMPTY_REPORT_SUMMARY: CommissionReportSummary = {
  developers: [],
  developer_display: "",
  agents: [],
  agents_display: "",
  clients: [],
  clients_display: "",
  total_commission: 0,
  total_net_commission: 0,
  breakdown_count: 0,
  has_unencoded: false,
  comm_types: [],
}

export async function fetchCommissionReportSummaries(
  supabase: SupabaseClient
): Promise<Map<string, CommissionReportSummary>> {
  const map = new Map<
    string,
    {
      developers: Set<string>
      agents: Set<string>
      clients: Set<string>
      commTypes: Set<string>
      totalCommission: number
      totalNetCommission: number
      breakdownCount: number
      hasUnencoded: boolean
    }
  >()

  const PAGE_SIZE = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("commission_agent_breakdown")
      .select(
        "commission_report_uuid, developer, agent_name, client, comm, agent_net_comm, tl_net_comm, um_net_comm, status, comm_type"
      )
      .is("deleted_at", null)
      .range(from, from + PAGE_SIZE - 1)

    if (error || !data || data.length === 0) break

    for (const row of data as any[]) {
      const uuid = row.commission_report_uuid
      if (!uuid) continue

      let acc = map.get(uuid)
      if (!acc) {
        acc = {
          developers: new Set<string>(),
          agents: new Set<string>(),
          clients: new Set<string>(),
          commTypes: new Set<string>(),
          totalCommission: 0,
          totalNetCommission: 0,
          breakdownCount: 0,
          hasUnencoded: false,
        }
        map.set(uuid, acc)
      }

      const dev = String(row.developer || "").trim()
      if (dev) acc.developers.add(dev)

      const agent = String(row.agent_name || "").trim()
      if (agent) acc.agents.add(agent)

      const client = String(row.client || "").trim()
      if (client) acc.clients.add(client)

      const commType = String(row.comm_type || "").trim()
      if (commType) acc.commTypes.add(commType)

      const status = String(row.status || "").trim().toLowerCase()
      if (status.includes("unencoded")) acc.hasUnencoded = true

      acc.totalCommission += Number(row.comm) || 0
      acc.totalNetCommission +=
        (Number(row.agent_net_comm) || 0) +
        (Number(row.tl_net_comm) || 0) +
        (Number(row.um_net_comm) || 0)
      acc.breakdownCount += 1
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const result = new Map<string, CommissionReportSummary>()
  map.forEach((acc, uuid) => {
    const developers = Array.from(acc.developers)
    const agents = Array.from(acc.agents)
    const clients = Array.from(acc.clients)
    result.set(uuid, {
      developers,
      developer_display: developers.join(", "),
      agents,
      agents_display: agents.join(", "),
      clients,
      clients_display: clients.join(", "),
      total_commission: acc.totalCommission,
      total_net_commission: acc.totalNetCommission,
      breakdown_count: acc.breakdownCount,
      has_unencoded: acc.hasUnencoded,
      comm_types: Array.from(acc.commTypes),
    })
  })

  return result
}

export function formatPHPCompact(val: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(val) || 0)
}
