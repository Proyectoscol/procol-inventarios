import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const data = await req.json()
    const { productId, sourceWarehouseId, targetWarehouseId, quantity, companyId } = data

    if (!productId || !sourceWarehouseId || !targetWarehouseId || !quantity || !companyId) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 })
    }

    if (sourceWarehouseId === targetWarehouseId) {
      return NextResponse.json(
        { error: "La bodega origen y destino deben ser diferentes" },
        { status: 400 }
      )
    }

    if (quantity <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 })
    }

    // Validar acceso a bodega para VENDEDOR
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    if (user?.userType === "VENDEDOR") {
      const hasAccess = await prisma.warehouseAssignment.findFirst({
        where: { userId: session.user.id, warehouseId: sourceWarehouseId }
      })
      if (!hasAccess) {
        return NextResponse.json(
          { error: "No tienes acceso a la bodega origen" },
          { status: 403 }
        )
      }
    }

    // Validar que ambas bodegas pertenecen a la misma compañía
    const [sourceWarehouse, targetWarehouse] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: sourceWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: targetWarehouseId } })
    ])

    if (!sourceWarehouse || sourceWarehouse.companyId !== companyId) {
      return NextResponse.json({ error: "Bodega origen inválida" }, { status: 400 })
    }
    if (!targetWarehouse || targetWarehouse.companyId !== companyId) {
      return NextResponse.json({ error: "Bodega destino inválida" }, { status: 400 })
    }

    // Validar stock disponible en origen
    const sourceStock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId: sourceWarehouseId }
      }
    })

    if (!sourceStock || sourceStock.quantity < quantity) {
      return NextResponse.json(
        { error: `Stock insuficiente en bodega origen. Disponible: ${sourceStock?.quantity || 0}` },
        { status: 400 }
      )
    }

    // Obtener lotes FIFO de la bodega origen
    const batches = await prisma.batch.findMany({
      where: {
        productId,
        warehouseId: sourceWarehouseId,
        remainingQty: { gt: 0 }
      },
      orderBy: { purchaseDate: "asc" }
    })

    if (batches.length === 0) {
      return NextResponse.json(
        { error: "No hay lotes disponibles en la bodega origen" },
        { status: 400 }
      )
    }

    // Calcular FIFO: depletar lotes y obtener costo promedio ponderado
    let remaining = quantity
    let totalCost = 0
    const batchUpdates: Array<{ batchId: string; newRemaining: number }> = []
    const fifoBreakdown: Array<{ batchId: string; quantity: number }> = []

    for (const batch of batches) {
      if (remaining <= 0) break

      const qtyFromBatch = Math.min(batch.remainingQty, remaining)
      totalCost += qtyFromBatch * Number(batch.unitCost)
      remaining -= qtyFromBatch

      fifoBreakdown.push({ batchId: batch.id, quantity: qtyFromBatch })
      batchUpdates.push({
        batchId: batch.id,
        newRemaining: batch.remainingQty - qtyFromBatch
      })
    }

    const weightedAvgCost = totalCost / quantity

    // Generar número de movimiento TRF-000001
    const lastTransfer = await prisma.movement.findFirst({
      where: { type: "transfer", movementNumber: { startsWith: "TRF-" } },
      orderBy: { movementNumber: "desc" }
    })
    const lastNumber = lastTransfer
      ? parseInt(lastTransfer.movementNumber.split("-")[1])
      : 0
    const movementNumber = `TRF-${String(lastNumber + 1).padStart(6, "0")}`

    // Transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      // Depletar lotes FIFO en origen
      for (const update of batchUpdates) {
        await tx.batch.update({
          where: { id: update.batchId },
          data: { remainingQty: update.newRemaining }
        })
      }

      // Decrementar stock en origen
      await tx.stock.update({
        where: {
          productId_warehouseId: { productId, warehouseId: sourceWarehouseId }
        },
        data: { quantity: { decrement: quantity } }
      })

      // Crear nuevo lote en bodega destino (preserva el costo promedio)
      await tx.batch.create({
        data: {
          batchNumber: movementNumber,
          productId,
          warehouseId: targetWarehouseId,
          initialQuantity: quantity,
          remainingQty: quantity,
          unitCost: weightedAvgCost
        }
      })

      // Incrementar stock en destino
      await tx.stock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId: targetWarehouseId }
        },
        update: { quantity: { increment: quantity } },
        create: { productId, warehouseId: targetWarehouseId, quantity }
      })

      // Crear movimiento de transferencia
      const movement = await tx.movement.create({
        data: {
          movementNumber,
          type: "transfer",
          productId,
          warehouseId: sourceWarehouseId,
          targetWarehouseId,
          fifoBreakdown,
          quantity,
          unitPrice: weightedAvgCost,
          totalAmount: 0,
          paymentType: "cash",
          creditPaid: true,
          notes: data.notes || null
        }
      })

      return movement
    })

    return NextResponse.json(
      {
        ...result,
        sourceWarehouse,
        targetWarehouse
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("Error en transferencia:", error)
    return NextResponse.json(
      { error: error.message || "Error procesando transferencia" },
      { status: 500 }
    )
  }
}
