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
    const type = searchParams.get("type")
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
      product: { companyId }
    }
    
    if (type) whereClause.type = type
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
    
    const movements = await prisma.movement.findMany({
      where: whereClause,
      include: {
        product: true,
        warehouse: true,
        customer: true,
        batch: true
      },
      orderBy: { movementDate: "desc" }
    })
    
    return NextResponse.json({ movements })
  } catch (error: any) {
    console.error("Error obteniendo movimientos:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

