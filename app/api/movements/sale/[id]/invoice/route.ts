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

    // Buscar todos los movimientos relacionados
    const movementDate = new Date(initialMovement.movementDate)
    const startDate = new Date(movementDate)
    startDate.setSeconds(0, 0)
    const endDate = new Date(movementDate)
    endDate.setSeconds(59, 999)

    const relatedMovements = await prisma.movement.findMany({
      where: {
        customerId: initialMovement.customerId,
        movementDate: {
          gte: startDate,
          lte: endDate
        },
        paymentType: initialMovement.paymentType,
        type: "sale"
      },
      include: {
        product: true,
        warehouse: true,
        customer: true
      },
      orderBy: {
        movementDate: "asc"
      }
    })

    // Calcular totales
    const subtotal = relatedMovements.reduce((sum, m) => sum + Number(m.totalAmount), 0)
    const shippingCost = relatedMovements.reduce((sum, m) => sum + Number(m.shippingCost || 0), 0)
    const total = subtotal + shippingCost

    // Obtener información de la compañía
    const companyId = initialMovement.product.companyId
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    // Crear PDF con jsPDF (no requiere archivos de fuentes externos)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    })

    let yPosition = 20

    // Header
    doc.setFontSize(24)
    doc.text('ORDEN DE PEDIDO', 105, yPosition, { align: 'center' })
    yPosition += 10

    // Información de la empresa
    if (company) {
      doc.setFontSize(14)
      doc.text(company.name, 105, yPosition, { align: 'center' })
      yPosition += 8
    }

    // Número de orden de pedido y fecha
    doc.setFontSize(12)
    doc.text(`Orden de Pedido No: ${relatedMovements[0]?.movementNumber || 'N/A'}`, 20, yPosition)
    // Formato de fecha más corto y simple
    const fecha = new Date(initialMovement.movementDate)
    const fechaStr = fecha.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' ' + fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    // Posicionar fecha alineada a la derecha con margen
    const fechaText = `Fecha: ${fechaStr}`
    const fechaWidth = doc.getTextWidth(fechaText)
    const fechaX = 190 - fechaWidth - 5 // 5mm de margen desde el borde derecho
    doc.text(fechaText, fechaX, yPosition)
    yPosition += 15

    // Información del cliente
    doc.setFontSize(14)
    doc.text('INFORMACIÓN DEL CLIENTE', 20, yPosition)
    doc.setLineWidth(0.5)
    doc.line(20, yPosition + 2, 190, yPosition + 2)
    yPosition += 8
    
    doc.setFontSize(11)
    if (initialMovement.customer) {
      doc.text(`Nombre: ${initialMovement.customer.name}`, 20, yPosition)
      yPosition += 6
      if (initialMovement.customer.phone) {
        doc.text(`Teléfono: ${initialMovement.customer.phone}`, 20, yPosition)
        yPosition += 6
      }
      if (initialMovement.customer.email) {
        doc.text(`Email: ${initialMovement.customer.email}`, 20, yPosition)
        yPosition += 6
      }
      if (initialMovement.customer.address) {
        doc.text(`Dirección: ${initialMovement.customer.address}`, 20, yPosition)
        yPosition += 6
      }
    } else {
      doc.text('Cliente: Sin especificar', 20, yPosition)
      yPosition += 6
    }
    yPosition += 5

    // Productos
    doc.setFontSize(14)
    doc.text('PRODUCTOS', 20, yPosition)
    doc.line(20, yPosition + 2, 190, yPosition + 2)
    yPosition += 10

    // Definir posiciones de columnas (alineadas con totales)
    const tableStartX = 20
    const tableEndX = 190
    const colProductoEnd = 120  // Producto termina aquí
    const colCantEnd = 140      // Cantidad termina aquí
    const colPrecioEnd = 165    // Precio Unit. termina aquí
    const colTotalEnd = 190     // Total termina aquí (alineado con totales)
    
    const pageHeight = doc.internal.pageSize.height
    const bottomMargin = 50 // Margen para totales y footer

    // Headers de tabla - simple y limpio
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    
    // Línea superior de la tabla
    doc.line(tableStartX, yPosition, tableEndX, yPosition)
    
    // Texto de encabezados
    doc.text('Producto', tableStartX + 2, yPosition + 5)
    doc.text('Cant.', colProductoEnd, yPosition + 5, { align: 'right' })
    doc.text('Precio Unit.', colCantEnd, yPosition + 5, { align: 'right' })
    doc.text('Total', colPrecioEnd, yPosition + 5, { align: 'right' })
    
    // Línea debajo de encabezados
    yPosition += 8
    doc.line(tableStartX, yPosition, tableEndX, yPosition)

    // Items de la tabla
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    yPosition += 5
    
    relatedMovements.forEach((movement) => {
      // Verificar si necesitamos una nueva página
      if (yPosition > pageHeight - bottomMargin) {
        doc.addPage()
        yPosition = 20
        
        // Redibujar encabezado en nueva página
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.line(tableStartX, yPosition, tableEndX, yPosition)
        doc.text('Producto', tableStartX + 2, yPosition + 5)
        doc.text('Cant.', colProductoEnd, yPosition + 5, { align: 'right' })
        doc.text('Precio Unit.', colCantEnd, yPosition + 5, { align: 'right' })
        doc.text('Total', colPrecioEnd, yPosition + 5, { align: 'right' })
        yPosition += 8
        doc.line(tableStartX, yPosition, tableEndX, yPosition)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        yPosition += 5
      }

      const productName = movement.product.name
      const quantity = movement.quantity
      const unitPrice = Number(movement.unitPrice)
      const totalAmount = Number(movement.totalAmount)

      // Dividir nombre del producto si es muy largo
      const maxProductWidth = colProductoEnd - tableStartX - 4
      const productLines = doc.splitTextToSize(productName, maxProductWidth)
      
      // Calcular altura de la fila basada en líneas del producto
      const lineHeight = 5
      const rowHeight = Math.max(8, productLines.length * lineHeight)
      
      // Texto de la fila - alineado verticalmente al centro si hay múltiples líneas
      const textY = yPosition + (rowHeight / 2) - 2
      
      doc.text(productLines, tableStartX + 2, yPosition, { maxWidth: maxProductWidth })
      doc.text(quantity.toString(), colProductoEnd, textY, { align: 'right' })
      doc.text(`$${unitPrice.toLocaleString('es-CO')}`, colCantEnd, textY, { align: 'right' })
      doc.text(`$${totalAmount.toLocaleString('es-CO')}`, colPrecioEnd, textY, { align: 'right' })
      
      yPosition += rowHeight + 3
    })
    
    // Línea final de la tabla
    doc.line(tableStartX, yPosition, tableEndX, yPosition)
    yPosition += 8

    // Totales - asegurar que estén en la misma página y alineados con la columna Total
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = 20
    }
    
    // Usar las mismas posiciones de columna para alineación
    const totalLabelX = colPrecioEnd - 10 // Un poco antes de la columna de precio
    const totalValueX = colTotalEnd       // Alineado con la columna Total
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', totalLabelX, yPosition, { align: 'right' })
    doc.text(`$${subtotal.toLocaleString('es-CO')}`, totalValueX, yPosition, { align: 'right' })
    yPosition += 8

    if (shippingCost > 0) {
      doc.text('Envío:', totalLabelX, yPosition, { align: 'right' })
      doc.text(`$${shippingCost.toLocaleString('es-CO')}`, totalValueX, yPosition, { align: 'right' })
      yPosition += 8
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL:', totalLabelX, yPosition, { align: 'right' })
    doc.text(`$${total.toLocaleString('es-CO')}`, totalValueX, yPosition, { align: 'right' })
    yPosition += 12

    // Información de pago
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('CONDICIONES DE PAGO', 20, yPosition)
    doc.line(20, yPosition + 2, 190, yPosition + 2)
    yPosition += 8
    doc.setFontSize(10)
    
    const paymentType = initialMovement.paymentType
    if (paymentType === 'cash') {
      doc.text('Forma de pago: Contado', 20, yPosition)
      yPosition += 6
    } else if (paymentType === 'credit') {
      doc.text('Forma de pago: Crédito', 20, yPosition)
      yPosition += 6
      if (initialMovement.creditDays) {
        doc.text(`Días de crédito: ${initialMovement.creditDays} días`, 20, yPosition)
        yPosition += 6
      }
      if (initialMovement.creditDueDate) {
        doc.text(`Fecha de vencimiento: ${new Date(initialMovement.creditDueDate).toLocaleDateString('es-CO')}`, 20, yPosition)
        yPosition += 6
      }
    } else if (paymentType === 'mixed') {
      doc.text('Forma de pago: Mixto (Contado + Crédito)', 20, yPosition)
      yPosition += 6
      const cashAmount = Number(initialMovement.cashAmount || 0)
      const creditAmount = Number(initialMovement.creditAmount || 0)
      doc.text(`Contado: $${cashAmount.toLocaleString('es-CO')}`, 20, yPosition)
      yPosition += 6
      doc.text(`Crédito: $${creditAmount.toLocaleString('es-CO')}`, 20, yPosition)
      yPosition += 6
      if (initialMovement.creditDays) {
        doc.text(`Días de crédito: ${initialMovement.creditDays} días`, 20, yPosition)
        yPosition += 6
      }
      if (initialMovement.creditDueDate) {
        doc.text(`Fecha de vencimiento: ${new Date(initialMovement.creditDueDate).toLocaleDateString('es-CO')}`, 20, yPosition)
        yPosition += 6
      }
    }

    // Notas
    if (initialMovement.notes) {
      yPosition += 5
      doc.setFontSize(12)
      doc.text('NOTAS', 20, yPosition)
      doc.line(20, yPosition + 2, 190, yPosition + 2)
      yPosition += 8
      doc.setFontSize(10)
      // Dividir notas en líneas si son muy largas
      const notesLines = doc.splitTextToSize(initialMovement.notes, 170)
      doc.text(notesLines, 20, yPosition)
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        'Gracias por su compra',
        105,
        doc.internal.pageSize.height - 15,
        { align: 'center' }
      )
    }

    // Generar PDF como buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // Convertir a Uint8Array para NextResponse
    const uint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="orden-de-pedido-${relatedMovements[0]?.movementNumber || 'venta'}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    })
  } catch (error: any) {
    console.error("Error generando PDF:", error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
