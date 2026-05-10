import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    // Only VENDEDOR users get warehouse assignments
    if (user?.userType !== "VENDEDOR") {
      return NextResponse.json({ error: "Solo VENDEDOR puede acceder a esto" }, { status: 403 })
    }

    // Fetch all warehouses assigned to this VENDEDOR
    const warehouseAssignments = await prisma.warehouseAssignment.findMany({
      where: { userId: session.user.id },
      select: {
        warehouse: {
          select: {
            id: true,
            name: true,
            description: true,
            companyId: true
          }
        }
      }
    })

    const warehouses = warehouseAssignments.map(wa => wa.warehouse)

    return NextResponse.json({ 
      success: true,
      warehouses: warehouses,
      count: warehouses.length
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al obtener bodegas" },
      { status: 500 }
    )
  }
}
