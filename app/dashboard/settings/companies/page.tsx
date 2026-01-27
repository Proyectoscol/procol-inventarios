"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/shared/BackButton"
import { CompanyForm } from "@/components/forms/CompanyForm"
import { toast } from "sonner"
import { Edit2, X } from "lucide-react"

export default function CompaniesSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchCompanies()
    }
  }, [session])

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies")
      if (res.ok) {
        const data = await res.json()
        setCompanies(data)
      }
    } catch (error) {
      console.error("Error cargando compañías:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompanySuccess = () => {
    setShowCreateForm(false)
    setEditingCompanyId(null)
    fetchCompanies()
    toast.success("✅ Compañía guardada exitosamente", {
      duration: 2000
    })
  }

  if (status === "loading" || loading) {
    return <div className="p-8">Cargando...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <BackButton href="/dashboard/settings" />
        </div>
        <h1 className="text-3xl font-bold mb-6">Configuración de Compañías</h1>

        {!showCreateForm && !editingCompanyId && (
          <div className="mb-6">
            <Button onClick={() => setShowCreateForm(true)}>
              + Crear Nueva Compañía
            </Button>
          </div>
        )}

        {showCreateForm && (
          <Card className="mb-6 border-2 border-primary">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Crear Nueva Compañía</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CompanyForm
                onSuccess={handleCompanySuccess}
                onCancel={() => setShowCreateForm(false)}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Mis Compañías ({companies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {companies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No tienes compañías registradas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Crea tu primera compañía usando el formulario de arriba.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {companies.map((company) => (
                  <Card key={company.id} className="hover:shadow-md transition-shadow">
                    {editingCompanyId === company.id ? (
                      <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-4">
                          <CardTitle>Editar Compañía</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCompanyId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <CompanyForm
                          company={company}
                          onSuccess={handleCompanySuccess}
                          onCancel={() => setEditingCompanyId(null)}
                        />
                      </CardContent>
                    ) : (
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg flex-1">{company.name}</h3>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingCompanyId(company.id)}
                                className="flex items-center gap-2"
                              >
                                <Edit2 className="h-4 w-4" />
                                Editar
                              </Button>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground mb-2">
                              {company.nombreEncargado && company.nombreEncargado !== company.name && (
                                <p>👤 Encargado: {company.nombreEncargado}</p>
                              )}
                              {company.cedula && (
                                <p>🆔 Cédula/NIT: {company.cedula}</p>
                              )}
                              {company.phone && (
                                <p>📞 Teléfono: {company.phone}</p>
                              )}
                              {(company.departamento || company.ciudad) && (
                                <p>📍 {[company.departamento, company.ciudad].filter(Boolean).join(", ")}</p>
                              )}
                              {company.barrio && (
                                <p>🏘️ Barrio: {company.barrio}</p>
                              )}
                              {company.direccion1 && (
                                <p>🏠 {company.direccion1}</p>
                              )}
                              {company.direccion2 && (
                                <p>🏢 {company.direccion2}</p>
                              )}
                            </div>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span>
                                📦 {company._count?.products || 0} productos
                              </span>
                              <span>
                                🏢 {company._count?.warehouses || 0} bodegas
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botón de atrás al final */}
        <div className="mt-8 flex justify-center">
          <BackButton href="/dashboard/settings" />
        </div>
      </div>
    </div>
  )
}

