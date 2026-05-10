"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, ShoppingCart, DollarSign, TrendingUp, Package, Calendar, CreditCard, Edit, FileText } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Customer, Movement } from "@/types"
import { EditMovementModal } from "./EditMovementModal"
import { CustomerForm } from "@/components/forms/CustomerForm"

interface CustomerDetailsModalProps {
  customer: Customer
  companyId: string
  isStoreManager?: boolean
  isVendedor?: boolean
  onClose: () => void
  onCustomerUpdated?: (updatedCustomer: Customer) => void
}

export function CustomerDetailsModal({ customer, companyId, isStoreManager = false, isVendedor = false, onClose, onCustomerUpdated }: CustomerDetailsModalProps) {
  const hideFinancialInfo = isStoreManager || isVendedor
  const router = useRouter()
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(customer)
  const [movements, setMovements] = useState<Movement[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    setCurrentCustomer(customer)
  }, [customer])

  useEffect(() => {
    fetchCustomerMovements()
    fetchWarehouses()
  }, [currentCustomer.id, companyId])

  const fetchWarehouses = async () => {
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

  const fetchCustomerMovements = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}/movements?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements)
        setSummary(data.summary)
      } else {
        toast.error("Error al cargar movimientos del cliente.")
      }
    } catch (error) {
      console.error("Error fetching customer movements:", error)
      toast.error("Error de red al cargar movimientos del cliente.")
    } finally {
      setLoading(false)
    }
  }

  const handleEditMovement = (movement: Movement) => {
    setEditingMovement(movement)
  }

  const handleEditSuccess = () => {
    fetchCustomerMovements()
    setEditingMovement(null)
  }

  const handleViewPDF = (movementId: string) => {
    window.open(`/api/movements/sale/${movementId}/invoice`, "_blank")
  }

  const handleViewShippingLabel = (movementId: string) => {
    window.open(`/api/movements/sale/${movementId}/shipping-label`, "_blank")
  }

  const handleCustomerUpdateSuccess = (updatedCustomer?: Customer) => {
    if (!updatedCustomer) return
    
    setCurrentCustomer(updatedCustomer)
    setEditingCustomer(false)
    fetchCustomerMovements()
    onCustomerUpdated?.(updatedCustomer)
    toast.success("✅ Cliente actualizado", {
      description: "Los cambios se han guardado correctamente",
      duration: 3000
    })
  }

  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="p-6 text-center text-base">Cargando movimientos...</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <Card 
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="sticky top-0 bg-white z-10 border-b pb-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              {!editingCustomer ? (
                <>
                  <CardTitle className="text-2xl">{currentCustomer.name}</CardTitle>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {currentCustomer.nombreRecibe && currentCustomer.nombreRecibe !== currentCustomer.name && (
                      <p className="flex items-center gap-2">
                        👤 Recibe: {currentCustomer.nombreRecibe}
                      </p>
                    )}
                    {currentCustomer.cedula && (
                      <p className="flex items-center gap-2">
                        🆔 Cédula: {currentCustomer.cedula}
                      </p>
                    )}
                    {currentCustomer.phone && (
                      <p className="flex items-center gap-2">
                        📞 {currentCustomer.phone}
                      </p>
                    )}
                    {(currentCustomer.departamento || currentCustomer.ciudad) && (
                      <p className="flex items-center gap-2">
                        📍 {[currentCustomer.departamento, currentCustomer.ciudad].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {currentCustomer.barrio && (
                      <p className="flex items-center gap-2">
                        🏘️ Barrio: {currentCustomer.barrio}
                      </p>
                    )}
                    {currentCustomer.direccion1 && (
                      <p className="flex items-center gap-2">
                        🏠 {currentCustomer.direccion1}
                      </p>
                    )}
                    {currentCustomer.direccion2 && (
                      <p className="flex items-center gap-2">
                        🏢 {currentCustomer.direccion2}
                      </p>
                    )}
                    {currentCustomer.address && !currentCustomer.direccion1 && (
                      <p className="flex items-center gap-2">
                        📍 {currentCustomer.address}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <CardTitle className="text-2xl">Editar Cliente</CardTitle>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!editingCustomer && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCustomer(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-6 w-6 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Formulario de edición */}
          {editingCustomer ? (
            <Card className="border-2 border-primary">
              <CardContent className="p-6">
                <CustomerForm
                  companyId={companyId}
                  customer={currentCustomer}
                  onSuccess={handleCustomerUpdateSuccess}
                  onCancel={() => setEditingCustomer(false)}
                />
              </CardContent>
            </Card>
          ) : (
            <>
          {/* Resumen - Oculto para STORE_MANAGER y VENDEDOR */}
          {summary && !hideFinancialInfo && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" /> Total Ventas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-700">
                    ${summary.totalSales.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {summary.totalMovements} {summary.totalMovements === 1 ? "movimiento" : "movimientos"}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" /> Ganancia Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">
                    ${summary.totalProfit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {summary.totalQuantity} {summary.totalQuantity === 1 ? "unidad" : "unidades"}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50 border-yellow-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-600" /> Contado Recibido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-700">
                    ${summary.totalCash.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </div>
                </CardContent>
              </Card>

              <Card 
                className="bg-orange-50 border-orange-200 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("creditsReferrer", "/dashboard/customers")
                  }
                  onClose()
                  router.push("/dashboard/credits")
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-orange-600" /> Crédito Pendiente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-700">
                    ${summary.pendingCredit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </div>
                  {summary.totalCredit > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Total crédito: ${summary.totalCredit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Lista de Movimientos - Oculto para STORE_MANAGER y VENDEDOR */}
          {!hideFinancialInfo && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Historial de Ventas</h3>
            {movements.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-base">
                    Este cliente no tiene movimientos registrados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {movements.map((movement) => (
                  <Card key={movement.id} className="border-green-100 bg-green-50 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <ShoppingCart className="h-5 w-5 shrink-0 text-green-600" />
                            <span className="font-semibold text-lg">Venta</span>
                            <span className="text-sm text-muted-foreground">
                              ({format(new Date(movement.movementDate), "PPP 'a las' HH:mm", { locale: es })})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-base sm:grid-cols-2">
                            <p><span className="font-medium">No. Movimiento:</span> {movement.movementNumber}</p>
                            <p><span className="font-medium">Producto:</span> {movement.product?.name}</p>
                            <p><span className="font-medium">Bodega:</span> {movement.warehouse?.name}</p>
                            <p><span className="font-medium">Cantidad:</span> {movement.quantity} unidades</p>
                            <p><span className="font-medium">Precio Unitario:</span> ${(Number(movement.unitPrice) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                            <p><span className="font-medium">Total:</span> ${(Number(movement.totalAmount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                            {movement.profit !== null && (
                              <p><span className="font-medium">Ganancia:</span> ${(Number(movement.profit) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                            )}
                            <p><span className="font-medium">Pago:</span> {
                              movement.paymentType === "cash" ? "Contado" :
                              movement.paymentType === "credit" ? "Crédito" :
                              "Mixto"
                            }</p>
                            {movement.creditDays && (
                              <p><span className="font-medium">Plazo:</span> {movement.creditDays} días</p>
                            )}
                            {movement.paymentType === "mixed" && (
                              <>
                                <p><span className="font-medium">Contado:</span> ${(Number(movement.cashAmount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                                <p><span className="font-medium">Crédito:</span> ${(Number(movement.creditAmount) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
                              </>
                            )}
                            {movement.hasShipping && movement.shippingCost && (
                              <p><span className="font-medium">Envío:</span> ${(Number(movement.shippingCost) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                ({movement.shippingPaidBy === "customer" ? "Cliente" : "Vendedor"})
                              </p>
                            )}
                            {movement.notes && (
                              <p className="sm:col-span-2"><span className="font-medium">Notas:</span> {movement.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 md:min-w-[200px]">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleEditMovement(movement)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => handleViewPDF(movement.id)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver PDF
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            onClick={() => handleViewShippingLabel(movement.id)}
                          >
                            <Package className="mr-2 h-4 w-4" />
                            Ver Guía de Envío
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de edición */}
      {editingMovement && (
        <EditMovementModal
          key={editingMovement.id}
          movement={editingMovement}
          companyId={companyId}
          warehouses={warehouses}
          onSuccess={handleEditSuccess}
          onClose={() => setEditingMovement(null)}
        />
      )}
    </div>
  )
}

