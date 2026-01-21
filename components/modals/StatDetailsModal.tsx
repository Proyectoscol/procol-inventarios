"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Receipt, Calendar } from "lucide-react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { formatColombiaDate } from "@/lib/date-utils"

interface StatDetailsModalProps {
  open: boolean
  onClose: () => void
  title: string
  companyId: string
  type: "sales" | "cash" | "purchases" | "credit" | "units" | "average" | "cashflow" | "profit" | "all"
  dateRange?: { from: Date; to: Date }
}

export function StatDetailsModal({
  open,
  onClose,
  title,
  companyId,
  type,
  dateRange
}: StatDetailsModalProps) {
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    if (open && companyId) {
      fetchMovements()
    }
  }, [open, companyId, type, dateRange])

  const fetchMovements = async () => {
    if (!companyId) return
    
    setLoading(true)
    try {
      const from = dateRange?.from || (() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return d
      })()
      const to = dateRange?.to || new Date()

      const params = new URLSearchParams({
        companyId,
        from: from.toISOString(),
        to: to.toISOString()
      })

      // Para flujo de caja y "all", necesitamos ambos tipos
      if (type === "cashflow" || type === "all") {
        // No filtrar por tipo, traer todos
      } else if (type === "sales" || type === "cash" || type === "units" || type === "average" || type === "profit") {
        params.append("type", "sale")
      } else if (type === "purchases") {
        params.append("type", "purchase")
      }

      const res = await fetch(`/api/movements?${params}`)
      if (!res.ok) throw new Error("Error cargando movimientos")
      const data = await res.json()
      
      let filteredMovements = data.movements || data

      // Filtrar adicional según el tipo
      if (type === "cash") {
        // Solo ventas en contado
        filteredMovements = filteredMovements.filter((m: any) => 
          m.paymentType === "cash" || (m.paymentType === "mixed" && m.cashAmount > 0)
        )
      } else if (type === "credit") {
        // Solo ventas con crédito pendiente
        filteredMovements = filteredMovements.filter((m: any) => 
          m.paymentType === "credit" || m.paymentType === "mixed"
        )
      } else if (type === "cashflow") {
        // Para flujo de caja, separar entradas (ventas en contado) y salidas (compras)
        // Mantener todos los movimientos pero marcarlos
      }

      setMovements(filteredMovements)

      // Calcular resumen
      let totalAmount = 0
      let totalQuantity = 0
      let cashAmount = 0
      let creditAmount = 0
      let totalProfit = 0
      let inflows = 0  // Entradas (ventas en contado)
      let outflows = 0 // Salidas (compras)

      if (type === "cashflow") {
        // Para flujo de caja, calcular entradas y salidas
        filteredMovements.forEach((m: any) => {
          if (m.type === "sale") {
            // Entradas: solo el contado de las ventas
            if (m.paymentType === "cash") {
              inflows += Number(m.totalAmount || 0)
            } else if (m.paymentType === "mixed") {
              inflows += Number(m.cashAmount || 0)
            }
          } else if (m.type === "purchase") {
            // Salidas: todas las compras
            outflows += Number(m.totalAmount || 0)
          }
        })
        totalAmount = inflows - outflows
      } else if (type === "all") {
        // Para "Total Movimientos", calcular ambos tipos
        filteredMovements.forEach((m: any) => {
          if (m.type === "sale") {
            inflows += Number(m.totalAmount || 0)
          } else if (m.type === "purchase") {
            outflows += Number(m.totalAmount || 0)
          }
        })
        totalAmount = inflows - outflows
      } else {
        totalAmount = filteredMovements.reduce((sum: number, m: any) => 
          sum + Number(m.totalAmount || 0), 0
        )
        totalQuantity = filteredMovements.reduce((sum: number, m: any) => 
          sum + Number(m.quantity || 0), 0
        )
        cashAmount = filteredMovements.reduce((sum: number, m: any) => {
          if (m.paymentType === "cash") return sum + Number(m.totalAmount || 0)
          if (m.paymentType === "mixed") return sum + Number(m.cashAmount || 0)
          return sum
        }, 0)
        creditAmount = filteredMovements.reduce((sum: number, m: any) => {
          if (m.paymentType === "credit") return sum + Number(m.totalAmount || 0)
          if (m.paymentType === "mixed") return sum + Number(m.creditAmount || 0)
          return sum
        }, 0)
        totalProfit = filteredMovements.reduce((sum: number, m: any) => 
          sum + Number(m.profit || 0), 0
        )
      }

      setSummary({
        totalAmount,
        totalQuantity,
        cashAmount,
        creditAmount,
        totalProfit,
        inflows,
        outflows,
        count: filteredMovements.length,
        average: filteredMovements.length > 0 ? totalAmount / filteredMovements.length : 0
      })
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl">{title}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Resumen */}
              {summary && (
                <div className={`grid gap-4 mb-6 ${
                  type === "cashflow" || type === "all"
                    ? "grid-cols-1 md:grid-cols-3" 
                    : "grid-cols-2 md:grid-cols-4"
                }`}>
                  {type === "cashflow" ? (
                    <>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs text-muted-foreground mb-1">💰 Entradas</p>
                        <p className="text-lg font-bold text-green-600">
                          ${(summary.inflows || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Ventas en contado</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs text-muted-foreground mb-1">💸 Salidas</p>
                        <p className="text-lg font-bold text-red-600">
                          ${(summary.outflows || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Compras</p>
                      </div>
                      <div className={`p-3 rounded-lg border ${
                        (summary.totalAmount || 0) >= 0 
                          ? "bg-green-50 border-green-200" 
                          : "bg-red-50 border-red-200"
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">💵 Flujo Neto</p>
                        <p className={`text-lg font-bold ${
                          (summary.totalAmount || 0) >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          ${(summary.totalAmount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Entradas - Salidas</p>
                      </div>
                    </>
                  ) : type === "all" ? (
                    <>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs text-muted-foreground mb-1">💰 Ventas</p>
                        <p className="text-lg font-bold text-green-600">
                          ${(summary.inflows || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total ventas</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-xs text-muted-foreground mb-1">💸 Compras</p>
                        <p className="text-lg font-bold text-red-600">
                          ${(summary.outflows || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total compras</p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">🔄 Movimientos</p>
                        <p className="text-lg font-bold">
                          {summary.count}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total registrados</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Total</p>
                        <p className="text-lg font-bold">
                          ${summary.totalAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </p>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Movimientos</p>
                        <p className="text-lg font-bold">{summary.count}</p>
                      </div>
                      {type === "sales" || type === "cash" || type === "average" ? (
                        <>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Contado</p>
                            <p className="text-lg font-bold text-green-600">
                              ${summary.cashAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            </p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Crédito</p>
                            <p className="text-lg font-bold text-orange-600">
                              ${summary.creditAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                            </p>
                          </div>
                        </>
                      ) : null}
                      {type === "units" && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Unidades</p>
                          <p className="text-lg font-bold">
                            {summary.totalQuantity.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </p>
                        </div>
                      )}
                      {type === "average" && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Promedio</p>
                          <p className="text-lg font-bold">
                            ${Math.round(summary.average).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </p>
                        </div>
                      )}
                      {type === "profit" && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Ganancia</p>
                          <p className="text-lg font-bold text-blue-600">
                            ${summary.totalProfit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Lista de movimientos */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Movimientos ({movements.length})
                </h3>
                {movements.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay movimientos en este período</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {movements.map((movement) => (
                      <Card key={movement.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{movement.product?.name || "Producto"}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  movement.type === "sale" 
                                    ? "bg-green-100 text-green-700" 
                                    : "bg-blue-100 text-blue-700"
                                }`}>
                                  {movement.type === "sale" ? "Venta" : "Compra"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                {movement.customer && (
                                  <span className="flex items-center gap-1">
                                    <span>Cliente:</span>
                                    <span className="font-medium">{movement.customer.name}</span>
                                  </span>
                                )}
                                {movement.warehouse && (
                                  <span className="flex items-center gap-1">
                                    <span>Bodega:</span>
                                    <span className="font-medium">{movement.warehouse.name}</span>
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatColombiaDate(new Date(movement.movementDate))}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col md:items-end gap-1">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Cantidad</p>
                                <p className="font-semibold">{movement.quantity}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Total</p>
                                <p className={`text-lg font-bold ${
                                  (type === "cashflow" || type === "all") && movement.type === "purchase" 
                                    ? "text-red-600" 
                                    : (type === "cashflow" || type === "all") && movement.type === "sale"
                                    ? "text-green-600"
                                    : ""
                                }`}>
                                  {(type === "cashflow" || type === "all") && movement.type === "purchase" ? "-" : ""}
                                  ${Number(movement.totalAmount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                </p>
                              </div>
                              {movement.paymentType && (
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">
                                    {movement.paymentType === "cash" ? "Contado" : 
                                     movement.paymentType === "credit" ? "Crédito" : "Mixto"}
                                  </p>
                                  {movement.paymentType === "mixed" && (
                                    <p className="text-xs">
                                      C: ${Number(movement.cashAmount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} | 
                                      Cr: ${Number(movement.creditAmount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
        <div className="flex-shrink-0 border-t p-4 flex justify-end">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </Card>
    </div>
  )
}
