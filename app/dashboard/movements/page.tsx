"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EditMovementModal } from "@/components/modals/EditMovementModal"
import { toast } from "sonner"
import { 
  ShoppingCart, 
  Package, 
  Edit, 
  FileText,
  TrendingUp,
  User as UserIcon
} from "lucide-react"
import { formatColombiaDate, formatColombiaTime } from "@/lib/date-utils"
import { formatCurrency } from "@/lib/utils"

export default function MovementsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("")
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMovement, setSelectedMovement] = useState<any>(null)
  const [warehouses, setWarehouses] = useState<any[]>([])

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

  useEffect(() => {
    if (selectedCompanyId) {
      fetchMovements(selectedCompanyId)
      fetchWarehouses(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies")
      if (res.ok) {
        const data = await res.json()
        setCompanies(data)
        if (data.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(data[0].id)
        }
      }
    } catch (error) {
      console.error("Error cargando compañías:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async (companyId: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/warehouses`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
      }
    } catch (error) {
      console.error("Error cargando bodegas:", error)
    }
  }

  const fetchMovements = async (companyId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/movements?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements || [])
      } else {
        toast.error("Error cargando movimientos")
      }
    } catch (error) {
      console.error("Error cargando movimientos:", error)
      toast.error("Error cargando movimientos")
    } finally {
      setLoading(false)
    }
  }

  const handleEditSuccess = () => {
    if (selectedCompanyId) {
      fetchMovements(selectedCompanyId)
    }
    setSelectedMovement(null)
    toast.success("Movimiento actualizado exitosamente")
  }

  const handleViewPDF = (movementId: string) => {
    window.open(`/api/movements/sale/${movementId}/invoice`, "_blank")
  }

  if (status === "loading" || loading) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (companies.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Primero necesitas crear una compañía para poder ver movimientos.
              </p>
              <Button onClick={() => router.push("/dashboard/settings/companies")}>
                Crear Compañía
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const purchases = movements.filter(m => m.type === "purchase")
  const sales = movements.filter(m => m.type === "sale")

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Movimientos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona todas tus compras y ventas
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Seleccionar Compañía</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium">
                Compañía
              </label>
              <select
                id="company"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full p-2 border rounded-md text-base"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" /> Total Movimientos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {movements.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-green-600" /> Ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {sales.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" /> Compras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">
                {purchases.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de movimientos */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Movimientos</CardTitle>
          </CardHeader>
          <CardContent>
            {movements.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-base">
                  No hay movimientos registrados.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {movements.map((movement) => {
                  const isSale = movement.type === "sale"
                  return (
                    <Card 
                      key={movement.id}
                      className={`border-l-4 ${
                        isSale ? "border-green-500" : "border-orange-500"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            {/* Header con tipo y número */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`flex items-center gap-2 px-3 py-1 rounded-md ${
                                isSale ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                              }`}>
                                {isSale ? (
                                  <ShoppingCart className="h-4 w-4" />
                                ) : (
                                  <Package className="h-4 w-4" />
                                )}
                                <span className="font-semibold text-sm">
                                  {isSale ? "VENTA" : "COMPRA"}
                                </span>
                              </div>
                              <span className="font-mono font-semibold text-lg">
                                {movement.movementNumber}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                {formatColombiaDate(new Date(movement.movementDate))} {formatColombiaTime(new Date(movement.movementDate))}
                              </span>
                            </div>

                            {/* Información del movimiento */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="font-medium text-muted-foreground">Producto:</span>
                                <p className="font-semibold">{movement.product?.name || "N/A"}</p>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">Bodega:</span>
                                <p className="font-semibold">{movement.warehouse?.name || "N/A"}</p>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">Cantidad:</span>
                                <p className="font-semibold">{movement.quantity} unidades</p>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">Precio Unitario:</span>
                                <p className="font-semibold">{formatCurrency(Number(movement.unitPrice))}</p>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">Total:</span>
                                <p className="font-semibold text-lg">{formatCurrency(Number(movement.totalAmount))}</p>
                              </div>
                              {isSale && movement.profit !== null && (
                                <div>
                                  <span className="font-medium text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> Ganancia:
                                  </span>
                                  <p className="font-semibold text-green-600 text-lg">
                                    {formatCurrency(Number(movement.profit))}
                                  </p>
                                </div>
                              )}
                              {isSale && movement.customer && (
                                <div>
                                  <span className="font-medium text-muted-foreground flex items-center gap-1">
                                    <UserIcon className="h-3 w-3" /> Cliente:
                                  </span>
                                  <p className="font-semibold">{movement.customer.name}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Botones de acción */}
                          <div className="flex flex-col gap-2 md:min-w-[200px]">
                            <Button
                              onClick={() => setSelectedMovement(movement)}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </Button>
                            {isSale && (
                              <Button
                                onClick={() => handleViewPDF(movement.id)}
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Ver PDF
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de edición */}
      {selectedMovement && (
        <EditMovementModal
          movement={selectedMovement}
          companyId={selectedCompanyId}
          warehouses={warehouses}
          onSuccess={handleEditSuccess}
          onClose={() => setSelectedMovement(null)}
        />
      )}
    </div>
  )
}
