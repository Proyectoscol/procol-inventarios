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
    const warehouseId = searchParams.get("warehouseId")
    const productId = params.id

    if (!warehouseId) {
      return NextResponse.json({ error: "warehouseId requerido" }, { status: 400 })
    }

    // Buscar el último movimiento de venta para este producto en esta bodega
    const lastSale = await prisma.movement.findFirst({
      where: {
        productId,
        warehouseId,
        type: "sale"
      },
      orderBy: {
        movementDate: "desc"
      },
      select: {
        unitPrice: true,
        movementDate: true,
        quantity: true,
        totalAmount: true
      }
    })

    if (!lastSale) {
      return NextResponse.json({ 
        lastSale: null,
        lastSalePrice: null,
        lastSaleDate: null,
        lastSaleQuantity: null
      })
    }

    return NextResponse.json({
      lastSale: true,
      lastSalePrice: Number(lastSale.unitPrice),
      lastSaleDate: lastSale.movementDate,
      lastSaleQuantity: lastSale.quantity,
      lastSaleTotal: Number(lastSale.totalAmount)
    })
  } catch (error: any) {
    console.error("Error obteniendo última venta:", error)
    return NextResponse.json(
      { error: error.message || "Error obteniendo última venta" },
      { status: 500 }
    )
  }
}
