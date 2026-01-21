"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, DollarSign, Calendar, Clock, CheckCircle } from "lucide-react"
import { CurrencyInput } from "@/components/shared/CurrencyInput"
import { useRef } from "react"
import { formatColombiaDate } from "@/lib/date-utils"
import { toast } from "sonner"

interface CreditPaymentModalProps {
  open: boolean
  onClose: () => void
  credit: {
    id: string
    movementNumber: string
    customer?: { name: string; phone?: string } | null
    product?: { name: string } | null
    warehouse?: { name: string } | null
    creditAmount: number
    cashAmount: number | null
    totalAmount: number
    creditDueDate: Date | null
    creditDays?: number | null
  }
  onSuccess: () => void
  initialPaymentType?: "full" | "partial" // Tipo de pago inicial
}

export function CreditPaymentModal({
  open,
  onClose,
  credit,
  onSuccess,
  initialPaymentType = "full"
}: CreditPaymentModalProps) {
  const [paymentType, setPaymentType] = useState<"full" | "partial">(initialPaymentType)
  const [paymentAmount, setPaymentAmount] = useState<number>(0)
  const [renewCredit, setRenewCredit] = useState(false)
  const [newCreditDays, setNewCreditDays] = useState<number>(15)
  const [customCreditDays, setCustomCreditDays] = useState<string>("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Calcular saldo pendiente
  const originalCredit = credit.creditAmount
  const totalPaid = credit.cashAmount || 0
  const pendingBalance = originalCredit - totalPaid

  useEffect(() => {
    if (open && credit.id) {
      // Actualizar tipo de pago cuando se abre el modal
      setPaymentType(initialPaymentType)
      fetchPaymentHistory()
    }
  }, [open, credit.id, initialPaymentType])

  useEffect(() => {
    // Inicializar monto según el tipo de pago
    if (open) {
      if (paymentType === "full") {
        setPaymentAmount(pendingBalance)
      } else {
        setPaymentAmount(0)
        // Enfocar el campo de monto después de un pequeño delay para abono parcial
        setTimeout(() => {
          if (amountInputRef.current) {
            amountInputRef.current.focus()
            amountInputRef.current.select()
          }
        }, 150)
      }
    }
  }, [open, paymentType, pendingBalance])

  const fetchPaymentHistory = async () => {
    try {
      setLoadingHistory(true)
      const res = await fetch(`/api/credits/${credit.id}/payments`)
      if (res.ok) {
        const data = await res.json()
        setPaymentHistory(data.payments || [])
      }
    } catch (error) {
      console.error("Error cargando historial:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handlePaymentTypeChange = (type: "full" | "partial") => {
    setPaymentType(type)
    if (type === "full") {
      setPaymentAmount(pendingBalance)
    } else {
      setPaymentAmount(0)
      // Enfocar el campo de monto cuando cambia a abono parcial
      setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus()
          amountInputRef.current.select()
        }
      }, 100)
    }
  }

  const handleAmountChange = (value: number) => {
    if (value > pendingBalance) {
      toast.error("El monto no puede ser mayor al saldo pendiente")
      setPaymentAmount(pendingBalance)
      return
    }
    setPaymentAmount(value)
  }

  const calculateNewDueDate = (days: number) => {
    const today = new Date()
    today.setDate(today.getDate() + days)
    return today
  }

  const handleSubmit = async () => {
    if (paymentAmount <= 0) {
      toast.error("El monto del pago debe ser mayor a 0")
      return
    }

    if (paymentAmount > pendingBalance) {
      toast.error("El monto no puede ser mayor al saldo pendiente")
      return
    }

    if (paymentType === "partial" && renewCredit && !newCreditDays) {
      toast.error("Debes especificar los días del nuevo plazo")
      return
    }

    setLoading(true)
    try {
      const newDueDate = renewCredit && paymentType === "partial" && newCreditDays > 0
        ? calculateNewDueDate(newCreditDays).toISOString()
        : undefined

      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movementId: credit.id,
          paymentAmount,
          newDueDate,
          newCreditDays: renewCredit && paymentType === "partial" && newCreditDays > 0 ? newCreditDays : undefined,
          notes: notes.trim() || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error al registrar pago")
      }

      const result = await res.json()
      
      toast.success(
        paymentType === "full" 
          ? "✅ Pago completo registrado exitosamente"
          : "✅ Abono registrado exitosamente",
        {
          description: paymentType === "partial"
            ? `Abono de $${paymentAmount.toLocaleString("es-CO")}. Saldo restante: $${result.remainingCredit.toLocaleString("es-CO")}`
            : `Crédito pagado completamente`,
          duration: 4000
        }
      )

      onSuccess()
      onClose()
      
      // Resetear formulario
      setPaymentType(initialPaymentType)
      setPaymentAmount(0)
      setRenewCredit(false)
      setNewCreditDays(15)
      setCustomCreditDays("")
      setNotes("")
    } catch (error: any) {
      toast.error("❌ Error al registrar pago", {
        description: error.message || "Por favor, intenta nuevamente",
        duration: 4000
      })
    } finally {
      setLoading(false)
    }
  }

  // Resetear cuando se cierra el modal
  useEffect(() => {
    if (!open) {
      setPaymentType(initialPaymentType)
      setPaymentAmount(0)
      setRenewCredit(false)
      setNewCreditDays(15)
      setCustomCreditDays("")
      setNotes("")
    }
  }, [open, initialPaymentType])

  if (!open) return null

  const remainingAfterPayment = pendingBalance - paymentAmount
  const newDueDatePreview = renewCredit && newCreditDays > 0
    ? calculateNewDueDate(newCreditDays)
    : null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Registrar Pago - {credit.movementNumber}
            </CardTitle>
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
          {/* Información del crédito */}
          <div className="mb-6 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Cliente:</span>
                <p className="font-semibold">{credit.customer?.name || "Sin cliente"}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Producto:</span>
                <p className="font-semibold">{credit.product?.name || "N/A"}</p>
              </div>
              {credit.warehouse && (
                <div>
                  <span className="font-medium text-muted-foreground">Bodega:</span>
                  <p className="font-semibold">{credit.warehouse.name}</p>
                </div>
              )}
              {credit.creditDueDate && (
                <div>
                  <span className="font-medium text-muted-foreground">Vence:</span>
                  <p className="font-semibold">{formatColombiaDate(credit.creditDueDate)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Resumen de deuda */}
          <div className="bg-muted rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Deuda Original:</span>
              <span className="font-semibold">${originalCredit.toLocaleString("es-CO")}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Abonado:</span>
              <span className="font-semibold text-green-600">${totalPaid.toLocaleString("es-CO")}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-base font-semibold">Saldo Pendiente:</span>
              <span className="text-lg font-bold text-orange-600">${pendingBalance.toLocaleString("es-CO")}</span>
            </div>
          </div>

          {/* Tipo de pago */}
          <div className="mb-6">
            <Label className="mb-3 block text-base font-semibold">Tipo de Pago</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={paymentType === "full" ? "default" : "outline"}
                className={`h-16 flex flex-col items-center justify-center gap-1 ${
                  paymentType === "full" ? "bg-primary text-white" : ""
                }`}
                onClick={() => handlePaymentTypeChange("full")}
              >
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Pago Total</span>
                <span className="text-xs opacity-90">${pendingBalance.toLocaleString("es-CO")}</span>
              </Button>
              <Button
                type="button"
                variant={paymentType === "partial" ? "default" : "outline"}
                className={`h-16 flex flex-col items-center justify-center gap-1 ${
                  paymentType === "partial" ? "bg-primary text-white" : ""
                }`}
                onClick={() => handlePaymentTypeChange("partial")}
              >
                <DollarSign className="h-5 w-5" />
                <span className="font-semibold">Abono Parcial</span>
                <span className="text-xs opacity-90">Monto personalizado</span>
              </Button>
            </div>
          </div>

          {/* Monto del pago */}
          <div className="mb-6">
            <Label className="mb-2 block">
              {paymentType === "full" ? "Monto del Pago" : "Monto del Abono"}
            </Label>
            <CurrencyInput
              ref={amountInputRef}
              value={paymentAmount}
              onChange={handleAmountChange}
              placeholder={paymentType === "partial" ? pendingBalance.toLocaleString("es-CO") : "0"}
              disabled={paymentType === "full"}
            />
            {paymentType === "partial" && paymentAmount > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Saldo restante después del abono: <span className="font-semibold text-orange-600">
                  ${remainingAfterPayment.toLocaleString("es-CO")}
                </span>
              </p>
            )}
          </div>

          {/* Renovar plazo (solo para abonos parciales) */}
          {paymentType === "partial" && remainingAfterPayment > 0 && (
            <div className="mb-6 space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="renewCredit"
                  checked={renewCredit}
                  onChange={(e) => setRenewCredit(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="renewCredit" className="font-semibold cursor-pointer">
                  Renovar plazo del saldo restante
                </Label>
              </div>

              {renewCredit && (
                <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                  <div>
                    <Label className="mb-2 block">Nuevo Plazo</Label>
                    <div className="flex gap-2 mb-2">
                      {[5, 15, 20, 30].map((days) => (
                        <Button
                          key={days}
                          type="button"
                          variant={newCreditDays === days ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setNewCreditDays(days)
                            setCustomCreditDays("")
                          }}
                        >
                          {days} días
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant={customCreditDays ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setCustomCreditDays(newCreditDays.toString())
                        }}
                      >
                        Otro
                      </Button>
                    </div>
                    {customCreditDays && (
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ej: 45"
                        value={customCreditDays}
                        onChange={(e) => {
                          setCustomCreditDays(e.target.value)
                          const days = parseInt(e.target.value)
                          if (days > 0) {
                            setNewCreditDays(days)
                          }
                        }}
                        className="mt-2"
                      />
                    )}
                  </div>
                  {newDueDatePreview && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-blue-600" />
                        <span className="text-muted-foreground">Nueva fecha de vencimiento:</span>
                        <span className="font-semibold text-blue-700">
                          {formatColombiaDate(newDueDatePreview)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="mb-6">
            <Label htmlFor="notes" className="mb-2 block">
              Notas (opcional)
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Cliente abonó y acordó pagar el resto en 15 días"
              rows={3}
              className="w-full border rounded-md p-2 text-base resize-none"
            />
          </div>

          {/* Historial de abonos */}
          {paymentHistory.length > 0 && (
            <div className="mb-6">
              <Label className="mb-3 block text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Historial de Abonos
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {loadingHistory ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
                ) : (
                  paymentHistory.map((payment, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center p-2 bg-muted rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {payment.movementNumber}
                        </span>
                        <span className="text-muted-foreground">
                          {formatColombiaDate(new Date(payment.movementDate))}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-green-600">
                          ${Number(payment.totalAmount).toLocaleString("es-CO")}
                        </span>
                        {payment.notes && (
                          <span className="text-xs text-muted-foreground max-w-xs truncate">
                            {payment.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
        <div className="flex-shrink-0 border-t p-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || paymentAmount <= 0}>
            {loading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {paymentType === "full" ? "Registrar Pago Completo" : "Registrar Abono"}
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
