import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"

const setTypeSchema = z.object({
  userType: z.enum(["MASTER", "STORE_MANAGER"])
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await req.json()
    const validated = setTypeSchema.parse(body)

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

    // Actualizar el tipo de usuario
    await prisma.user.update({
      where: { id: session.user.id },
      data: { userType: validated.userType }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Tipo de usuario inválido", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Error al establecer tipo de usuario" },
      { status: 500 }
    )
  }
}
