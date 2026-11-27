import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import DashboardHeader from "@/components/dashboard-header"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LR Accounting | BIR Software",
  description: "A comprehensive BIR software for accountants and taxpayers",
  generator: 'v0.dev',
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.className} light`} style={{ colorScheme: "light" }} suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://filipinohomes123.s3.ap-southeast-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://filipinohomes123.s3.ap-southeast-1.amazonaws.com"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <DashboardHeader />
            <main className="flex min-h-screen flex-col pt-16">
              {/* Added pt-16 to account for fixed header */}
              {children}
            </main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
