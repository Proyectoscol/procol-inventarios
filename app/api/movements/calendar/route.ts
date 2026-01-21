import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getColombiaDay } from "@/lib/date-utils"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get("companyId")
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const warehouseIds = searchParams.get("warehouseIds")
    
    if (!companyId) {
      return NextResponse.json({ error: "companyId requerido" }, { status: 400 })
    }

    let startDate: Date
    let endDate: Date

    if (from && to) {
      // Usar rango de fechas proporcionado
      startDate = new Date(from)
      endDate = new Date(to)
    } else if (year && month) {
      // Comportamiento original: calcular rango del mes
      // Inicio del mes: 1er día 00:00 Colombia = 05:00 UTC del mismo día
      startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 5, 0, 0, 0))
      // Fin del mes: último día 23:59 Colombia = 04:59 UTC del día siguiente
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      endDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, lastDay + 1, 4, 59, 59, 999))
    } else {
      return NextResponse.json({ error: "Debe proporcionar (year y month) o (from y to)" }, { status: 400 })
    }

    const whereClause: any = {
      product: { companyId },
      movementDate: {
        gte: startDate,
        lte: endDate
      }
    }

    // Filtrar por bodegas si se proporcionan
    if (warehouseIds) {
      const ids = warehouseIds.split(",").filter(Boolean)
      if (ids.length > 0) {
        whereClause.warehouseId = { in: ids }
      }
    }

    // Obtener todos los movimientos del mes
    const movements = await prisma.movement.findMany({
      where: whereClause,
      select: {
        movementDate: true,
        type: true
      }
    })

    // Agrupar por día en zona horaria de Colombia
    const daysWithActivity = new Set<string>()
    movements.forEach(m => {
      // Si es un rango (from/to), usar formato YYYY-MM-DD, si no, usar número de día
      if (from && to) {
        const dateStr = m.movementDate.toISOString().split('T')[0]
        daysWithActivity.add(dateStr)
      } else {
        const day = getColombiaDay(m.movementDate)
        daysWithActivity.add(day.toString())
      }
    })

    return NextResponse.json({
      daysWithActivity: from && to 
        ? Array.from(daysWithActivity) 
        : Array.from(daysWithActivity).map(d => parseInt(d))
    })
  } catch (error: any) {
    console.error("Error obteniendo calendario:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

