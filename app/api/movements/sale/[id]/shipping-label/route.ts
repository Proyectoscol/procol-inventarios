import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { jsPDF } from "jspdf"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const movementId = params.id

    // Obtener el movimiento inicial
    const initialMovement = await prisma.movement.findUnique({
      where: { id: movementId },
      include: {
        customer: true,
        product: true,
        warehouse: true
      }
    })

    if (!initialMovement) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 })
    }

    // Obtener información de la compañía (remitente)
    const companyId = initialMovement.product.companyId
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    if (!company) {
      return NextResponse.json({ error: "Compañía no encontrada" }, { status: 404 })
    }

    if (!initialMovement.customer) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    // Crear PDF con jsPDF (mismo tamaño que orden de pedido)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })

    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    const halfHeight = pageHeight / 2 // Primera mitad de la hoja

    // Título
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('GUÍA DE ENVÍO', pageWidth / 2, 15, { align: 'center' })
    
    // Línea divisoria horizontal en la mitad
    doc.setLineWidth(0.5)
    doc.line(10, halfHeight, pageWidth - 10, halfHeight)

    let yPosition = 25
    const leftColumnX = 15
    const rightColumnX = pageWidth / 2 + 5
    const columnWidth = (pageWidth / 2) - 20

    // REMITENTE (Columna izquierda)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('REMITENTE', leftColumnX, yPosition)
    doc.line(leftColumnX, yPosition + 2, leftColumnX + 40, yPosition + 2)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    // Nombre de la compañía
    if (company.name) {
      doc.setFont('helvetica', 'bold')
      doc.text(company.name, leftColumnX, yPosition)
      yPosition += 6
    }

    // Nombre del encargado
    if (company.nombreEncargado) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Encargado: ${company.nombreEncargado}`, leftColumnX, yPosition)
      yPosition += 5
    }

    // Cédula/NIT
    if (company.cedula) {
      doc.text(`Cédula/NIT: ${company.cedula}`, leftColumnX, yPosition)
      yPosition += 5
    }

    // Teléfono
    if (company.phone) {
      doc.text(`Teléfono: ${company.phone}`, leftColumnX, yPosition)
      yPosition += 5
    }

    // Dirección estructurada
    if (company.departamento || company.ciudad) {
      const ubicacion = [company.departamento, company.ciudad].filter(Boolean).join(", ")
      doc.text(ubicacion, leftColumnX, yPosition)
      yPosition += 5
    }

    if (company.barrio) {
      doc.text(`Barrio: ${company.barrio}`, leftColumnX, yPosition)
      yPosition += 5
    }

    if (company.direccion1) {
      doc.text(company.direccion1, leftColumnX, yPosition)
      yPosition += 5
    }

    if (company.direccion2) {
      doc.text(company.direccion2, leftColumnX, yPosition)
      yPosition += 5
    }

    // DESTINATARIO (Columna derecha)
    yPosition = 25
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('DESTINATARIO', rightColumnX, yPosition)
    doc.line(rightColumnX, yPosition + 2, rightColumnX + 40, yPosition + 2)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    
    // Nombre del cliente o nombre de quien recibe
    const nombreDestinatario = initialMovement.customer.nombreRecibe || initialMovement.customer.name
    if (nombreDestinatario) {
      doc.setFont('helvetica', 'bold')
      doc.text(nombreDestinatario, rightColumnX, yPosition)
      yPosition += 6
    }

    // Cédula
    if (initialMovement.customer.cedula) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Cédula: ${initialMovement.customer.cedula}`, rightColumnX, yPosition)
      yPosition += 5
    }

    // Teléfono
    if (initialMovement.customer.phone) {
      doc.text(`Teléfono: ${initialMovement.customer.phone}`, rightColumnX, yPosition)
      yPosition += 5
    }

    // Dirección estructurada
    if (initialMovement.customer.departamento || initialMovement.customer.ciudad) {
      const ubicacion = [initialMovement.customer.departamento, initialMovement.customer.ciudad].filter(Boolean).join(", ")
      doc.text(ubicacion, rightColumnX, yPosition)
      yPosition += 5
    }

    if (initialMovement.customer.barrio) {
      doc.text(`Barrio: ${initialMovement.customer.barrio}`, rightColumnX, yPosition)
      yPosition += 5
    }

    if (initialMovement.customer.direccion1) {
      doc.text(initialMovement.customer.direccion1, rightColumnX, yPosition)
      yPosition += 5
    }

    if (initialMovement.customer.direccion2) {
      doc.text(initialMovement.customer.direccion2, rightColumnX, yPosition)
      yPosition += 5
    }

    // Si no hay dirección estructurada, usar address legacy
    if (!initialMovement.customer.direccion1 && initialMovement.customer.address) {
      doc.text(`Dirección: ${initialMovement.customer.address}`, rightColumnX, yPosition)
      yPosition += 5
    }

    // Información adicional en la parte inferior de la primera mitad
    yPosition = halfHeight - 20
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Número de Orden: ${initialMovement.movementNumber}`, leftColumnX, yPosition)
    
    const fecha = new Date(initialMovement.movementDate)
    const fechaStr = fecha.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    doc.text(`Fecha: ${fechaStr}`, rightColumnX, yPosition)

    // Generar PDF como buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Convertir a Uint8Array para NextResponse
    const uint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="guia-envio-${initialMovement.movementNumber || 'venta'}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error: any) {
    console.error("Error generando guía de envío:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
