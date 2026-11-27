"use client"

import React, { useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/protected-route"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { supabase } from "@/lib/supabase/client"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react"

interface McpKeyRow {
  id: string
  name: string
  access_level: "read_only" | "admin_full"
  key_prefix: string
  is_active: boolean
  created_by_name: string | null
  created_by_email: string | null
  last_used_at: string | null
  request_count: number
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export default function SuperAdminMcpSettingsPage() {
  const [keys, setKeys] = useState<McpKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Create key form
  const [newName, setNewName] = useState("")
  const [newLevel, setNewLevel] = useState<"read_only" | "admin_full">("read_only")
  const [expiresDays, setExpiresDays] = useState("0")
  const [creating, setCreating] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    rawKey: string
    name: string
    accessLevel: "read_only" | "admin_full"
  } | null>(null)

  // Copy states
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Live MCP connection tester
  const [testToken, setTestToken] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message: string
    tools?: Array<{ name: string; description: string }>
    latencyMs?: number
  } | null>(null)

  const mcpEndpoint = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/mcp`
    }
    return "https://lrsync.vercel.app/api/mcp"
  }, [])

  const snippetToken = newlyCreatedKey?.rawKey || testToken.trim() || "YOUR_LRSYNC_MCP_API_KEY"

  const claudeCursorJson = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            lrsync: {
              url: mcpEndpoint,
              headers: {
                Authorization: `Bearer ${snippetToken}`,
              },
            },
          },
        },
        null,
        2
      ),
    [mcpEndpoint, snippetToken]
  )

  const vscodeJson = useMemo(
    () =>
      JSON.stringify(
        {
          servers: {
            lrsync: {
              type: "http",
              url: mcpEndpoint,
              headers: {
                Authorization: `Bearer ${snippetToken}`,
              },
            },
          },
        },
        null,
        2
      ),
    [mcpEndpoint, snippetToken]
  )

  const curlSnippet = useMemo(
    () =>
      `curl -X POST "${mcpEndpoint}" \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${snippetToken}" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
    [mcpEndpoint, snippetToken]
  )

  const getAuthHeaders = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }
  }

  const fetchKeys = async () => {
    setLoading(true)
    setError("")
    try {
      const headers = await getAuthHeaders()
      const res = await fetch("/api/mcp/keys", { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load MCP keys")
      setKeys(data.keys || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load MCP keys")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  const handleCreateKey = async () => {
    if (!newName.trim()) {
      setError("Please enter a name for the MCP API key.")
      return
    }
    setCreating(true)
    setError("")
    try {
      const headers = await getAuthHeaders()
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newName.trim(),
          access_level: newLevel,
          expires_in_days: Number(expiresDays) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create key")

      setNewlyCreatedKey({
        rawKey: data.rawKey,
        name: data.key.name,
        accessLevel: data.key.access_level,
      })
      setTestToken(data.rawKey)
      setNewName("")
      await fetchKeys()
    } catch (err: any) {
      setError(err?.message || "Failed to create MCP key")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (key: McpKeyRow) => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch("/api/mcp/keys", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: key.id, is_active: !key.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update key")
      await fetchKeys()
    } catch (err: any) {
      setError(err?.message || "Failed to update key")
    }
  }

  const handleDeleteKey = async (key: McpKeyRow) => {
    if (!window.confirm(`Permanently delete MCP key "${key.name}" (${key.key_prefix}...)?`)) return
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/mcp/keys?id=${encodeURIComponent(key.id)}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete key")
      await fetchKeys()
    } catch (err: any) {
      setError(err?.message || "Failed to delete key")
    }
  }

  const handleTestConnection = async () => {
    const token = testToken.trim()
    if (!token) {
      setTestResult({ ok: false, message: "Paste or generate an MCP API key first." })
      return
    }
    setTesting(true)
    setTestResult(null)
    const started = performance.now()
    try {
      const initRes = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", clientInfo: { name: "lrsync-ui-tester", version: "1.0.0" } },
        }),
      })
      const initJson = await initRes.json()
      if (!initRes.ok || initJson.error) {
        throw new Error(initJson?.error?.message || `HTTP ${initRes.status}`)
      }

      const toolsRes = await fetch("/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      })
      const toolsJson = await toolsRes.json()
      const tools = toolsJson?.result?.tools || []
      const latencyMs = Math.round(performance.now() - started)

      setTestResult({
        ok: true,
        latencyMs,
        tools,
        message: `Connected (${initJson?.result?.serverInfo?.accessLevel === "admin_full" ? "Admin Full Access" : "Read-Only Access"}) — ${tools.length} tools available in ${latencyMs}ms.`,
      })
      fetchKeys()
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || "Connection test failed",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <div className="min-h-screen bg-slate-50 pb-16 lg:pb-10">
        <DashboardHeader />
        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-12 max-w-[1400px] mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#001f3f] text-white shadow">
                <Plug className="w-6 h-6 text-sky-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#001f3f]">
                  MCP Server &amp; API Access
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Connect any MCP client (Claude, Antigravity, Cursor, Windsurf, VS Code, n8n) with{" "}
                  <strong>Read-Only</strong> or <strong>Admin Full Access</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <span className="font-semibold text-slate-500">Endpoint:</span>
              <code className="font-mono text-[#001f3f] font-semibold">{mcpEndpoint}</code>
              <button
                type="button"
                onClick={() => copyText("endpoint", mcpEndpoint)}
                className="p-1 text-slate-500 hover:text-[#001f3f]"
                title="Copy endpoint URL"
              >
                {copiedId === "endpoint" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Create New Key + Quick Setup Snippets */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Generate Key */}
            <Card className="lg:col-span-5 bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-[#001f3f] flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-sky-600" />
                  Generate MCP API Key
                </CardTitle>
                <CardDescription>
                  Create a scoped token for any external AI assistant or automation tool.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#001f3f]">Key Name *</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Claude Desktop (Read-Only) or Accounting Bot"
                    className="bg-white border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Access Level *</Label>
                    <Select
                      value={newLevel}
                      onValueChange={(v) => setNewLevel(v as "read_only" | "admin_full")}
                    >
                      <SelectTrigger className="bg-white border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="read_only">Read-Only (10 tools)</SelectItem>
                        <SelectItem value="admin_full">Admin Full Access (16 tools)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#001f3f]">Expiration</Label>
                    <Select value={expiresDays} onValueChange={setExpiresDays}>
                      <SelectTrigger className="bg-white border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="0">Never expires</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border p-3 text-xs space-y-1 bg-slate-50 border-slate-200">
                  {newLevel === "read_only" ? (
                    <div className="flex items-start gap-2 text-sky-900">
                      <Shield className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Read-Only Access:</strong> Can safely search &amp; query Sales, Purchases,
                        Expenses, Commissions, Vouchers, Releases, Cheque Verification, TIN Library, and
                        Audit Logs. Cannot modify or delete data.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-amber-900">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Admin Full Access:</strong> Includes all Read-Only tools plus creating,
                        updating, soft-deleting records, updating Cheque Verification &amp; Commission Report
                        statuses, and listing users. Every write is logged in Activity Tracker.
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={handleCreateKey}
                  disabled={creating || !newName.trim()}
                  className="w-full bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {creating ? "Generating Key..." : "Generate MCP API Key"}
                </Button>

                {newlyCreatedKey && (
                  <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Key Created — Copy Now (Shown Once)
                      </span>
                      <Badge className="bg-emerald-700 text-white text-[10px]">
                        {newlyCreatedKey.accessLevel === "admin_full" ? "Admin Full" : "Read-Only"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-emerald-200 rounded-md px-2.5 py-2">
                      <code className="text-xs font-mono text-slate-900 break-all flex-1">
                        {newlyCreatedKey.rawKey}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyText("new-key", newlyCreatedKey.rawKey)}
                        className="shrink-0 h-7 text-xs"
                      >
                        {copiedId === "new-key" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      The config snippets on the right are automatically pre-filled with this new key!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: 1-Click Copy Config Snippets & Live Tester */}
            <Card className="lg:col-span-7 bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg text-[#001f3f] flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                  Easy Setup for Any MCP Client
                </CardTitle>
                <CardDescription>
                  Copy and paste into Claude Desktop, Antigravity, Cursor, Windsurf, VS Code, or any
                  Streamable HTTP MCP client.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="claude">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="claude">Claude / Cursor / Antigravity</TabsTrigger>
                    <TabsTrigger value="vscode">VS Code</TabsTrigger>
                    <TabsTrigger value="curl">cURL / HTTP</TabsTrigger>
                  </TabsList>

                  <TabsContent value="claude" className="mt-3 space-y-2">
                    <div className="relative">
                      <pre className="rounded-lg bg-slate-900 text-sky-100 p-4 text-xs overflow-x-auto font-mono">
                        {claudeCursorJson}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => copyText("claude", claudeCursorJson)}
                        className="absolute top-2.5 right-2.5 h-7 text-xs"
                      >
                        {copiedId === "claude" ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="vscode" className="mt-3 space-y-2">
                    <div className="relative">
                      <pre className="rounded-lg bg-slate-900 text-sky-100 p-4 text-xs overflow-x-auto font-mono">
                        {vscodeJson}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => copyText("vscode", vscodeJson)}
                        className="absolute top-2.5 right-2.5 h-7 text-xs"
                      >
                        {copiedId === "vscode" ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="curl" className="mt-3 space-y-2">
                    <div className="relative">
                      <pre className="rounded-lg bg-slate-900 text-emerald-200 p-4 text-xs overflow-x-auto font-mono">
                        {curlSnippet}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => copyText("curl", curlSnippet)}
                        className="absolute top-2.5 right-2.5 h-7 text-xs"
                      >
                        {copiedId === "curl" ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" /> Copy cURL
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Live Connection Tester */}
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <div className="text-xs font-bold text-[#001f3f] flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    Test Live MCP Connection
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="password"
                      value={testToken}
                      onChange={(e) => setTestToken(e.target.value)}
                      placeholder="Paste an MCP API key (lrsync_ro_... or lrsync_ad_...)..."
                      className="bg-white border-indigo-200 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing || !testToken.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0"
                    >
                      {testing ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4 mr-1.5" />
                      )}
                      {testing ? "Testing..." : "Test MCP"}
                    </Button>
                  </div>
                  {testResult && (
                    <div
                      className={`rounded-lg border p-3 text-xs space-y-2 ${
                        testResult.ok
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                          : "bg-red-50 border-red-300 text-red-900"
                      }`}
                    >
                      <div className="font-semibold">{testResult.message}</div>
                      {testResult.tools && testResult.tools.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {testResult.tools.map((t) => (
                            <Badge
                              key={t.name}
                              variant="outline"
                              className="bg-white text-[10px] font-mono border-emerald-300 text-emerald-800"
                              title={t.description}
                            >
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Keys Table */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg text-[#001f3f]">Issued MCP API Keys</CardTitle>
                <CardDescription>
                  Revoke or delete any key instantly. Raw keys are SHA-256 hashed in the database.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchKeys} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100">
                      <TableHead className="font-semibold text-[#001f3f]">Name</TableHead>
                      <TableHead className="font-semibold text-[#001f3f]">Access Level</TableHead>
                      <TableHead className="font-semibold text-[#001f3f]">Key Prefix</TableHead>
                      <TableHead className="font-semibold text-[#001f3f]">Status</TableHead>
                      <TableHead className="font-semibold text-[#001f3f]">Requests / Last Used</TableHead>
                      <TableHead className="font-semibold text-[#001f3f]">Created By</TableHead>
                      <TableHead className="text-right font-semibold text-[#001f3f]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                          Loading MCP API keys...
                        </TableCell>
                      </TableRow>
                    ) : keys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                          No MCP API keys created yet. Generate a Read-Only or Admin Full Access key above!
                        </TableCell>
                      </TableRow>
                    ) : (
                      keys.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="font-semibold text-slate-900">{k.name}</TableCell>
                          <TableCell>
                            {k.access_level === "admin_full" ? (
                              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-100">
                                Admin Full Access
                              </Badge>
                            ) : (
                              <Badge className="bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-100">
                                Read-Only
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">
                              {k.key_prefix}...
                            </code>
                          </TableCell>
                          <TableCell>
                            {k.is_active ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 border border-red-300 hover:bg-red-100">
                                Revoked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            <div>
                              <strong>{k.request_count || 0}</strong> req(s)
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {k.last_used_at
                                ? new Date(k.last_used_at).toLocaleString()
                                : "Never used"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            <div>{k.created_by_name || "Super Admin"}</div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(k.created_at).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleActive(k)}
                                className="h-7 text-xs"
                              >
                                {k.is_active ? "Revoke" : "Activate"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteKey(k)}
                                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
