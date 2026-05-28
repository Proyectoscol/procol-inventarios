"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { ArrowRight, ArrowRightLeft, Package, Warehouse, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface Warehouse {
  id: string
  name: string
}

interface TransferModalProps {
  product: { id: string; name: string }
  sourceWarehouse: Warehouse
  sourceStock: number
  warehouses: Warehouse[]
  companyId: string
  onSuccess: () => void
  onClose: () => void
}

export function TransferModal({
  product,
  sourceWarehouse,
  sourceStock,
  warehouses,
  companyId,
  onSuccess,
  onClose
}: TransferModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [targetWarehouseId, setTargetWarehouseId] = useState("")
  const [quantity, setQuantity] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const availableTargets = warehouses.filter((w) => w.id !== sourceWarehouse.id)
  const targetWarehouse = availableTargets.find((w) => w.id === targetWarehouseId)
  const qty = parseInt(quantity) || 0

  const canProceed =
    targetWarehouseId !== "" &&
    qty >= 1 &&
    qty <= sourceStock

  const handleConfirm = async () => {
    if (!canProceed) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/movements/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          sourceWarehouseId: sourceWarehouse.id,
          targetWarehouseId,
          quantity: qty,
          companyId,
          notes: notes.trim() || null
        })
      })

      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error || "Error al realizar la transferencia")
        return
      }

      toast.success(
        `Transferencia completada: ${qty} unidades de "${product.name}" trasladadas a ${targetWarehouse?.name}`,
        { duration: 4000 }
      )
      onSuccess()
    } catch (err) {
      toast.error("Error de red al realizar la transferencia")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Transferir inventario</h2>
            <p className="text-sm text-muted-foreground">
              Paso {step} de 2 — {step === 1 ? "Configurar" : "Confirmar"}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>

        {/* Step 1: Configurar */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            {/* Bodega origen (readonly) */}
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Warehouse className="h-4 w-4" />
                <span>Bodega origen</span>
              </div>
              <p className="font-semibold">{sourceWarehouse.name}</p>
            </div>

            {/* Producto (readonly) */}
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span>Producto</span>
              </div>
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Stock disponible:{" "}
                <span className="font-medium text-foreground">{sourceStock} unidades</span>
              </p>
            </div>

            {/* Bodega destino */}
            <div className="space-y-1.5">
              <Label htmlFor="targetWarehouse">Bodega destino</Label>
              <Select
                id="targetWarehouse"
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
              >
                <option value="">Seleccionar bodega destino...</option>
                {availableTargets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
              {availableTargets.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No hay otras bodegas disponibles en esta compañía.
                </p>
              )}
            </div>

            {/* Cantidad */}
            <div className="space-y-1.5">
              <Label htmlFor="quantity">
                Cantidad a transferir
                <span className="text-muted-foreground font-normal ml-1">
                  (máx. {sourceStock})
                </span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={sourceStock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
              {qty > sourceStock && (
                <p className="text-sm text-red-500">
                  No puedes transferir más de {sourceStock} unidades disponibles.
                </p>
              )}
            </div>

            {/* Notas opcionales */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Notas{" "}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Traslado por demanda en tienda principal"
                maxLength={200}
              />
            </div>
          </div>
        )}

        {/* Step 2: Confirmar */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <p className="text-sm text-muted-foreground">
              Revisa los detalles antes de confirmar la transferencia.
            </p>

            {/* Resumen visual */}
            <div className="rounded-lg border p-4 space-y-4">
              {/* Producto */}
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Producto:</span>
                <span className="font-semibold">{product.name}</span>
              </div>

              {/* Flujo de bodegas */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 rounded-lg bg-orange-50 border border-orange-200 p-3 text-center">
                  <p className="text-xs text-orange-600 font-medium mb-1">ORIGEN</p>
                  <p className="font-semibold text-sm">{sourceWarehouse.name}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium mb-1">DESTINO</p>
                  <p className="font-semibold text-sm">{targetWarehouse?.name}</p>
                </div>
              </div>

              {/* Cantidad */}
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold">{qty}</p>
                <p className="text-sm text-muted-foreground">unidades a transferir</p>
              </div>

              {/* Stock antes/después */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs mb-1">{sourceWarehouse.name} después</p>
                  <p>
                    <span className="line-through text-muted-foreground">{sourceStock}</span>
                    {" → "}
                    <span className="font-bold text-orange-600">{sourceStock - qty}</span>
                    <span className="text-muted-foreground ml-1">uds.</span>
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs mb-1">{targetWarehouse?.name} después</p>
                  <p>
                    <span className="font-bold text-blue-600">+{qty}</span>
                    <span className="text-muted-foreground ml-1">uds. nuevas</span>
                  </p>
                </div>
              </div>

              {notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notas: </span>
                  <span>{notes}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
              Esta operación no genera ingresos ni egresos financieros. Solo mueve stock entre bodegas.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between gap-3 p-6 border-t">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className="gap-2"
              >
                Revisar transferencia
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>
                Atrás
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? (
                  "Transfiriendo..."
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirmar transferencia
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
