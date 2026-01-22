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

    const products = await prisma.product.findMany({
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

    return NextResponse.json(products)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

