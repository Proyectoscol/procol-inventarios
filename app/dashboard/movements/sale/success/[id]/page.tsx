"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Home, FileText, Download } from "lucide-react"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"

export default function SaleSuccessPage() {
  const router = useRouter()
  const params = useParams()
  const movementId = params.id as string
  const [saleData, setSaleData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (movementId) {
      fetchSaleData()
    }
  }, [movementId])

  const fetchSaleData = async () => {
    try {
      const res = await fetch(`/api/movements/sale/${movementId}/details`)
      if (res.ok) {
        const data = await res.json()
        setSaleData(data)
      } else {
        console.error("Error cargando datos de venta")
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPDF = () => {
    if (movementId) {
      window.open(`/api/movements/sale/${movementId}/invoice`, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!saleData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No se pudo cargar la información de la venta</p>
            <Button onClick={() => router.push("/dashboard")} className="mt-4">
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header de Éxito */}
        <Card className="mb-6 border-green-200 bg-white">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ¡Venta Registrada con Éxito!
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              La venta se ha registrado correctamente en el sistema
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <p className="text-sm text-muted-foreground">Número de Factura</p>
                <p className="text-xl font-bold text-blue-600">
                  {saleData.movements[0]?.movementNumber || "N/A"}
                </p>
              </div>
              <div className="bg-green-50 px-4 py-2 rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold text-green-600">
                  ${saleData.total.toLocaleString("es-CO")} COP
                </p>
              </div>
              <div className="bg-purple-50 px-4 py-2 rounded-lg">
                <p className="text-sm text-muted-foreground">Productos</p>
                <p className="text-xl font-bold text-purple-600">
                  {saleData.movements.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información de la Venta */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detalles de la Venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-semibold text-lg">
                  {saleData.customer?.name || "Sin cliente"}
                </p>
                {saleData.customer?.phone && (
                  <p className="text-sm text-muted-foreground">
                    📞 {saleData.customer.phone}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-semibold">
                  {new Date(saleData.movements[0]?.movementDate).toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo de Pago</p>
                <p className="font-semibold">
                  {saleData.movements[0]?.paymentType === "cash" ? "Contado" :
                   saleData.movements[0]?.paymentType === "credit" ? "Crédito" : "Mixto"}
                </p>
              </div>
              {saleData.movements[0]?.creditDays && (
                <div>
                  <p className="text-sm text-muted-foreground">Días de Crédito</p>
                  <p className="font-semibold">{saleData.movements[0].creditDays} días</p>
                </div>
              )}
            </div>

            {/* Productos */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-muted-foreground mb-3">Productos Vendidos</p>
              <div className="space-y-2">
                {saleData.movements.map((movement: any, idx: number) => (
                  <div key={movement.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{movement.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {movement.warehouse.name} • {movement.quantity} x ${Number(movement.unitPrice).toLocaleString("es-CO")}
                      </p>
                    </div>
                    <p className="font-semibold text-lg">
                      ${Number(movement.totalAmount).toLocaleString("es-CO")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Subtotal:</span>
                <span>${saleData.subtotal.toLocaleString("es-CO")} COP</span>
              </div>
              {saleData.shippingCost > 0 && (
                <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                  <span>Envío:</span>
                  <span>${saleData.shippingCost.toLocaleString("es-CO")} COP</span>
                </div>
              )}
              <div className="flex justify-between items-center text-2xl font-bold mt-4 text-green-600">
                <span>Total:</span>
                <span>${saleData.total.toLocaleString("es-CO")} COP</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={() => router.push("/dashboard")}
            variant="outline"
            className="flex-1"
            size="lg"
          >
            <Home className="h-5 w-5 mr-2" />
            Volver al Dashboard
          </Button>
          <Button
            onClick={handleViewPDF}
            className="flex-1 bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <FileText className="h-5 w-5 mr-2" />
            Ver Factura PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
