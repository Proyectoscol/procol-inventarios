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
    
    // Get user type to apply warehouse filtering for VENDEDOR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    // For VENDEDOR, filter by assigned warehouses
    if (user?.userType === "VENDEDOR") {
      // Get assigned warehouses for this VENDEDOR
      const assignedWarehouses = await prisma.warehouseAssignment.findMany({
        where: { userId: session.user.id },
        select: { warehouseId: true }
      })

      const assignedWarehouseIds = assignedWarehouses.map(wa => wa.warehouseId)

      if (assignedWarehouseIds.length === 0) {
        return NextResponse.json({ movements: [] })
      }

      whereClause.warehouseId = { in: assignedWarehouseIds }
    } else {
      // For MASTER and STORE_MANAGER, support existing warehouse filtering
      if (warehouseIds) {
        const ids = warehouseIds.split(",").filter(Boolean)
        if (ids.length > 0) {
          whereClause.warehouseId = { in: ids }
        }
      } else if (warehouseId) {
        whereClause.warehouseId = warehouseId
      }
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

    // Enrich transfer movements with target warehouse info
    const targetWarehouseIds = movements
      .filter(m => m.type === "transfer" && m.targetWarehouseId)
      .map(m => m.targetWarehouseId!)

    let targetWarehouseMap: Record<string, any> = {}
    if (targetWarehouseIds.length > 0) {
      const targetWarehouses = await prisma.warehouse.findMany({
        where: { id: { in: targetWarehouseIds } }
      })
      targetWarehouseMap = Object.fromEntries(targetWarehouses.map(w => [w.id, w]))
    }

    const enrichedMovements = movements.map(m => ({
      ...m,
      targetWarehouse: m.targetWarehouseId ? (targetWarehouseMap[m.targetWarehouseId] ?? null) : null
    }))

    // For VENDEDOR, remove profit field from movements
    const filteredMovements = user?.userType === "VENDEDOR"
      ? enrichedMovements.map(m => {
          const { profit, ...rest } = m
          return rest
        })
      : enrichedMovements

    return NextResponse.json({ movements: filteredMovements })
  } catch (error: any) {
    console.error("Error obteniendo movimientos:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

