import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

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
    const warehouseIds = searchParams.get("warehouseIds")
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId requerido" }, { status: 400 })
    }
    
    const whereClause: any = {
      type: "sale",
      product: { 
        companyId,
        deletedAt: null // Solo productos activos
      }
    }
    
    if (from && to) {
      whereClause.movementDate = {
        gte: new Date(from),
        lte: new Date(to)
      }
    }
    
    // Filtrar por bodegas si se proporcionan
    if (warehouseIds) {
      const ids = warehouseIds.split(",").filter(Boolean)
      if (ids.length > 0) {
        whereClause.warehouseId = { in: ids }
      }
    }
    
    // Top productos por cantidad vendida
    const topProducts = await prisma.movement.groupBy({
      by: ["productId"],
      where: whereClause,
      _sum: {
        quantity: true,
        totalAmount: true
      },
      orderBy: {
        _sum: {
          quantity: "desc"
        }
      },
      take: 5
    })
    
    // Enriquecer con datos del producto, stock actual y último precio de compra
    const enrichedTop = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findFirst({
          where: { 
            id: item.productId,
            deletedAt: null
          },
          include: {
            stock: {
              include: {
                warehouse: true
              }
            }
          }
        })
        
        if (!product) {
          return null
        }
        
        // Calcular stock total en todas las bodegas
        const totalStock = product.stock.reduce((sum, s) => sum + s.quantity, 0)
        
        // Obtener último precio de compra (de cualquier bodega, o específico si es necesario)
        const lastPurchase = await prisma.movement.findFirst({
          where: {
            productId: item.productId,
            type: "purchase"
          },
          orderBy: {
            movementDate: "desc"
          },
          select: {
            unitPrice: true,
            movementDate: true,
            warehouseId: true
          }
        })
        
        return {
          productId: item.productId,
          productName: product.name,
          totalSold: item._sum.quantity || 0,
          totalRevenue: Number(item._sum.totalAmount || 0),
          currentStock: totalStock,
          lastPurchasePrice: lastPurchase ? Number(lastPurchase.unitPrice) : null,
          lastPurchaseDate: lastPurchase?.movementDate || null
        }
      })
    )
    
    // Filtrar nulls y ordenar por cantidad vendida
    const filteredTop = enrichedTop
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.totalSold - a.totalSold)
    
    return NextResponse.json({
      topProducts: filteredTop
    })
  } catch (error: any) {
    console.error("Error obteniendo top productos por ventas:", error)
    return NextResponse.json(
      { error: error.message || "Error obteniendo top productos" },
      { status: 500 }
    )
  }
}
