"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase/client"
import {
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Save,
  Send,
} from "lucide-react"

interface SmtpFormState {
  mail_driver: string
  mail_host: string
  mail_port: string
  mail_username: string
  mail_password: string
  mail_encryption: string
  mail_from_name: string
  mail_from: string
  mail_cc: string
}

const DEFAULT_SMTP: SmtpFormState = {
  mail_driver: "smtp",
  mail_host: "smtp.hostinger.com",
  mail_port: "465",
  mail_username: "info@filipinohomes.com",
  mail_password: "",
  mail_encryption: "ssl",
  mail_from_name: "LR Accounting Software",
  mail_from: "no-reply@filipinohomes.com",
  mail_cc: "it.dept.leuteriorealty@gmail.com",
}

export function SmtpSettingsCard() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState<SmtpFormState>(DEFAULT_SMTP)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [testEmail, setTestEmail] = useState("")
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    if (profile?.email || user?.email) {
      setTestEmail((prev) => prev || profile?.email || user?.email || "")
    }
  }, [profile?.email, user?.email])

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const res = await fetch("/api/smtp-settings", {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        })
        if (res.ok) {
          const data = await res.json()
          if (data?.settings) {
            setForm({
              mail_driver: data.settings.mail_driver || "smtp",
              mail_host: data.settings.mail_host || "smtp.hostinger.com",
              mail_port: String(data.settings.mail_port || 465),
              mail_username: data.settings.mail_username || "",
              mail_password: data.settings.mail_password || "",
              mail_encryption: data.settings.mail_encryption || "ssl",
              mail_from_name: data.settings.mail_from_name || "LR Accounting Software",
              mail_from: data.settings.mail_from || "",
              mail_cc: data.settings.mail_cc || "",
            })
          }
        }
      } catch (err) {
        console.error("Failed to load SMTP settings:", err)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch("/api/smtp-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          mail_port: Number(form.mail_port) || 465,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save SMTP settings")
      setSaveMessage({
        type: "success",
        text: "SMTP settings saved! All emails sent from your account will now use this configuration.",
      })
    } catch (err: any) {
      setSaveMessage({
        type: "error",
        text: err?.message || "Failed to save SMTP settings.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestSmtp = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      setTestMessage({ type: "error", text: "Please enter a valid recipient email address." })
      return
    }
    setTesting(true)
    setTestMessage(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch("/api/smtp-settings/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          testEmail: testEmail.trim(),
          smtpConfig: {
            ...form,
            mail_port: Number(form.mail_port) || 465,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "SMTP test failed")
      const ccInfo = Array.isArray(data.cc) && data.cc.length > 0 ? ` (CC: ${data.cc.join(", ")})` : ""
      setTestMessage({
        type: "success",
        text: `Test email sent successfully to ${data.sentTo}${ccInfo}!`,
      })
    } catch (err: any) {
      setTestMessage({
        type: "error",
        text: err?.message || "SMTP test failed. Check your host, port, encryption, and password.",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card className="border-slate-200 shadow-lg bg-white">
      <CardHeader className="bg-[#001f3f] text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-sky-300" />
          Email SMTP Settings
        </CardTitle>
        <CardDescription className="text-slate-200">
          Configure the SMTP server used whenever this account sends emails (including CC recipients).
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading SMTP settings...
          </div>
        ) : (
          <>
            {saveMessage && (
              <Alert
                variant={saveMessage.type === "error" ? "destructive" : "default"}
                className={
                  saveMessage.type === "success"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-red-300 bg-red-50 text-red-900"
                }
              >
                {saveMessage.type === "success" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription>{saveMessage.text}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Mail Driver</Label>
                <Input
                  value={form.mail_driver}
                  onChange={(e) => setForm((f) => ({ ...f, mail_driver: e.target.value }))}
                  placeholder="smtp"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">SMTP Host *</Label>
                <Input
                  value={form.mail_host}
                  onChange={(e) => setForm((f) => ({ ...f, mail_host: e.target.value }))}
                  placeholder="smtp.hostinger.com"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Port *</Label>
                <Input
                  type="number"
                  value={form.mail_port}
                  onChange={(e) => setForm((f) => ({ ...f, mail_port: e.target.value }))}
                  placeholder="465"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">Encryption</Label>
                <Select
                  value={form.mail_encryption}
                  onValueChange={(v) => setForm((f) => ({ ...f, mail_encryption: v }))}
                >
                  <SelectTrigger className="bg-white border-slate-300 text-[#001f3f]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="ssl">SSL (Port 465)</SelectItem>
                    <SelectItem value="tls">TLS / STARTTLS (Port 587)</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">SMTP Username *</Label>
                <Input
                  value={form.mail_username}
                  onChange={(e) => setForm((f) => ({ ...f, mail_username: e.target.value }))}
                  placeholder="info@filipinohomes.com"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">SMTP Password *</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.mail_password}
                    onChange={(e) => setForm((f) => ({ ...f, mail_password: e.target.value }))}
                    placeholder="Enter SMTP password"
                    className="bg-white border-slate-300 text-[#001f3f] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">From Name</Label>
                <Input
                  value={form.mail_from_name}
                  onChange={(e) => setForm((f) => ({ ...f, mail_from_name: e.target.value }))}
                  placeholder="LR Accounting Software"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">From Email</Label>
                <Input
                  value={form.mail_from}
                  onChange={(e) => setForm((f) => ({ ...f, mail_from: e.target.value }))}
                  placeholder="no-reply@filipinohomes.com"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#001f3f]">
                  CC Email(s) <span className="font-normal text-slate-400">(comma-separated)</span>
                </Label>
                <Input
                  value={form.mail_cc}
                  onChange={(e) => setForm((f) => ({ ...f, mail_cc: e.target.value }))}
                  placeholder="it.dept.leuteriorealty@gmail.com"
                  className="bg-white border-slate-300 text-[#001f3f]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-[#001f3f] hover:bg-[#001f3f]/90 text-white font-semibold"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? "Saving SMTP Settings..." : "Save SMTP Settings"}
              </Button>
            </div>

            {/* Test SMTP Settings Section */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-[#001f3f] flex items-center gap-1.5">
                  <Send className="h-4 w-4 text-sky-600" />
                  Test SMTP Configuration
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Send a test email using the SMTP settings above (including CC) to verify everything works.
                </p>
              </div>

              {testMessage && (
                <Alert
                  variant={testMessage.type === "error" ? "destructive" : "default"}
                  className={
                    testMessage.type === "success"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-red-300 bg-red-50 text-red-900"
                  }
                >
                  {testMessage.type === "success" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className="text-xs">{testMessage.text}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email address to test..."
                  disabled={testing}
                  className="bg-white border-sky-300 text-[#001f3f] flex-1"
                />
                <Button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testing || !testEmail.trim()}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold shrink-0"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {testing ? "Sending Test Email..." : "Send Test Email"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
