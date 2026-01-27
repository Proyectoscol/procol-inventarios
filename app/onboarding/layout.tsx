"use client"

// Forzar renderizado dinámico para evitar pre-renderizado estático
export const dynamic = 'force-dynamic'

import { SessionProvider } from "next-auth/react"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}
