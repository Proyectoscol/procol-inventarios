import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Desactivar caché para asegurar datos frescos en todos los dispositivos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const companies = await prisma.company.findMany({
      where: {
        users: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        _count: {
          select: {
            products: true,
            warehouses: true
          }
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                userType: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json(companies)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const data = await req.json()
    
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      return NextResponse.json(
        { error: "El nombre de la compañía es requerido" },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
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

      await tx.userCompany.create({
        data: {
          userId: session.user.id,
          companyId: company.id,
          role: "admin",
          isOwner: true // El usuario que crea la compañía es el dueño
        }
      })

      await tx.alertConfig.create({
        data: {
          companyId: company.id,
          alertEmails: Array.isArray(data.alertEmails) ? data.alertEmails : [],
          enableAlerts: data.enableAlerts !== false
        }
      })

      return company
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error("Error creando compañía:", error)
    return NextResponse.json(
      { error: error.message || "Error al crear la compañía" },
      { status: 500 }
    )
  }
}

