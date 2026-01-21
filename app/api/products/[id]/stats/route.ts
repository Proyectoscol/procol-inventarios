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

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get("companyId")
    const warehouseIds = searchParams.get("warehouseIds")
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId requerido" }, { status: 400 })
    }

    const productId = params.id

    // Obtener información del producto
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        companyId: companyId,
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
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    // Construir filtros para movimientos
    const baseWhereClause: any = {
      productId: productId,
      product: { companyId }
    }

    // Filtrar por bodegas si se proporcionan
    if (warehouseIds) {
      const ids = warehouseIds.split(",").filter(Boolean)
      if (ids.length > 0) {
        baseWhereClause.warehouseId = { in: ids }
      }
    }

    // Estadísticas de ventas
    const salesWhere = { ...baseWhereClause, type: "sale" }
    
    const salesStats = await prisma.movement.aggregate({
      where: salesWhere,
      _sum: {
        quantity: true,
        totalAmount: true,
        profit: true
      },
      _count: true,
      _avg: {
        unitPrice: true
      }
    })

    // Estadísticas de compras
    const purchasesWhere = { ...baseWhereClause, type: "purchase" }
    
    const purchasesStats = await prisma.movement.aggregate({
      where: purchasesWhere,
      _sum: {
        quantity: true,
        totalAmount: true
      },
      _count: true,
      _avg: {
        unitPrice: true
      }
    })

    // Obtener todos los movimientos de venta con clientes
    const salesMovements = await prisma.movement.findMany({
      where: salesWhere,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        warehouse: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        movementDate: "desc"
      },
      take: 100 // Limitar a los últimos 100 movimientos
    })

    // Agrupar clientes que compran este producto
    const customerMap = new Map<string, {
      customer: any,
      totalPurchases: number,
      totalAmount: number,
      totalQuantity: number,
      lastPurchaseDate: Date | null
    }>()

    salesMovements.forEach(movement => {
      if (movement.customer) {
        const customerId = movement.customer.id
        const existing = customerMap.get(customerId) || {
          customer: movement.customer,
          totalPurchases: 0,
          totalAmount: 0,
          totalQuantity: 0,
          lastPurchaseDate: null
        }
        
        existing.totalPurchases += 1
        existing.totalAmount += Number(movement.totalAmount || 0)
        existing.totalQuantity += Number(movement.quantity || 0)
        
        if (!existing.lastPurchaseDate || movement.movementDate > existing.lastPurchaseDate) {
          existing.lastPurchaseDate = movement.movementDate
        }
        
        customerMap.set(customerId, existing)
      }
    })

    const customers = Array.from(customerMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // Obtener compras recientes
    const purchasesMovements = await prisma.movement.findMany({
      where: purchasesWhere,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true
          }
        },
        batch: {
          select: {
            id: true,
            batchNumber: true
          }
        }
      },
      orderBy: {
        movementDate: "desc"
      },
      take: 50 // Limitar a las últimas 50 compras
    })

    // Calcular stock total y por bodega
    let totalStock = 0
    const stockByWarehouse = product.stock.map(s => {
      totalStock += s.quantity
      return {
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        quantity: s.quantity
      }
    })

    // Última venta
    const lastSale = await prisma.movement.findFirst({
      where: salesWhere,
      orderBy: {
        movementDate: "desc"
      },
      include: {
        customer: {
          select: {
            name: true
          }
        }
      }
    })

    // Última compra
    const lastPurchase = await prisma.movement.findFirst({
      where: purchasesWhere,
      orderBy: {
        movementDate: "desc"
      },
      include: {
        warehouse: {
          select: {
            name: true
          }
        }
      }
    })

    // Precio promedio de venta
    const avgSalePrice = salesStats._avg.unitPrice ? Number(salesStats._avg.unitPrice) : 0
    
    // Precio promedio de compra
    const avgPurchasePrice = purchasesStats._avg.unitPrice ? Number(purchasesStats._avg.unitPrice) : 0

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        description: product.description
      },
      stock: {
        total: totalStock,
        byWarehouse: stockByWarehouse
      },
      sales: {
        totalCount: salesStats._count || 0,
        totalQuantity: Number(salesStats._sum.quantity || 0),
        totalAmount: Number(salesStats._sum.totalAmount || 0),
        totalProfit: Number(salesStats._sum.profit || 0),
        avgPrice: avgSalePrice,
        lastSale: lastSale ? {
          date: lastSale.movementDate,
          quantity: Number(lastSale.quantity),
          unitPrice: Number(lastSale.unitPrice),
          totalAmount: Number(lastSale.totalAmount),
          customerName: lastSale.customer?.name || "Sin cliente"
        } : null
      },
      purchases: {
        totalCount: purchasesStats._count || 0,
        totalQuantity: Number(purchasesStats._sum.quantity || 0),
        totalAmount: Number(purchasesStats._sum.totalAmount || 0),
        avgPrice: avgPurchasePrice,
        lastPurchase: lastPurchase ? {
          date: lastPurchase.movementDate,
          quantity: Number(lastPurchase.quantity),
          unitPrice: Number(lastPurchase.unitPrice),
          totalAmount: Number(lastPurchase.totalAmount),
          warehouseName: lastPurchase.warehouse?.name || "Sin bodega"
        } : null
      },
      customers: customers,
      recentSales: salesMovements.slice(0, 20).map(m => ({
        id: m.id,
        date: m.movementDate,
        quantity: Number(m.quantity),
        unitPrice: Number(m.unitPrice),
        totalAmount: Number(m.totalAmount),
        customerName: m.customer?.name || "Sin cliente",
        customerPhone: m.customer?.phone || null,
        warehouseName: m.warehouse?.name || "Sin bodega",
        paymentType: m.paymentType
      })),
      recentPurchases: purchasesMovements.slice(0, 20).map(m => ({
        id: m.id,
        date: m.movementDate,
        quantity: Number(m.quantity),
        unitPrice: Number(m.unitPrice),
        totalAmount: Number(m.totalAmount),
        warehouseName: m.warehouse?.name || "Sin bodega",
        batchNumber: m.batch?.batchNumber || null
      }))
    })
  } catch (error: any) {
    console.error("Error obteniendo estadísticas del producto:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
