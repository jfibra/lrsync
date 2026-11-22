"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users } from "lucide-react"
import type { LrappMemberInfo } from "@/hooks/use-lrapp-member-lookup"

interface MemberTeamBadgeProps {
  member: LrappMemberInfo | null | undefined
  loading?: boolean
  compact?: boolean
}

export function MemberTeamBadge({ member, loading, compact = false }: MemberTeamBadgeProps) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading team info...
      </div>
    )
  }

  if (member === undefined) return null

  if (!member) {
    return <span className="text-[11px] text-slate-400 italic">Team info unavailable</span>
  }

  const team = member.team
  const subteam = member.subteam
  const teamLeader = team?.leader?.name || team?.leader_name || null
  const umLeader = subteam?.leader?.name || subteam?.leader_name || null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[11px]" : "text-xs"}`}>
      {team ? (
        <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-blue-900">
          <Users className="h-3 w-3 text-blue-600 shrink-0" />
          <span className="font-medium">{team.name}</span>
          {team.role === "leader" && (
            <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[9px] px-1 py-0 h-3.5">
              Leader
            </Badge>
          )}
          <span className="text-blue-700">
            · TL: {teamLeader || "Unassigned"}
          </span>
        </span>
      ) : (
        <span className="inline-flex items-center rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-slate-500">
          No team
        </span>
      )}

      {subteam && (
        <span className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-purple-900">
          <span className="font-medium">Sub-team: {subteam.name}</span>
          {subteam.role === "leader" && (
            <Badge className="bg-purple-600 text-white hover:bg-purple-600 text-[9px] px-1 py-0 h-3.5">
              Leader
            </Badge>
          )}
          <span className="text-purple-700">
            · UM: {umLeader || "Unassigned"}
          </span>
        </span>
      )}
    </div>
  )
}
