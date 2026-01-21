"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Package, TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Box } from "lucide-react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { formatColombiaDate, toColombiaDateString } from "@/lib/date-utils"

interface ProductDetailsModalProps {
  open: boolean
  onClose: () => void
  productId: string
  productName: string
  companyId: string
  warehouseIds?: string[]
}

export function ProductDetailsModal({
  open,
  onClose,
  productId,
  productName,
  companyId,
  warehouseIds = []
}: ProductDetailsModalProps) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "sales" | "purchases">("overview")

  useEffect(() => {
    if (open && productId && companyId) {
      fetchProductStats()
    }
  }, [open, productId, companyId, warehouseIds])

  const fetchProductStats = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        companyId,
        ...(warehouseIds.length > 0 && { warehouseIds: warehouseIds.join(",") })
      })
      
      const res = await fetch(`/api/products/${productId}/stats?${params}`)
      if (!res.ok) throw new Error("Error cargando estadísticas")
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error("Error cargando estadísticas del producto:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">{productName}</h2>
              <p className="text-sm text-muted-foreground">Estadísticas detalladas del producto</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : stats ? (
            <>
              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b">
                <Button
                  variant={activeTab === "overview" ? "default" : "ghost"}
                  onClick={() => setActiveTab("overview")}
                  className="rounded-b-none"
                >
                  Resumen
                </Button>
                <Button
                  variant={activeTab === "customers" ? "default" : "ghost"}
                  onClick={() => setActiveTab("customers")}
                  className="rounded-b-none"
                >
                  Clientes ({stats.customers.length})
                </Button>
                <Button
                  variant={activeTab === "sales" ? "default" : "ghost"}
                  onClick={() => setActiveTab("sales")}
                  className="rounded-b-none"
                >
                  Ventas ({stats.sales.totalCount})
                </Button>
                <Button
                  variant={activeTab === "purchases" ? "default" : "ghost"}
                  onClick={() => setActiveTab("purchases")}
                  className="rounded-b-none"
                >
                  Compras ({stats.purchases.totalCount})
                </Button>
              </div>

              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Estadísticas principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Box className="h-4 w-4" />
                          Stock Actual
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {stats.stock.total.toLocaleString("es-CO")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.product.unit || "unidades"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Veces Vendido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">
                          {stats.sales.totalCount.toLocaleString("es-CO")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.sales.totalQuantity.toLocaleString("es-CO")} unidades totales
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Total Vendido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600">
                          ${stats.sales.totalAmount.toLocaleString("es-CO")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ganancia: ${stats.sales.totalProfit.toLocaleString("es-CO")}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-blue-600" />
                          Total Comprado
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-blue-600">
                          ${stats.purchases.totalAmount.toLocaleString("es-CO")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.purchases.totalQuantity.toLocaleString("es-CO")} unidades
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Precios promedio */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Precio Promedio de Venta</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-green-600">
                          ${stats.sales.avgPrice.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        {stats.sales.lastSale && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Última venta: {new Date(stats.sales.lastSale.date).toLocaleDateString("es-CO", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })} - 
                            ${stats.sales.lastSale.unitPrice.toLocaleString("es-CO")} c/u
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Precio Promedio de Compra</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-blue-600">
                          ${stats.purchases.avgPrice.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        {stats.purchases.lastPurchase && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Última compra: {new Date(stats.purchases.lastPurchase.date).toLocaleDateString("es-CO", {
                              year: "numeric",
                              month: "short",
                              day: "numeric"
                            })} - 
                            ${stats.purchases.lastPurchase.unitPrice.toLocaleString("es-CO")} c/u
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Stock por bodega */}
                  {stats.stock.byWarehouse.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Stock por Bodega</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {stats.stock.byWarehouse.map((stock: any) => (
                            <div key={stock.warehouseId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <span className="font-medium">{stock.warehouseName}</span>
                              <span className="text-lg font-bold">
                                {stock.quantity.toLocaleString("es-CO")} {stats.product.unit || "unidades"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Customers Tab */}
              {activeTab === "customers" && (
                <div className="space-y-4">
                  {stats.customers.length > 0 ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Clientes que Compran este Producto ({stats.customers.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-3 font-semibold">Cliente</th>
                                  <th className="text-right p-3 font-semibold">Compras</th>
                                  <th className="text-right p-3 font-semibold">Cantidad</th>
                                  <th className="text-right p-3 font-semibold">Total</th>
                                  <th className="text-right p-3 font-semibold">Última Compra</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stats.customers.map((customer: any, idx: number) => (
                                  <tr key={customer.customer.id || idx} className="border-b hover:bg-muted/50">
                                    <td className="p-3">
                                      <div>
                                        <p className="font-medium">{customer.customer.name || "Sin nombre"}</p>
                                        {customer.customer.phone && (
                                          <p className="text-xs text-muted-foreground">{customer.customer.phone}</p>
                                        )}
                                      </div>
                                    </td>
                                    <td className="text-right p-3">{customer.totalPurchases}</td>
                                    <td className="text-right p-3">{customer.totalQuantity.toLocaleString("es-CO")}</td>
                                    <td className="text-right p-3 font-semibold">
                                      ${customer.totalAmount.toLocaleString("es-CO")}
                                    </td>
                                    <td className="text-right p-3 text-sm text-muted-foreground">
                                      {customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString("es-CO", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric"
                                      }) : "N/A"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No hay clientes registrados para este producto</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Sales Tab */}
              {activeTab === "sales" && (
                <div className="space-y-4">
                  {stats.recentSales.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Ventas Recientes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Fecha</th>
                                <th className="text-left p-3 font-semibold">Cliente</th>
                                <th className="text-right p-3 font-semibold">Cantidad</th>
                                <th className="text-right p-3 font-semibold">Precio Unit.</th>
                                <th className="text-right p-3 font-semibold">Total</th>
                                <th className="text-left p-3 font-semibold">Bodega</th>
                                <th className="text-left p-3 font-semibold">Pago</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.recentSales.map((sale: any) => (
                                <tr key={sale.id} className="border-b hover:bg-muted/50">
                                  <td className="p-3 text-sm">
                                    {new Date(sale.date).toLocaleDateString("es-CO", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric"
                                    })}
                                  </td>
                                  <td className="p-3">
                                    <div>
                                      <p className="font-medium">{sale.customerName}</p>
                                      {sale.customerPhone && (
                                        <p className="text-xs text-muted-foreground">{sale.customerPhone}</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-right p-3">{sale.quantity.toLocaleString("es-CO")}</td>
                                  <td className="text-right p-3">${sale.unitPrice.toLocaleString("es-CO")}</td>
                                  <td className="text-right p-3 font-semibold">
                                    ${sale.totalAmount.toLocaleString("es-CO")}
                                  </td>
                                  <td className="p-3 text-sm">{sale.warehouseName}</td>
                                  <td className="p-3">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      sale.paymentType === "cash" ? "bg-green-100 text-green-800" :
                                      sale.paymentType === "credit" ? "bg-orange-100 text-orange-800" :
                                      "bg-blue-100 text-blue-800"
                                    }`}>
                                      {sale.paymentType === "cash" ? "Contado" :
                                       sale.paymentType === "credit" ? "Crédito" : "Mixto"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No hay ventas registradas para este producto</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Purchases Tab */}
              {activeTab === "purchases" && (
                <div className="space-y-4">
                  {stats.recentPurchases.length > 0 ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingDown className="h-5 w-5" />
                          Compras Recientes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Fecha</th>
                                <th className="text-right p-3 font-semibold">Cantidad</th>
                                <th className="text-right p-3 font-semibold">Precio Unit.</th>
                                <th className="text-right p-3 font-semibold">Total</th>
                                <th className="text-left p-3 font-semibold">Bodega</th>
                                <th className="text-left p-3 font-semibold">Lote</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.recentPurchases.map((purchase: any) => (
                                <tr key={purchase.id} className="border-b hover:bg-muted/50">
                                  <td className="p-3 text-sm">
                                    {new Date(purchase.date).toLocaleDateString("es-CO", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric"
                                    })}
                                  </td>
                                  <td className="text-right p-3">{purchase.quantity.toLocaleString("es-CO")}</td>
                                  <td className="text-right p-3">${purchase.unitPrice.toLocaleString("es-CO")}</td>
                                  <td className="text-right p-3 font-semibold">
                                    ${purchase.totalAmount.toLocaleString("es-CO")}
                                  </td>
                                  <td className="p-3 text-sm">{purchase.warehouseName}</td>
                                  <td className="p-3 text-sm text-muted-foreground">
                                    {purchase.batchNumber || "N/A"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Box className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No hay compras registradas para este producto</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No se pudieron cargar las estadísticas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
