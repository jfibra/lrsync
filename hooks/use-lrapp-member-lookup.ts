"use client"

import { useCallback, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"

export interface LrappLeaderInfo {
  memberid: number
  name: string
}

export interface LrappTeamInfo {
  id: number
  name: string
  role: "leader" | "member" | string
  date_joined?: string | null
  leader?: LrappLeaderInfo | null
  leader_name?: string | null
}

export interface LrappSubteamInfo {
  id: number
  name: string
  role: "leader" | "member" | string
  team_name?: string | null
  leader?: LrappLeaderInfo | null
  leader_name?: string | null
}

export interface LrappMemberInfo {
  memberid: number
  name: string
  email?: string | null
  mobile?: string | null
  membertype?: string | null
  status?: string | null
  photo_url?: string | null
  team?: LrappTeamInfo | null
  subteam?: LrappSubteamInfo | null
}

// Module-level cache shared across modals within the same session
const memberCache = new Map<string, LrappMemberInfo | null>()

export function useLrappMemberLookup() {
  const { user, profile } = useAuth()
  const currentUserEmail = (profile?.email || user?.email || "").trim()
  const [membersByKey, setMembersByKey] = useState<Record<string, LrappMemberInfo | null>>({})
  const [loadingKeys, setLoadingKeys] = useState<Record<string, boolean>>({})
  const inFlightRef = useRef<Set<string>>(new Set())

  const lookupMembers = useCallback(
    async (items: Array<{ agentid?: number | null; name?: string | null }>) => {
      const uniqueTargets: Array<{ key: string; query: string; expectedId?: number }> = []
      const seen = new Set<string>()

      for (const item of items) {
        const hasId = Boolean(item.agentid && Number(item.agentid) > 0)
        const nameTrim = (item.name || "").trim()
        const key = hasId ? `id:${item.agentid}` : nameTrim.length >= 2 ? `name:${nameTrim.toLowerCase()}` : ""
        if (!key || seen.has(key)) continue
        seen.add(key)

        if (memberCache.has(key)) {
          const cached = memberCache.get(key) ?? null
          setMembersByKey((prev) => (prev[key] === cached ? prev : { ...prev, [key]: cached }))
          continue
        }
        if (inFlightRef.current.has(key)) continue

        uniqueTargets.push({
          key,
          query: hasId ? String(item.agentid) : nameTrim,
          expectedId: hasId ? Number(item.agentid) : undefined,
        })
      }

      if (uniqueTargets.length === 0) return

      for (const t of uniqueTargets) {
        inFlightRef.current.add(t.key)
      }
      setLoadingKeys((prev) => {
        const next = { ...prev }
        for (const t of uniqueTargets) next[t.key] = true
        return next
      })

      await Promise.all(
        uniqueTargets.map(async (target) => {
          try {
            const params = new URLSearchParams({ q: target.query })
            if (currentUserEmail) params.set("userEmail", currentUserEmail)
            const res = await fetch(`/api/lrapp/members-search?${params.toString()}`)
            if (!res.ok) {
              memberCache.set(target.key, null)
              setMembersByKey((prev) => ({ ...prev, [target.key]: null }))
              return
            }
            const json = await res.json()
            const list: LrappMemberInfo[] = Array.isArray(json?.members) ? json.members : []
            let matched: LrappMemberInfo | null = null
            if (target.expectedId) {
              matched = list.find((m) => Number(m.memberid) === target.expectedId) || list[0] || null
            } else {
              matched = list[0] || null
            }
            memberCache.set(target.key, matched)
            setMembersByKey((prev) => ({ ...prev, [target.key]: matched }))
          } catch {
            memberCache.set(target.key, null)
            setMembersByKey((prev) => ({ ...prev, [target.key]: null }))
          } finally {
            inFlightRef.current.delete(target.key)
            setLoadingKeys((prev) => ({ ...prev, [target.key]: false }))
          }
        })
      )
    },
    [currentUserEmail]
  )

  const getMember = useCallback(
    (agentid?: number | null, name?: string | null): LrappMemberInfo | null | undefined => {
      const hasId = Boolean(agentid && Number(agentid) > 0)
      const nameTrim = (name || "").trim()
      const key = hasId ? `id:${agentid}` : nameTrim.length >= 2 ? `name:${nameTrim.toLowerCase()}` : ""
      if (!key) return undefined
      if (key in membersByKey) return membersByKey[key]
      if (memberCache.has(key)) return memberCache.get(key)
      return undefined
    },
    [membersByKey]
  )

  const isLoadingMember = useCallback(
    (agentid?: number | null, name?: string | null): boolean => {
      const hasId = Boolean(agentid && Number(agentid) > 0)
      const nameTrim = (name || "").trim()
      const key = hasId ? `id:${agentid}` : nameTrim.length >= 2 ? `name:${nameTrim.toLowerCase()}` : ""
      return key ? Boolean(loadingKeys[key]) : false
    },
    [loadingKeys]
  )

  return { lookupMembers, getMember, isLoadingMember }
}
