import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Desactivar caché para asegurar datos frescos en todos los dispositivos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get("companyId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const warehouseId = searchParams.get("warehouseId")
    const warehouseIds = searchParams.get("warehouseIds")
    const productId = searchParams.get("productId")
    const customerId = searchParams.get("customerId")
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId requerido" }, { status: 400 })
    }
    
    const whereClause: any = {
      type: "sale",
      product: { companyId }
    }
    
    if (from && to) {
      whereClause.movementDate = {
        gte: new Date(from),
        lte: new Date(to)
      }
    }
    
    // Soporte para múltiples bodegas (nuevo) o una sola bodega (legacy)
    if (warehouseIds) {
      const ids = warehouseIds.split(",").filter(Boolean)
      if (ids.length > 0) {
        whereClause.warehouseId = { in: ids }
      }
    } else if (warehouseId) {
      whereClause.warehouseId = warehouseId
    }
    
    if (productId) whereClause.productId = productId
    if (customerId) whereClause.customerId = customerId
    
    // Obtener movimientos
    const movements = await prisma.movement.findMany({
      where: whereClause,
      include: {
        product: true,
        warehouse: true,
        customer: true
      },
      orderBy: { movementDate: "desc" }
    })
    
    // Agregaciones
    const totals = await prisma.movement.aggregate({
      where: whereClause,
      _sum: {
        totalAmount: true,
        cashAmount: true,
        creditAmount: true,
        profit: true,
        quantity: true
      },
      _count: true
    })
    
    // Calcular contado correctamente - INCLUYE créditos pagados
    const calculatedCashAmount = movements.reduce((sum, m) => {
      if (m.paymentType === "cash") {
        // Ventas en contado: usar cashAmount o totalAmount
        return sum + Number(m.cashAmount ?? m.totalAmount)
      } else if (m.paymentType === "mixed") {
        // Ventas mixtas: usar cashAmount (incluye crédito pagado si aplica)
        return sum + Number(m.cashAmount ?? 0)
      } else if (m.paymentType === "credit") {
        // Ventas a crédito: solo sumar si el crédito fue pagado
        if (m.creditPaid) {
          return sum + Number(m.cashAmount || 0)
        }
      }
      return sum
    }, 0)
    
    // Calcular crédito correctamente basándose en paymentType
    const calculatedCreditAmount = movements.reduce((sum, m) => {
      if (m.paymentType === "credit") {
        // Si es crédito, usar creditAmount si existe, sino usar totalAmount
        return sum + Number(m.creditAmount ?? m.totalAmount)
      } else if (m.paymentType === "mixed") {
        // Si es mixto, usar creditAmount (debe estar guardado)
        return sum + Number(m.creditAmount ?? 0)
      }
      // Si es contado, no sumar nada a crédito
      return sum
    }, 0)
    
    // Créditos pendientes (solo los que NO han sido pagados - creditPaid = false)
    // NO incluir créditos vencidos automáticamente, solo cuando se marquen como pagados
    const pendingCredit = movements
      .filter(m => !m.creditPaid && (m.paymentType === "credit" || m.paymentType === "mixed"))
      .reduce((sum, m) => {
        if (m.paymentType === "credit") {
          // Si es crédito puro, usar creditAmount si existe, sino usar totalAmount
          return sum + Number(m.creditAmount ?? m.totalAmount)
        } else if (m.paymentType === "mixed") {
          // Si es mixto, usar creditAmount (debe estar guardado)
          return sum + Number(m.creditAmount ?? 0)
        }
        return sum
      }, 0)
    
    // Ventas por día (simplificado)
    const byDayMap = new Map<string, number>()
    movements.forEach(m => {
      const date = m.movementDate.toISOString().split("T")[0]
      byDayMap.set(date, (byDayMap.get(date) || 0) + Number(m.totalAmount))
    })
    
    const byDay = Array.from(byDayMap.entries()).map(([date, amount]) => ({
      date,
      amount
    })).sort((a, b) => a.date.localeCompare(b.date))
    
    return NextResponse.json({
      movements,
      totalAmount: Number(totals._sum.totalAmount || 0),
      cashAmount: calculatedCashAmount, // Usar cálculo manual
      creditAmount: calculatedCreditAmount, // Usar cálculo manual
      pendingCredit: pendingCredit, // Usar cálculo manual
      totalQuantity: totals._sum.quantity || 0,
      count: totals._count,
      byDay
    })
  } catch (error: any) {
    console.error("Error en reporte de ventas:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

