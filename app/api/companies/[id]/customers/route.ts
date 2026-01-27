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

    const customers = await prisma.customer.findMany({
      where: {
        companyId: params.id
      },
      orderBy: {
        name: "asc"
      }
    })

    return NextResponse.json(customers)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const data = await req.json()

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        nombreRecibe: data.nombreRecibe || null,
        phone: data.phone || null,
        cedula: data.cedula || null,
        departamento: data.departamento || null,
        ciudad: data.ciudad || null,
        barrio: data.barrio || null,
        direccion1: data.direccion1 || null,
        direccion2: data.direccion2 || null,
        address: data.address || null,
        companyId: params.id
      }
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

