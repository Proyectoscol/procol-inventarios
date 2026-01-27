"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Building2, Users, ArrowRight, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

export default function OnboardingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<'choose' | 'master' | 'store_manager'>('choose')
  const [companyId, setCompanyId] = useState("")
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChooseMaster = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user/set-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userType: "MASTER" })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al establecer tipo de usuario")
      }

      toast.success("Tipo de usuario configurado correctamente")
      // Redirigir al dashboard para continuar con el flujo normal
      router.push("/dashboard")
    } catch (err: any) {
      toast.error(err.message || "Error al configurar tipo de usuario")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCompany = async () => {
    if (!companyId.trim()) {
      setError("Por favor ingresa un ID de compañía")
      return
    }

    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/companies/verify/${companyId.trim()}`)
      const data = await res.json()

      if (res.ok) {
        setCompanyInfo(data)
        toast.success("Compañía encontrada")
      } else {
        setError(data.error || "No se encontró ninguna compañía con ese ID")
      }
    } catch (err: any) {
      setError("Error al verificar la compañía")
    } finally {
      setLoading(false)
    }
  }

  const handleJoinCompany = async () => {
    if (!companyId.trim()) {
      setError("Por favor ingresa un ID de compañía")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/user/join-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userType: "STORE_MANAGER",
          companyId: companyId.trim()
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al unirse a la compañía")
      }

      toast.success("Te has unido a la compañía exitosamente")
      router.push("/dashboard/customers")
    } catch (err: any) {
      toast.error(err.message || "Error al unirse a la compañía")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        {step === 'choose' && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">¡Bienvenido a InventarIA!</CardTitle>
              <CardDescription>
                ¿Cómo deseas usar el sistema?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Alerta de irreversibilidad */}
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  <strong>Importante:</strong> Esta elección es permanente y no se puede cambiar después.
                </p>
              </div>

              {/* Opción 1: Empezar de cero */}
              <div 
                className="p-6 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors"
                onClick={() => setStep('master')}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Building2 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Empezar de Cero</h3>
                    <p className="text-sm text-muted-foreground">
                      Crea tu propia compañía y gestiona todo: inventario, ventas, clientes, reportes y más.
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      → Usuario Maestro (acceso completo)
                    </p>
                  </div>
                </div>
              </div>

              {/* Opción 2: Gestionar tienda existente */}
              <div 
                className="p-6 border-2 rounded-lg cursor-pointer hover:border-primary transition-colors"
                onClick={() => setStep('store_manager')}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Users className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">Gestionar Tienda Existente</h3>
                    <p className="text-sm text-muted-foreground">
                      Únete a una compañía existente para gestionar sus clientes.
                    </p>
                    <p className="text-xs text-green-600 mt-2">
                      → Gestor de Tienda (solo clientes)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {step === 'store_manager' && (
          <>
            <CardHeader>
              <CardTitle>Unirse a una Compañía</CardTitle>
              <CardDescription>
                Ingresa el ID de la compañía que deseas gestionar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  placeholder="Pega el ID de la compañía aquí"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value)
                    setError("")
                    setCompanyInfo(null)
                  }}
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-500 mt-2">{error}</p>
                )}
              </div>

              {companyInfo && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✓ Compañía encontrada: <strong>{companyInfo.name}</strong>
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setStep('choose')
                  setCompanyId("")
                  setCompanyInfo(null)
                  setError("")
                }} disabled={loading}>
                  Volver
                </Button>
                {!companyInfo ? (
                  <Button onClick={handleVerifyCompany} disabled={!companyId.trim() || loading}>
                    {loading ? "Verificando..." : "Verificar"}
                  </Button>
                ) : (
                  <Button onClick={handleJoinCompany} disabled={loading}>
                    {loading ? "Uniéndose..." : "Unirse a esta Compañía"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </>
        )}

        {step === 'master' && (
          <>
            <CardHeader>
              <CardTitle>Confirmar Tipo de Usuario</CardTitle>
              <CardDescription>
                Vas a crear tu propia compañía con acceso completo al sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Como <strong>Usuario Maestro</strong> tendrás acceso a:
              </p>
              <ul className="text-sm space-y-1 ml-4 list-disc">
                <li>Gestión completa de inventario</li>
                <li>Compras y ventas</li>
                <li>Gestión de clientes</li>
                <li>Créditos y cobros</li>
                <li>Reportes y estadísticas</li>
                <li>Configuración de bodegas</li>
                <li>Invitar gestores de tienda</li>
              </ul>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('choose')} disabled={loading}>
                  Volver
                </Button>
                <Button onClick={handleChooseMaster} disabled={loading}>
                  {loading ? "Configurando..." : "Continuar"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
