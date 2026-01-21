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

    const companyId = params.id

    // Obtener todos los clientes de la compañía
    const customers = await prisma.customer.findMany({
      where: {
        companyId
      }
    })

    // Enriquecer cada cliente con estadísticas
    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        // Obtener todos los movimientos de venta del cliente
        const movements = await prisma.movement.findMany({
          where: {
            customerId: customer.id,
            type: "sale",
            product: { companyId }
          },
          orderBy: {
            movementDate: "desc"
          },
          select: {
            totalAmount: true,
            cashAmount: true,
            creditAmount: true,
            creditPaid: true,
            paymentType: true,
            movementDate: true
          }
        })

        // Calcular ingresos totales (valor histórico)
        const totalRevenue = movements.reduce((sum, m) => sum + Number(m.totalAmount || 0), 0)

        // Calcular crédito pendiente (considerando abonos parciales)
        // El crédito pendiente es el creditAmount actual (que se reduce con cada abono)
        const pendingCredit = movements
          .filter(m => !m.creditPaid && (m.paymentType === "credit" || m.paymentType === "mixed"))
          .reduce((sum, m) => {
            if (m.paymentType === "credit") {
              // Para crédito puro: usar creditAmount si existe, sino usar totalAmount
              // creditAmount puede ser null inicialmente, pero después de abonos siempre tiene valor
              return sum + Number(m.creditAmount ?? m.totalAmount ?? 0)
            } else if (m.paymentType === "mixed") {
              // Para mixto: siempre usar creditAmount (debe estar guardado)
              return sum + Number(m.creditAmount ?? 0)
            }
            return sum
          }, 0)

        // Obtener fecha del último movimiento
        const lastMovementDate = movements.length > 0 ? movements[0].movementDate : null

        return {
          ...customer,
          totalRevenue,
          pendingCredit,
          lastMovementDate,
          totalMovements: movements.length
        }
      })
    )

    return NextResponse.json(enrichedCustomers)
  } catch (error: any) {
    console.error("Error obteniendo clientes enriquecidos:", error)
    return NextResponse.json(
      { error: error.message || "Error obteniendo clientes" },
      { status: 500 }
    )
  }
}
