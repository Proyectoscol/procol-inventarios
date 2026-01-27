import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Desactivar caché para asegurar datos frescos en todos los dispositivos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const companyId = params.id
    const data = await req.json()

    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      return NextResponse.json(
        { error: "El nombre de la compañía es requerido" },
        { status: 400 }
      )
    }

    // Verificar que el usuario tenga acceso a esta compañía
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId: companyId
      }
    })

    if (!userCompany) {
      return NextResponse.json(
        { error: "No tienes acceso a esta compañía" },
        { status: 403 }
      )
    }

    // Actualizar la compañía
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name.trim(),
        nombreEncargado: data.nombreEncargado || null,
        phone: data.phone || null,
        cedula: data.cedula || null,
        departamento: data.departamento || null,
        ciudad: data.ciudad || null,
        barrio: data.barrio || null,
        direccion1: data.direccion1 || null,
        direccion2: data.direccion2 || null
      }
    })

    return NextResponse.json(company)
  } catch (error: any) {
    console.error("Error actualizando compañía:", error)
    return NextResponse.json(
      { error: error.message || "Error al actualizar la compañía" },
      { status: 500 }
    )
  }
}
