import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Desactivar caché para asegurar datos frescos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const company = await prisma.company.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true
      }
    })

    if (!company) {
      return NextResponse.json(
        { error: "Compañía no encontrada" },
        { status: 404 }
      )
    }

    // Solo devolver el nombre para verificación, no toda la información
    return NextResponse.json({
      id: company.id,
      name: company.name
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al verificar la compañía" },
      { status: 500 }
    )
  }
}
