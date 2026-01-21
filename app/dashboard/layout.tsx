"use client"

import { SessionProvider } from "next-auth/react"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { CompanyProvider } from "@/contexts/CompanyContext"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <CompanyProvider>
        <div className="min-h-screen bg-gray-50">
          <DashboardHeader />
          <main className="max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </CompanyProvider>
    </SessionProvider>
  )
}

