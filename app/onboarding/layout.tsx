// Forzar renderizado dinámico para evitar pre-renderizado estático
export const dynamic = 'force-dynamic'

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
