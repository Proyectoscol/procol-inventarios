import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const movementId = params.id

    // Obtener el movimiento inicial
    const initialMovement = await prisma.movement.findUnique({
      where: { id: movementId },
      include: {
        customer: true,
        product: true,
        warehouse: true
      }
    })

    if (!initialMovement) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
    }

    // Buscar todos los movimientos relacionados (mismo cliente, misma fecha, mismo tipo de pago)
    // Agrupar por cliente y fecha (mismo minuto)
    const movementDate = new Date(initialMovement.movementDate)
    const startDate = new Date(movementDate)
    startDate.setSeconds(0, 0)
    const endDate = new Date(movementDate)
    endDate.setSeconds(59, 999)

    const relatedMovements = await prisma.movement.findMany({
      where: {
        customerId: initialMovement.customerId,
        movementDate: {
          gte: startDate,
          lte: endDate
        },
        paymentType: initialMovement.paymentType,
        type: "sale"
      },
      include: {
        product: true,
        warehouse: true,
        customer: true
      },
      orderBy: {
        movementDate: "asc"
      }
    })

    // Calcular totales
    const subtotal = relatedMovements.reduce((sum, m) => sum + Number(m.totalAmount), 0)
    const shippingCost = relatedMovements.reduce((sum, m) => sum + Number(m.shippingCost || 0), 0)
    const total = subtotal + shippingCost

    return NextResponse.json({
      movements: relatedMovements,
      customer: initialMovement.customer,
      subtotal,
      shippingCost,
      total,
      paymentType: initialMovement.paymentType,
      creditDays: initialMovement.creditDays,
      creditDueDate: initialMovement.creditDueDate
    })
  } catch (error: any) {
    console.error("Error obteniendo detalles de venta:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
