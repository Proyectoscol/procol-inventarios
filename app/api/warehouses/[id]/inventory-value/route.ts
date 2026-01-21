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

    const warehouseId = params.id

    // Obtener todos los productos con stock en esta bodega
    const stockItems = await prisma.stock.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Para cada producto, obtener el último precio de compra en esta bodega
    let totalValue = 0
    const productValues: Array<{ productId: string; productName: string; quantity: number; unitCost: number; totalValue: number }> = []

    for (const stockItem of stockItems) {
      // Buscar el último movimiento de compra para este producto en esta bodega
      const lastPurchase = await prisma.movement.findFirst({
        where: {
          productId: stockItem.productId,
          warehouseId,
          type: "purchase"
        },
        orderBy: {
          movementDate: "desc"
        },
        select: {
          unitPrice: true
        }
      })

      // Si hay último precio de compra, usar ese. Si no, usar 0 (no se puede calcular valor)
      const unitCost = lastPurchase ? Number(lastPurchase.unitPrice) : 0
      const productValue = stockItem.quantity * unitCost
      totalValue += productValue

      if (unitCost > 0) {
        productValues.push({
          productId: stockItem.productId,
          productName: stockItem.product.name,
          quantity: stockItem.quantity,
          unitCost,
          totalValue: productValue
        })
      }
    }

    return NextResponse.json({
      warehouseId,
      totalValue,
      totalItems: stockItems.length,
      productValues
    })
  } catch (error: any) {
    console.error("Error calculando valor del inventario:", error)
    return NextResponse.json(
      { error: error.message || "Error calculando valor del inventario" },
      { status: 500 }
    )
  }
}
