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

    const pageWidth = doc.internal.pageSize.width // ~216mm para letter
    const pageHeight = doc.internal.pageSize.height // ~279mm para letter
    const halfHeight = pageHeight / 2 // Primera mitad de la hoja (~139.5mm)

    // Márgenes para impresión (márgenes estándar de impresoras: ~10mm)
    const marginLeft = 10
    const marginRight = pageWidth - 10
    const marginTop = 10
    const usableHeight = halfHeight - marginTop - 10 // Altura usable en la primera mitad

    // Título
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('GUÍA DE ENVÍO', pageWidth / 2, marginTop + 6, { align: 'center' })
    
    // Línea divisoria horizontal en la mitad
    doc.setLineWidth(0.5)
    doc.line(marginLeft, halfHeight, marginRight, halfHeight)

    let yPosition = marginTop + 14
    const leftColumnX = marginLeft + 5
    const rightColumnX = pageWidth / 2 + 5
    const columnWidth = (pageWidth / 2) - 20

    // REMITENTE (Columna izquierda)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('REMITENTE', leftColumnX, yPosition)
    doc.line(leftColumnX, yPosition + 2, leftColumnX + 35, yPosition + 2)
    yPosition += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    // Nombre de la compañía
    if (company.name) {
      doc.setFont('helvetica', 'bold')
      const companyNameLines = doc.splitTextToSize(company.name, columnWidth - 5)
      doc.text(companyNameLines, leftColumnX, yPosition)
      yPosition += companyNameLines.length * 5
    }

    // Nombre del encargado
    if (company.nombreEncargado) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Encargado: ${company.nombreEncargado}`, leftColumnX, yPosition)
      yPosition += 4.5
    }

    // Cédula/NIT
    if (company.cedula) {
      doc.text(`Cédula/NIT: ${company.cedula}`, leftColumnX, yPosition)
      yPosition += 4.5
    }

    // Teléfono
    if (company.phone) {
      doc.text(`Teléfono: ${company.phone}`, leftColumnX, yPosition)
      yPosition += 4.5
    }

    // Dirección estructurada
    if (company.departamento || company.ciudad) {
      const ubicacion = [company.departamento, company.ciudad].filter(Boolean).join(", ")
      doc.text(ubicacion, leftColumnX, yPosition)
      yPosition += 4.5
    }

    if (company.barrio) {
      doc.text(`Barrio: ${company.barrio}`, leftColumnX, yPosition)
      yPosition += 4.5
    }

    if (company.direccion1) {
      const dir1Lines = doc.splitTextToSize(company.direccion1, columnWidth - 5)
      doc.text(dir1Lines, leftColumnX, yPosition)
      yPosition += dir1Lines.length * 4.5
    }

    if (company.direccion2) {
      const dir2Lines = doc.splitTextToSize(company.direccion2, columnWidth - 5)
      doc.text(dir2Lines, leftColumnX, yPosition)
      yPosition += dir2Lines.length * 4.5
    }
    
    // Guardar posición Y final de columna remitente
    const finalYRemitente = yPosition

    // DESTINATARIO (Columna derecha)
    yPosition = marginTop + 14
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('DESTINATARIO', rightColumnX, yPosition)
    doc.line(rightColumnX, yPosition + 2, rightColumnX + 35, yPosition + 2)
    yPosition += 7

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    
    // Nombre del cliente o nombre de quien recibe
    const nombreDestinatario = initialMovement.customer.nombreRecibe || initialMovement.customer.name
    if (nombreDestinatario) {
      doc.setFont('helvetica', 'bold')
      const nombreLines = doc.splitTextToSize(nombreDestinatario, columnWidth - 5)
      doc.text(nombreLines, rightColumnX, yPosition)
      yPosition += nombreLines.length * 5
    }

    // Cédula
    if (initialMovement.customer.cedula) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Cédula: ${initialMovement.customer.cedula}`, rightColumnX, yPosition)
      yPosition += 4.5
    }

    // Teléfono
    if (initialMovement.customer.phone) {
      doc.text(`Teléfono: ${initialMovement.customer.phone}`, rightColumnX, yPosition)
      yPosition += 4.5
    }

    // Dirección estructurada
    if (initialMovement.customer.departamento || initialMovement.customer.ciudad) {
      const ubicacion = [initialMovement.customer.departamento, initialMovement.customer.ciudad].filter(Boolean).join(", ")
      doc.text(ubicacion, rightColumnX, yPosition)
      yPosition += 4.5
    }

    if (initialMovement.customer.barrio) {
      doc.text(`Barrio: ${initialMovement.customer.barrio}`, rightColumnX, yPosition)
      yPosition += 4.5
    }

    if (initialMovement.customer.direccion1) {
      const dir1Lines = doc.splitTextToSize(initialMovement.customer.direccion1, columnWidth - 5)
      doc.text(dir1Lines, rightColumnX, yPosition)
      yPosition += dir1Lines.length * 4.5
    }

    if (initialMovement.customer.direccion2) {
      const dir2Lines = doc.splitTextToSize(initialMovement.customer.direccion2, columnWidth - 5)
      doc.text(dir2Lines, rightColumnX, yPosition)
      yPosition += dir2Lines.length * 4.5
    }

    // Si no hay dirección estructurada, usar address legacy
    if (!initialMovement.customer.direccion1 && initialMovement.customer.address) {
      const addressLines = doc.splitTextToSize(initialMovement.customer.address, columnWidth - 5)
      doc.text(addressLines, rightColumnX, yPosition)
      yPosition += addressLines.length * 4.5
    }

    // Guardar posición Y final de columna destinatario
    const finalYDestinatario = yPosition
    
    // Posicionar casillas y campo "Contiene" debajo de la columna más larga
    let startYInfo = Math.max(finalYRemitente, finalYDestinatario) + 8
    
    // Verificar que todo quepa en la primera mitad (con margen de seguridad)
    const espacioNecesario = 25 // Espacio para casillas + contiene + número de orden
    if (startYInfo + espacioNecesario > halfHeight - 10) {
      // Si no cabe, ajustar posición hacia arriba
      startYInfo = halfHeight - espacioNecesario
    }
    
    yPosition = startYInfo
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Pago de envío:', leftColumnX, yPosition)
    yPosition += 6
    
    // Casilla "Al cobro" (destinatario paga)
    const casillaSize = 4
    doc.rect(leftColumnX, yPosition - 3, casillaSize, casillaSize) // Cuadrado vacío
    doc.text('Al cobro (envío pago)', leftColumnX + 7, yPosition)
    
    // Casilla "Paga remitente"
    const casilla2X = leftColumnX + 55
    doc.rect(casilla2X, yPosition - 3, casillaSize, casillaSize) // Cuadrado vacío
    doc.text('Paga remitente', casilla2X + 7, yPosition)
    
    // Campo "Contiene"
    yPosition += 7
    doc.setFont('helvetica', 'bold')
    doc.text('Contiene:', leftColumnX, yPosition)
    doc.setFont('helvetica', 'normal')
    doc.text('Artículos deportivos', leftColumnX + 22, yPosition)

    // Información adicional en la parte inferior (antes de la línea divisoria)
    yPosition = halfHeight - 8
    doc.setFontSize(7)
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
