import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

type LastMovementRow = {
  productId: string
  movementDate: Date
  unitPrice: Prisma.Decimal
  quantity: number
  totalAmount: Prisma.Decimal
}

function lastPurchaseDetails(row: LastMovementRow) {
  return {
    lastPurchase: true as const,
    lastPurchasePrice: Number(row.unitPrice),
    lastPurchaseDate: row.movementDate,
    lastPurchaseQuantity: row.quantity,
    lastPurchaseTotal: Number(row.totalAmount)
  }
}

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
    const { searchParams } = new URL(req.url)
    const warehouseId = searchParams.get("warehouseId")

    if (!warehouseId) {
      return NextResponse.json(
        { error: "warehouseId requerido" },
        { status: 400 }
      )
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId }
    })
    if (!warehouse) {
      return NextResponse.json({ error: "Bodega no encontrada" }, { status: 404 })
    }

    const products = await prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null
      },
      include: {
        stock: {
          include: {
            warehouse: true
          }
        }
      },
      orderBy: { name: "asc" }
    })

    const productIds = products.map((p) => p.id)

    if (productIds.length === 0) {
      return NextResponse.json({ products: [], detailsByProductId: {} })
    }

    const [movementCounts, lastPurchases, lastSales] = await Promise.all([
      prisma.movement.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds } },
        _count: { _all: true }
      }),
      prisma.$queryRaw<LastMovementRow[]>(Prisma.sql`
        SELECT DISTINCT ON (m."productId")
          m."productId",
          m."movementDate",
          m."unitPrice",
          m."quantity",
          m."totalAmount"
        FROM movements m
        WHERE m."warehouseId" = ${warehouseId}
          AND m.type = 'purchase'
          AND m."productId" IN (${Prisma.join(productIds)})
        ORDER BY m."productId", m."movementDate" DESC
      `),
      prisma.$queryRaw<LastMovementRow[]>(Prisma.sql`
        SELECT DISTINCT ON (m."productId")
          m."productId",
          m."movementDate",
          m."unitPrice",
          m."quantity",
          m."totalAmount"
        FROM movements m
        WHERE m."warehouseId" = ${warehouseId}
          AND m.type = 'sale'
          AND m."productId" IN (${Prisma.join(productIds)})
        ORDER BY m."productId", m."movementDate" DESC
      `)
    ])

    const countByProduct = new Map<string, number>(
      movementCounts.map((c) => [c.productId, c._count._all])
    )

    const purchaseByProduct = new Map<string, LastMovementRow>(
      lastPurchases.map((r) => [r.productId, r])
    )
    const saleByProduct = new Map<string, LastMovementRow>(
      lastSales.map((r) => [r.productId, r])
    )

    const detailsByProductId: Record<string, Record<string, unknown>> = {}

    for (const id of productIds) {
      const row = purchaseByProduct.get(id)
      if (row) {
        detailsByProductId[id] = { ...lastPurchaseDetails(row) }
      } else {
        detailsByProductId[id] = {
          lastPurchase: null,
          lastPurchasePrice: null,
          lastPurchaseDate: null,
          lastPurchaseQuantity: null
        }
      }
    }

    const enrichedProducts = products.map((p) => {
      const purchase = purchaseByProduct.get(p.id)
      const sale = saleByProduct.get(p.id)
      return {
        ...p,
        _count: { movements: countByProduct.get(p.id) ?? 0 },
        movements: [] as unknown[],
        lastPurchaseDate: purchase?.movementDate ?? null,
        lastSaleDate: sale?.movementDate ?? null
      }
    })

    return NextResponse.json({
      products: enrichedProducts,
      detailsByProductId
    })
  } catch (error: any) {
    console.error("Error inventario productos:", error)
    return NextResponse.json(
      { error: error.message || "Error cargando inventario" },
      { status: 500 }
    )
  }
}
