import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const joinCompanySchema = z.object({
  userType: z.enum(["MASTER", "STORE_MANAGER", "VENDEDOR"]),
  companyId: z.string().min(1),
  // For VENDEDOR only: warehouseIds must be provided
  warehouseIds: z.array(z.string().min(1)).optional()
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const validated = joinCompanySchema.parse(body)

    // Verificar el tipo de usuario actual
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    // Si el usuario ya tiene un tipo y es diferente al que está intentando establecer, rechazar
    if (user?.userType && user.userType !== validated.userType) {
      return NextResponse.json(
        { error: "El tipo de usuario ya está establecido y no se puede cambiar" },
        { status: 400 }
      )
    }

    // Si el usuario ya tiene el mismo tipo, solo crear la relación (permitir unirse a otra compañía)
    const shouldUpdateUserType = !user?.userType

    // Verificar que la compañía existe
    const company = await prisma.company.findUnique({
      where: { id: validated.companyId }
    })

    if (!company) {
      return NextResponse.json(
        { error: "Compañía no encontrada" },
        { status: 404 }
      )
    }

    // Validar VENDEDOR-specific requirements
    if (validated.userType === "VENDEDOR") {
      if (!validated.warehouseIds || validated.warehouseIds.length === 0) {
        return NextResponse.json(
          { error: "VENDEDOR debe asignarse a al menos una bodega" },
          { status: 400 }
        )
      }

      // Verificar que todas las bodegas pertenecen a la compañía
      const warehouses = await prisma.warehouse.findMany({
        where: {
          id: { in: validated.warehouseIds },
          companyId: validated.companyId
        }
      })

      if (warehouses.length !== validated.warehouseIds.length) {
        return NextResponse.json(
          { error: "Una o más bodegas no pertenecen a esta compañía" },
          { status: 400 }
        )
      }
    }

    // Verificar que el usuario no esté ya asociado a esta compañía
    const existingRelation = await prisma.userCompany.findUnique({
      where: {
        userId_companyId: {
          userId: session.user.id,
          companyId: validated.companyId
        }
      }
    })

    if (existingRelation) {
      return NextResponse.json(
        { error: "Ya estás asociado a esta compañía" },
        { status: 400 }
      )
    }

    // Actualizar el tipo de usuario (solo si no lo tiene) y crear la relación con la compañía
    const assignedWarehouseIds = await prisma.$transaction(async (tx) => {
      if (shouldUpdateUserType) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { userType: validated.userType }
        })
      }

      // Determine role based on userType
      const role = validated.userType === "VENDEDOR" ? "employee" : "manager"

      await tx.userCompany.create({
        data: {
          userId: session.user.id,
          companyId: validated.companyId,
          role: role,
          isOwner: false
        }
      })

      // For VENDEDOR, create warehouse assignments
      if (validated.userType === "VENDEDOR" && validated.warehouseIds) {
        const warehouseAssignments = await tx.warehouseAssignment.createMany({
          data: validated.warehouseIds.map(warehouseId => ({
            userId: session.user.id,
            warehouseId: warehouseId
          })),
          skipDuplicates: true // Avoid errors if already assigned
        })
        return validated.warehouseIds
      }

      return undefined
    })

    return NextResponse.json({ 
      success: true, 
      companyId: validated.companyId,
      userType: validated.userType,
      warehouseIds: assignedWarehouseIds
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Error al unirse a la compañía" },
      { status: 500 }
    )
  }
}
