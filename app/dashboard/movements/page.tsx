"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EditMovementModal } from "@/components/modals/EditMovementModal"
import { DateRangeSelector } from "@/components/shared/DateRangeSelector"
import { toast } from "sonner"
import { 
  ShoppingCart, 
  Package, 
  Edit, 
  FileText,
  TrendingUp,
  User as UserIcon,
  Warehouse,
  Calendar,
  RotateCcw,
  Trash2
} from "lucide-react"
import { formatColombiaDate, formatColombiaTime } from "@/lib/date-utils"
import { formatCurrency, cn } from "@/lib/utils"
import { useCompany } from "@/contexts/CompanyContext"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function MovementsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedCompanyId } = useCompany()
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMovement, setSelectedMovement] = useState<any>(null)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<Set<string>>(new Set())
  const [isLoadingMovements, setIsLoadingMovements] = useState(false)
  const [movementToDelete, setMovementToDelete] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Estado para el rango de fechas - Por defecto: todo el historial
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date()
    to.setHours(23, 59, 59, 999)
    // Fecha de inicio: 1 de enero de 2000 (fecha muy antigua para incluir todo el historial)
    const from = new Date(2000, 0, 1)
    from.setHours(0, 0, 0, 0)
    return { from, to }
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchWarehouses(selectedCompanyId)
    }
  }, [selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId && warehouses.length > 0) {
      // Seleccionar todas las bodegas por defecto
      const allIds = new Set<string>(warehouses.map((w: any) => w.id))
      setSelectedWarehouseIds(allIds)
      // Cargar movimientos con todas las bodegas seleccionadas
      if (allIds.size > 0) {
        fetchMovements(selectedCompanyId, Array.from(allIds))
      } else {
        fetchMovements(selectedCompanyId, [])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, warehouses])

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

  const fetchMovements = async (companyId: string, warehouseIds: string[] = [], dateRangeToUse?: { from: Date; to: Date }) => {
    // Evitar múltiples llamadas simultáneas
    if (isLoadingMovements) return
    
    setIsLoadingMovements(true)
    try {
      const range = dateRangeToUse || dateRange
      const from = new Date(range.from)
      from.setHours(0, 0, 0, 0)
      const to = new Date(range.to)
      to.setHours(23, 59, 59, 999)

      // Construir parámetros de bodegas
      const warehouseParams = warehouseIds.length > 0 
        ? `&warehouseIds=${warehouseIds.join(",")}`
        : ""

      const res = await fetch(
        `/api/movements?companyId=${companyId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`
      )
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
      setIsLoadingMovements(false)
      setLoading(false)
    }
  }

  const toggleWarehouse = (warehouseId: string) => {
    setSelectedWarehouseIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(warehouseId)) {
        newSet.delete(warehouseId)
      } else {
        newSet.add(warehouseId)
      }
      return newSet
    })
  }

  const resetFilters = () => {
    // Restablecer rango de fechas a todo el historial
    const to = new Date()
    to.setHours(23, 59, 59, 999)
    const from = new Date(2000, 0, 1)
    from.setHours(0, 0, 0, 0)
    setDateRange({ from, to })
    
    // Seleccionar todas las bodegas
    if (warehouses.length > 0) {
      const allIds = new Set<string>(warehouses.map((w: any) => w.id))
      setSelectedWarehouseIds(allIds)
      
      // Recargar movimientos con filtros restablecidos
      if (selectedCompanyId) {
        fetchMovements(selectedCompanyId, Array.from(allIds), { from, to })
      }
    }
  }

  const handleDateRangeChange = (from: Date, to: Date) => {
    setDateRange({ from, to })
    // Recargar movimientos inmediatamente cuando cambia el rango de fechas
    if (selectedCompanyId) {
      const selectedIds = Array.from(selectedWarehouseIds)
      fetchMovements(selectedCompanyId, selectedIds, { from, to })
    }
  }

  // Recargar movimientos cuando cambien las bodegas seleccionadas (solo si no se está cargando)
  useEffect(() => {
    if (selectedCompanyId && warehouses.length > 0 && !isLoadingMovements) {
      const selectedIds = Array.from(selectedWarehouseIds)
      // Solo cargar si hay bodegas seleccionadas o si no hay bodegas disponibles
      if (selectedIds.length > 0 || warehouses.length === 0) {
        fetchMovements(selectedCompanyId, selectedIds)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseIds, selectedCompanyId])

  const handleEditSuccess = () => {
    if (selectedCompanyId) {
      fetchMovements(selectedCompanyId, Array.from(selectedWarehouseIds))
    }
    setSelectedMovement(null)
    toast.success("Movimiento actualizado exitosamente")
  }

  const confirmDeleteMovement = async () => {
    if (!movementToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/movements/${movementToDelete.id}`, { method: "DELETE" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body.error || "No se pudo eliminar el movimiento")
        return
      }
      toast.success(
        movementToDelete.type === "sale"
          ? "Venta eliminada. El inventario y los lotes se restauraron."
          : "Compra eliminada. El inventario se actualizó y el lote se quitó."
      )
      setMovementToDelete(null)
      if (selectedCompanyId) {
        fetchMovements(selectedCompanyId, Array.from(selectedWarehouseIds))
      }
    } catch {
      toast.error("Error de red al eliminar el movimiento")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewPDF = (movementId: string) => {
    window.open(`/api/movements/sale/${movementId}/invoice`, "_blank")
  }

  const handleViewShippingLabel = (movementId: string) => {
    window.open(`/api/movements/sale/${movementId}/shipping-label`, "_blank")
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

  if (!selectedCompanyId) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Por favor selecciona una compañía en el header para ver movimientos.
              </p>
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

        {/* Filtros de Bodegas y Fechas */}
        <div className="mb-6">
          {/* Botón de Restablecer Filtros */}
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              disabled={isLoadingMovements}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restablecer Todos los Filtros
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Filtros de Bodegas */}
            {warehouses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Warehouse className="h-5 w-5" />
                    Filtrar por Bodegas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {warehouses.map((warehouse) => {
                      const isSelected = selectedWarehouseIds.has(warehouse.id)
                      return (
                        <Button
                          key={warehouse.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleWarehouse(warehouse.id)}
                          disabled={isLoadingMovements}
                          className={cn(
                            "transition-all",
                            isSelected && "bg-primary text-primary-foreground",
                            isLoadingMovements && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {warehouse.name}
                        </Button>
                      )
                    })}
                  </div>
                  {selectedWarehouseIds.size === 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ⚠️ No hay bodegas seleccionadas. Selecciona al menos una para ver movimientos.
                    </p>
                  )}
                  {isLoadingMovements && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Cargando movimientos...
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Filtros de Fecha */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Filtrar por Período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DateRangeSelector
                  from={dateRange.from}
                  to={dateRange.to}
                  onChange={handleDateRangeChange}
                />
                <p className="text-sm text-muted-foreground mt-3">
                  Selecciona un rango de fechas para ver los movimientos del período
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

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
                            <Button
                              onClick={() => setMovementToDelete(movement)}
                              variant="outline"
                              size="sm"
                              className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </Button>
                            {isSale && (
                              <>
                                <Button
                                  onClick={() => handleViewPDF(movement.id)}
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver PDF
                                </Button>
                                <Button
                                  onClick={() => handleViewShippingLabel(movement.id)}
                                  variant="outline"
                                  size="sm"
                                  className="w-full bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                                >
                                  <Package className="h-4 w-4 mr-2" />
                                  Ver Guía de Envío
                                </Button>
                              </>
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
      {selectedMovement && selectedCompanyId && (
        <EditMovementModal
          key={selectedMovement.id}
          movement={selectedMovement}
          companyId={selectedCompanyId}
          warehouses={warehouses}
          onSuccess={handleEditSuccess}
          onClose={() => setSelectedMovement(null)}
        />
      )}

      <AlertDialog
        open={!!movementToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setMovementToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {movementToDelete?.type === "sale" ? "Eliminar venta" : "Eliminar compra"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                {movementToDelete?.type === "sale" ? (
                  <>
                    <p>
                      Se borrará el registro{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {movementToDelete?.movementNumber}
                      </span>{" "}
                      y se devolverán{" "}
                      <span className="font-semibold text-foreground">
                        {movementToDelete?.quantity} unidades
                      </span>{" "}
                      al inventario y a los lotes (costos) como si la venta no hubiera existido.
                    </p>
                    <p>Esta acción no se puede deshacer.</p>
                  </>
                ) : (
                  <>
                    <p>
                      Se borrará la compra{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {movementToDelete?.movementNumber}
                      </span>{" "}
                      y se quitarán las unidades del inventario solo si ninguna venta ya consumió
                      mercancía de ese lote.
                    </p>
                    <p>
                      Si el sistema indica que ya hay ventas sobre ese lote, primero debes corregir
                      o eliminar esas ventas, o usar <strong className="text-foreground">Editar</strong>{" "}
                      para ajustar la compra.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={confirmDeleteMovement}
            >
              {isDeleting ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
