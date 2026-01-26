"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/shared/BackButton"
import { CustomerForm } from "@/components/forms/CustomerForm"
import { CustomerDetailsModal } from "@/components/modals/CustomerDetailsModal"
import { toast } from "sonner"
import { User, DollarSign, Search, ArrowUpDown, Calendar, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { formatColombiaDate } from "@/lib/date-utils"
import { useCompany } from "@/contexts/CompanyContext"

export default function CustomersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedCompanyId } = useCompany()
  const [customers, setCustomers] = useState<any[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"name" | "name-desc" | "last-movement" | "pending-credit" | "revenue">("name")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCustomers(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const fetchCustomers = async (companyId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/companies/${companyId}/customers/enriched`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
        applyFiltersAndSort(data, searchQuery, sortBy)
      }
    } catch (error) {
      console.error("Error cargando clientes:", error)
      toast.error("Error cargando clientes")
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = (customersList: any[], query: string, sort: string) => {
    // Filtrar por búsqueda (solo si hay más de 2 caracteres)
    let filtered = customersList
    if (query.length >= 2) {
      const queryLower = query.toLowerCase()
      filtered = customersList.filter((customer) => {
        const nameMatch = customer.name?.toLowerCase().includes(queryLower)
        const phoneMatch = customer.phone?.toLowerCase().includes(queryLower)
        return nameMatch || phoneMatch
      })
    }

    // Ordenar
    let sorted = [...filtered]
    switch (sort) {
      case "name":
        sorted.sort((a, b) => {
          // Si ambos tienen nombre, ordenar por nombre
          if (a.name && b.name) {
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          }
          // Si uno tiene nombre y el otro no, el que tiene nombre va primero
          if (a.name && !b.name) return -1
          if (!a.name && b.name) return 1
          // Si ninguno tiene nombre, ordenar por teléfono
          const phoneA = a.phone || ""
          const phoneB = b.phone || ""
          return phoneA.localeCompare(phoneB, "es", { sensitivity: "base" })
        })
        break
      case "name-desc":
        sorted.sort((a, b) => {
          // Si ambos tienen nombre, ordenar por nombre (descendente)
          if (a.name && b.name) {
            return b.name.localeCompare(a.name, "es", { sensitivity: "base" })
          }
          // Si uno tiene nombre y el otro no, el que tiene nombre va primero
          if (a.name && !b.name) return -1
          if (!a.name && b.name) return 1
          // Si ninguno tiene nombre, ordenar por teléfono (descendente)
          const phoneA = a.phone || ""
          const phoneB = b.phone || ""
          return phoneB.localeCompare(phoneA, "es", { sensitivity: "base" })
        })
        break
      case "last-movement":
        sorted.sort((a, b) => {
          const dateA = a.lastMovementDate ? new Date(a.lastMovementDate).getTime() : 0
          const dateB = b.lastMovementDate ? new Date(b.lastMovementDate).getTime() : 0
          if (dateB === dateA) {
            // Si tienen la misma fecha (o ambas son 0), ordenar alfabéticamente
            const nameA = a.name || a.phone || ""
            const nameB = b.name || b.phone || ""
            return nameA.localeCompare(nameB, "es", { sensitivity: "base" })
          }
          return dateB - dateA // Más reciente primero
        })
        break
      case "pending-credit":
        sorted.sort((a, b) => {
          const creditA = a.pendingCredit || 0
          const creditB = b.pendingCredit || 0
          if (creditB === creditA) {
            // Si tienen el mismo crédito, ordenar alfabéticamente
            const nameA = a.name || a.phone || ""
            const nameB = b.name || b.phone || ""
            return nameA.localeCompare(nameB, "es", { sensitivity: "base" })
          }
          return creditB - creditA
        })
        break
      case "revenue":
        sorted.sort((a, b) => {
          const revenueA = a.totalRevenue || 0
          const revenueB = b.totalRevenue || 0
          if (revenueB === revenueA) {
            // Si tienen los mismos ingresos, ordenar alfabéticamente
            const nameA = a.name || a.phone || ""
            const nameB = b.name || b.phone || ""
            return nameA.localeCompare(nameB, "es", { sensitivity: "base" })
          }
          return revenueB - revenueA
        })
        break
    }

    setFilteredCustomers(sorted)
  }

  useEffect(() => {
    if (customers.length > 0) {
      applyFiltersAndSort(customers, searchQuery, sortBy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sortBy])
  
  // Aplicar filtros cuando cambian los clientes
  useEffect(() => {
    if (customers.length > 0) {
      applyFiltersAndSort(customers, searchQuery, sortBy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers])

  if (status === "loading" || loading) {
    return <div className="p-8">Cargando...</div>
  }

  if (!session) {
    return null
  }

  if (!selectedCompanyId) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <BackButton href="/dashboard/settings" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Gestión de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Por favor selecciona una compañía en el header para gestionar clientes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <BackButton href="/dashboard/settings" />
        </div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Administra los clientes de tu compañía
            </p>
          </div>
          {selectedCompanyId && (
            <div className="flex gap-2">
            <Link 
              href="/dashboard/credits"
              onClick={() => {
                // Guardar el referrer para que créditos sepa de dónde vino
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("creditsReferrer", "/dashboard/customers")
                }
              }}
            >
              <Button variant="outline" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Créditos
              </Button>
            </Link>
              <Button onClick={() => setShowCreateCustomer(true)}>
                + Crear Cliente
              </Button>
            </div>
          )}
        </div>

        {showCreateCustomer && (
          <Card className="mb-6 border-2 border-primary">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Crear Nuevo Cliente</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateCustomer(false)}
                >
                  ✕ Cerrar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CustomerForm
                companyId={selectedCompanyId}
                onSuccess={(newCustomer) => {
                  if (newCustomer) {
                    // Recargar clientes para obtener datos enriquecidos
                    fetchCustomers(selectedCompanyId)
                    setShowCreateCustomer(false)
                    toast.success("✅ Cliente creado exitosamente", {
                      description: "El cliente se ha agregado correctamente",
                      duration: 3000
                    })
                  }
                }}
                onCancel={() => setShowCreateCustomer(false)}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              Clientes ({filteredCustomers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Búsqueda y Ordenamiento */}
            {customers.length > 0 && (
              <div className="mb-6 space-y-4">
                <div>
                  <Label htmlFor="search" className="mb-2 block">Buscar Cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      type="text"
                      placeholder="Escribe al menos 2 caracteres para buscar por nombre o teléfono..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchQuery.length > 0 && searchQuery.length < 2 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Escribe al menos 2 caracteres para filtrar
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="sort" className="mb-2 block">Ordenar por</Label>
                  <Select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="name">Alfabético (A-Z)</option>
                    <option value="name-desc">Alfabético (Z-A)</option>
                    <option value="last-movement">Último Movimiento</option>
                    <option value="pending-credit">Crédito Pendiente</option>
                    <option value="revenue">Mejor Cliente (Más Ingresos)</option>
                  </Select>
                </div>
              </div>
            )}

            {customers.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No hay clientes registrados.
                </p>
                <p className="text-sm text-muted-foreground">
                  Crea tu primer cliente usando el botón "Crear Cliente".
                </p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  No se encontraron clientes que coincidan con "{searchQuery}".
                </p>
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Limpiar búsqueda
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCustomers.map((customer) => (
                  <Card 
                    key={customer.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{customer.name || "Sin nombre"}</h3>
                          {customer.phone && (
                            <p className="text-sm text-muted-foreground">📞 {customer.phone}</p>
                          )}
                        </div>
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2 pt-3 border-t">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Crédito Pendiente:</span>
                          <span className={`font-semibold ${
                            (customer.pendingCredit || 0) > 0 ? "text-orange-600" : "text-green-600"
                          }`}>
                            ${(customer.pendingCredit || 0).toLocaleString("es-CO")} COP
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Ingresos Totales:</span>
                          <span className="font-semibold text-blue-600">
                            ${(customer.totalRevenue || 0).toLocaleString("es-CO")} COP
                          </span>
                        </div>
                        
                        {customer.lastMovementDate && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Último Movimiento:
                            </span>
                            <span className="font-medium">
                              {formatColombiaDate(new Date(customer.lastMovementDate))}
                            </span>
                          </div>
                        )}
                        
                        {!customer.lastMovementDate && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Último Movimiento:</span>
                            <span className="text-muted-foreground text-xs">Sin movimientos</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de detalles del cliente */}
        {selectedCustomer && selectedCompanyId && (
          <CustomerDetailsModal
            customer={selectedCustomer}
            companyId={selectedCompanyId}
            onClose={() => setSelectedCustomer(null)}
            onCustomerUpdated={(updatedCustomer) => {
              // Actualizar el cliente en la lista
              setCustomers(prevCustomers => 
                prevCustomers.map(c => 
                  c.id === updatedCustomer.id ? { ...c, ...updatedCustomer } : c
                )
              )
              // Recargar clientes para obtener datos enriquecidos actualizados
              fetchCustomers(selectedCompanyId)
              // Actualizar el cliente seleccionado
              setSelectedCustomer(updatedCustomer)
            }}
          />
        )}

        {/* Botón de atrás al final */}
        <div className="mt-8 flex justify-center">
          <BackButton href="/dashboard/settings" />
        </div>
      </div>
    </div>
  )
}

