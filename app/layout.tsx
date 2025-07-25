import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import DashboardHeader from "@/components/dashboard-header" // Corrected to named import

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LR Accounting | BIR Software",
  description: "A comprehensive BIR software for accountants and taxpayers",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <DashboardHeader />
            <main className="flex min-h-screen flex-col pt-16">
              {" "}
              {/* Added pt-16 to account for fixed header */}
              {children}
            </main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
