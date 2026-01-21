"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/shared/BackButton"
import { MovementCalendar } from "@/components/calendar/MovementCalendar"
import { DayDetailsModal } from "@/components/calendar/DayDetailsModal"
import { StatDetailsModal } from "@/components/modals/StatDetailsModal"
import { ProductDetailsModal } from "@/components/modals/ProductDetailsModal"
import { Warehouse } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCompany } from "@/contexts/CompanyContext"

export default function StatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedCompanyId } = useCompany()
  const [stats, setStats] = useState<any>(null)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<Set<string>>(new Set())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedStat, setSelectedStat] = useState<{ type: string; title: string } | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null)

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

  const fetchWarehouses = async (compId: string) => {
    try {
      const res = await fetch(`/api/companies/${compId}/warehouses`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
        // Seleccionar todas las bodegas por defecto
        const allIds = new Set<string>(data.map((w: any) => w.id))
        setSelectedWarehouseIds(allIds)
        // Cargar estadísticas con todas las bodegas seleccionadas
        if (data.length > 0) {
          fetchStats(compId, Array.from(allIds))
        } else {
          // Si no hay bodegas, cargar sin filtro
          fetchStats(compId, [])
        }
      }
    } catch (error) {
      console.error("Error cargando bodegas:", error)
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

  const fetchStats = async (compId: string, warehouseIds: string[]) => {
    try {
      const from = new Date()
      from.setMonth(from.getMonth() - 1)
      const to = new Date()

      // Construir parámetros de bodegas
      const warehouseParams = warehouseIds.length > 0 
        ? `&warehouseIds=${warehouseIds.join(",")}`
        : ""

      const [sales, profit, purchases, cashFlow, customers, topSales] = await Promise.all([
        fetch(`/api/reports/sales?companyId=${compId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`)
          .then(r => r.json()),
        fetch(`/api/reports/profit?companyId=${compId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`)
          .then(r => r.json()),
        fetch(`/api/reports/purchases?companyId=${compId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`)
          .then(r => r.json()),
        fetch(`/api/reports/cash-flow?companyId=${compId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`)
          .then(r => r.json()),
        fetch(`/api/reports/customers?companyId=${compId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`)
          .then(r => r.json()),
        fetch(`/api/reports/top-sales?companyId=${compId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`)
          .then(r => r.json())
      ])

      setStats({ sales, profit, purchases, cashFlow, customers: customers.customers || [], topSales: topSales.topProducts || [], dateRange: { from, to } })
    } catch (error) {
      console.error("Error cargando estadísticas:", error)
    }
  }

  // Recargar estadísticas cuando cambien las bodegas seleccionadas (solo si ya se cargaron las bodegas)
  useEffect(() => {
    if (selectedCompanyId && warehouses.length > 0) {
      const selectedIds = Array.from(selectedWarehouseIds)
      if (selectedIds.length > 0) {
        fetchStats(selectedCompanyId, selectedIds)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseIds, selectedCompanyId])

  if (status === "loading" || !stats) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-4">
        <BackButton href="/dashboard" />
      </div>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Estadísticas y Reportes</h1>

        {/* Filtros de Bodegas */}
        {warehouses.length > 0 && (
          <Card className="mb-6">
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
                      className={cn(
                        "transition-all",
                        isSelected && "bg-primary text-primary-foreground"
                      )}
                    >
                      {warehouse.name}
                    </Button>
                  )
                })}
              </div>
              {selectedWarehouseIds.size === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  ⚠️ No hay bodegas seleccionadas. Selecciona al menos una para ver estadísticas.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedStat({ type: "sales", title: "Ventas Totales" })}
          >
            <CardHeader>
              <CardTitle>💰 Ventas Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold">
                ${stats.sales.totalAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                {stats.sales.count} movimientos
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedStat({ type: "cash", title: "Ventas en Contado" })}
          >
            <CardHeader>
              <CardTitle>💵 Contado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold text-green-600">
                ${stats.sales.cashAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedStat({ type: "profit", title: "Ganancia Neta" })}
          >
            <CardHeader>
              <CardTitle>📊 Ganancia Neta</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl md:text-2xl font-bold text-blue-600">
                ${stats.profit.netProfit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                Margen: {stats.profit.margin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>🏆 Top 5 Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topSales && stats.topSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-3 font-semibold">#</th>
                      <th className="text-left p-2 sm:p-3 font-semibold">Producto</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Unidades Vendidas</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Stock Actual</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Último Precio Compra</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Total Vendido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topSales.map((product: any, idx: number) => (
                      <tr 
                        key={product.productId} 
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedProduct({ id: product.productId, name: product.productName })}
                      >
                        <td className="p-2 sm:p-3 font-semibold">{idx + 1}</td>
                        <td className="p-2 sm:p-3">
                          <div className="font-medium">{product.productName}</div>
                        </td>
                        <td className="text-right p-2 sm:p-3 font-semibold">
                          {product.totalSold.toLocaleString("es-CO")}
                        </td>
                        <td className="text-right p-2 sm:p-3">
                          <span className={`font-semibold ${
                            product.currentStock > 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {product.currentStock.toLocaleString("es-CO")}
                          </span>
                        </td>
                        <td className="text-right p-2 sm:p-3">
                          {product.lastPurchasePrice ? (
                            <span className="font-semibold text-blue-600">
                              ${product.lastPurchasePrice.toLocaleString("es-CO")} COP
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          )}
                        </td>
                        <td className="text-right p-2 sm:p-3 font-semibold text-green-600">
                          ${product.totalRevenue.toLocaleString("es-CO")} COP
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No hay datos de ventas disponibles en este período.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendario de Movimientos */}
        {selectedCompanyId && (
          <div className="mb-8 -mx-2 sm:mx-0">
            <MovementCalendar
              companyId={selectedCompanyId}
              warehouseIds={Array.from(selectedWarehouseIds)}
              onDateSelect={(date) => setSelectedDate(date)}
            />
          </div>
        )}

        {/* Nuevas Estadísticas después del calendario */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Compras Totales */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "purchases", title: "Compras Totales" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">🛒 Compras Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold">
                  ${(stats.purchases?.totalAmount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {stats.purchases?.count || 0} compras
                </p>
              </CardContent>
            </Card>

            {/* Crédito Pendiente */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => {
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("creditsReferrer", "/dashboard/stats")
                }
                router.push("/dashboard/credits")
              }}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">💳 Crédito Pendiente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-orange-600">
                  ${(stats.sales?.pendingCredit || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Por cobrar
                </p>
              </CardContent>
            </Card>

            {/* Total Unidades Vendidas */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "units", title: "Unidades Vendidas" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">📦 Unidades Vendidas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-purple-600">
                  {(stats.sales?.totalQuantity || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  unidades
                </p>
              </CardContent>
            </Card>

            {/* Promedio de Venta */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "average", title: "Promedio de Venta" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">📊 Promedio de Venta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-indigo-600">
                  ${stats.sales?.count > 0 
                    ? Math.round(stats.sales.totalAmount / stats.sales.count).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    : "0"}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  por movimiento
                </p>
              </CardContent>
            </Card>

            {/* Flujo de Caja Neto */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "cashflow", title: "Flujo de Caja Neto" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">💵 Flujo de Caja Neto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-xl md:text-2xl font-bold ${
                  (stats.cashFlow?.netCashFlow || 0) >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  ${(stats.cashFlow?.netCashFlow || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Entradas - Salidas
                </p>
              </CardContent>
            </Card>

            {/* Total Movimientos */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "all", title: "Total Movimientos" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">🔄 Total Movimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-cyan-600">
                  {(stats.sales?.count || 0) + (stats.purchases?.count || 0)}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {stats.sales?.count || 0} ventas, {stats.purchases?.count || 0} compras
                </p>
              </CardContent>
            </Card>

            {/* Total Ventas Realizadas */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "sales", title: "Total Ventas" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">📈 Total Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-emerald-600">
                  {stats.sales?.count || 0}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  movimientos de venta
                </p>
              </CardContent>
            </Card>

            {/* Total Compras Realizadas */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "purchases", title: "Total Compras" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">🛍️ Total Compras</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-amber-600">
                  {stats.purchases?.count || 0}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  movimientos de compra
                </p>
              </CardContent>
            </Card>

            {/* Margen de Ganancia */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedStat({ type: "profit", title: "Margen de Ganancia" })}
            >
              <CardHeader>
                <CardTitle className="text-base md:text-lg">📉 Margen de Ganancia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl md:text-2xl font-bold text-teal-600">
                  {stats.profit?.margin?.toFixed(1) || "0.0"}%
                </p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  sobre ventas totales
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabla de Mejores Clientess */}
        {stats && stats.customers && stats.customers.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">🏆 Mejores Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-3 font-semibold">Cliente</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Ventas</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Ganancia</th>
                      <th className="text-right p-2 sm:p-3 font-semibold">Crédito Pend.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.customers.slice(0, 10).map((customer: any, idx: number) => (
                      <tr key={customer.customer?.id || idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 sm:p-3">
                          <div>
                            <p className="font-medium">{customer.customer?.name || "Sin nombre"}</p>
                            {customer.customer?.phone && (
                              <p className="text-xs text-muted-foreground">{customer.customer.phone}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-3 font-semibold">
                          ${(customer.totalAmount || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </td>
                        <td className="text-right p-2 sm:p-3 text-green-600">
                          ${(customer.totalProfit || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </td>
                        <td className="text-right p-2 sm:p-3 text-orange-600">
                          ${(customer.pendingCredits || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botón de atrás al final */}
        <div className="mt-8 flex justify-center">
          <BackButton href="/dashboard" />
        </div>
        </div>

        {/* Modal de detalles del día */}
        {selectedDate && selectedCompanyId && (
          <DayDetailsModal
            date={selectedDate}
            companyId={selectedCompanyId}
            onClose={() => setSelectedDate(null)}
          />
        )}

        {/* Modal de detalles de estadísticas */}
        {selectedStat && selectedCompanyId && stats?.dateRange && (
          <StatDetailsModal
            open={!!selectedStat}
            onClose={() => setSelectedStat(null)}
            title={selectedStat.title}
            companyId={selectedCompanyId}
            type={selectedStat.type as any}
            dateRange={stats.dateRange}
            warehouseIds={Array.from(selectedWarehouseIds)}
          />
        )}

        {/* Modal de detalles del producto */}
        {selectedProduct && selectedCompanyId && (
          <ProductDetailsModal
            open={!!selectedProduct}
            onClose={() => setSelectedProduct(null)}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            companyId={selectedCompanyId}
            warehouseIds={Array.from(selectedWarehouseIds)}
          />
        )}
    </div>
  )
}

