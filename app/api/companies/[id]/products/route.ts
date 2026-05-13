import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Desactivar caché para asegurar datos frescos en todos los dispositivos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""

    const where: any = {
      companyId: params.id,
      deletedAt: null // Solo productos activos (no eliminados)
    }

    if (q) {
      where.nameLower = {
        contains: q.toLowerCase()
      }
    }

    // Get user type to apply warehouse filtering for VENDEDOR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    let products = await prisma.product.findMany({
      where,
      include: {
        stock: {
          include: {
            warehouse: true
          }
        }
      },
      orderBy: {
        name: "asc"
      }
    })

    // For VENDEDOR, filter products to only those in their assigned warehouses
    if (user?.userType === "VENDEDOR") {
      // Get assigned warehouses for this VENDEDOR
      const assignedWarehouses = await prisma.warehouseAssignment.findMany({
        where: { userId: session.user.id },
        select: { warehouseId: true }
      })

      const assignedWarehouseIds = assignedWarehouses.map(wa => wa.warehouseId)

      if (assignedWarehouseIds.length === 0) {
        return NextResponse.json([])
      }

      // Devuelve todos los productos de la compañía, pero limita stock[]
      // a las bodegas asignadas al vendedor (qty=0 aparece como "Sin stock" en el frontend)
      products = products.map(product => ({
        ...product,
        stock: product.stock.filter(s => assignedWarehouseIds.includes(s.warehouseId))
      }))
    }

    return NextResponse.json(products)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

