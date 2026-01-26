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

    const customerId = params.id
    const data = await req.json()

    // Verificar que el cliente existe
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { company: true }
    })

    if (!existingCustomer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    // Verificar que el usuario tenga acceso a la compañía del cliente
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId: existingCustomer.companyId
      }
    })

    if (!userCompany) {
      return NextResponse.json(
        { error: "No tienes acceso a esta compañía" },
        { status: 403 }
      )
    }

    // Validar que el nombre no esté vacío
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      return NextResponse.json(
        { error: "El nombre del cliente es requerido" },
        { status: 400 }
      )
    }

    // Actualizar el cliente
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: data.name.trim(),
        phone: data.phone || null,
        address: data.address || null
      }
    })

    return NextResponse.json(updatedCustomer)
  } catch (error: any) {
    console.error("Error actualizando cliente:", error)
    return NextResponse.json(
      { error: error.message || "Error al actualizar el cliente" },
      { status: 500 }
    )
  }
}
