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

    // Obtener el movimiento original para verificar que existe
    const originalMovement = await prisma.movement.findUnique({
      where: { id: movementId },
      select: { movementNumber: true }
    })

    if (!originalMovement) {
      return NextResponse.json({ error: "Crédito no encontrado" }, { status: 404 })
    }

    // Buscar todos los abonos relacionados con este crédito
    // Los abonos tienen en las notas: "Abono a crédito {movementNumber}"
    const payments = await prisma.movement.findMany({
      where: {
        type: "sale",
        movementNumber: { startsWith: "ABO-" },
        notes: { contains: originalMovement.movementNumber }
      },
      select: {
        id: true,
        movementNumber: true,
        totalAmount: true,
        movementDate: true,
        notes: true
      },
      orderBy: { movementDate: "desc" }
    })

    return NextResponse.json({
      payments: payments.map(p => ({
        id: p.id,
        movementNumber: p.movementNumber,
        totalAmount: Number(p.totalAmount),
        movementDate: p.movementDate,
        notes: p.notes
      }))
    })
  } catch (error: any) {
    console.error("Error obteniendo historial de pagos:", error)
    return NextResponse.json(
      { error: error.message || "Error obteniendo historial de pagos" },
      { status: 500 }
    )
  }
}
