import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const joinCompanySchema = z.object({
  userType: z.enum(["MASTER", "STORE_MANAGER"]),
  companyId: z.string().min(1)
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const validated = joinCompanySchema.parse(body)

    // Verificar que el usuario no tenga ya un tipo asignado
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    if (user?.userType) {
      return NextResponse.json(
        { error: "El tipo de usuario ya está establecido y no se puede cambiar" },
        { status: 400 }
      )
    }

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

    // Actualizar el tipo de usuario y crear la relación con la compañía
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { userType: validated.userType }
      })

      await tx.userCompany.create({
        data: {
          userId: session.user.id,
          companyId: validated.companyId,
          role: "manager",
          isOwner: false
        }
      })
    })

    return NextResponse.json({ success: true, companyId: validated.companyId })
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
