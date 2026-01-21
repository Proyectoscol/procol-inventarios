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
    doc.text('FACTURA DE VENTA', 105, yPosition, { align: 'center' })
    yPosition += 10

    // Información de la empresa
    if (company) {
      doc.setFontSize(14)
      doc.text(company.name, 105, yPosition, { align: 'center' })
      yPosition += 8
    }

    // Número de factura y fecha
    doc.setFontSize(12)
    doc.text(`Factura No: ${relatedMovements[0]?.movementNumber || 'N/A'}`, 20, yPosition)
    // Formato de fecha más corto para evitar overflow
    const fecha = new Date(initialMovement.movementDate)
    const fechaStr = fecha.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' ' + fecha.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    })
    // Asegurar que la fecha no cause overflow
    const fechaWidth = doc.getTextWidth(`Fecha: ${fechaStr}`)
    const fechaX = Math.max(140, 190 - fechaWidth - 5)
    doc.text(`Fecha: ${fechaStr}`, fechaX, yPosition)
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

    // Headers de tabla con bordes
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    
    // Dibujar encabezado de tabla con bordes
    const tableStartX = 20
    const tableEndX = 190
    const headerY = yPosition - 5
    const headerHeight = 8
    
    // Borde superior del encabezado
    doc.line(tableStartX, headerY, tableEndX, headerY)
    
    // Columnas: Producto (ancho 80), Cant. (ancho 25), Precio Unit. (ancho 35), Total (ancho 30)
    const col1End = tableStartX + 80  // Producto
    const col2End = col1End + 25      // Cantidad
    const col3End = col2End + 35      // Precio Unit.
    const col4End = tableEndX         // Total
    
    // Líneas verticales del encabezado
    doc.line(col1End, headerY, col1End, headerY + headerHeight)
    doc.line(col2End, headerY, col2End, headerY + headerHeight)
    doc.line(col3End, headerY, col3End, headerY + headerHeight)
    
    // Texto del encabezado
    doc.text('Producto', tableStartX + 2, headerY + 5)
    doc.text('Cant.', col1End + 2, headerY + 5, { align: 'right' })
    doc.text('Precio Unit.', col2End + 2, headerY + 5, { align: 'right' })
    doc.text('Total', col3End + 2, headerY + 5, { align: 'right' })
    
    // Borde inferior del encabezado
    doc.line(tableStartX, headerY + headerHeight, tableEndX, headerY + headerHeight)
    
    yPosition = headerY + headerHeight + 2

    // Items de la tabla
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    
    const rowHeight = 8
    const pageHeight = doc.internal.pageSize.height
    const bottomMargin = 30 // Margen inferior para totales y footer
    
    relatedMovements.forEach((movement, index) => {
      // Verificar si necesitamos una nueva página
      if (yPosition + rowHeight > pageHeight - bottomMargin) {
        doc.addPage()
        yPosition = 20
        
        // Redibujar encabezado en nueva página
        const newHeaderY = yPosition
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.line(tableStartX, newHeaderY, tableEndX, newHeaderY)
        doc.line(col1End, newHeaderY, col1End, newHeaderY + headerHeight)
        doc.line(col2End, newHeaderY, col2End, newHeaderY + headerHeight)
        doc.line(col3End, newHeaderY, col3End, newHeaderY + headerHeight)
        doc.text('Producto', tableStartX + 2, newHeaderY + 5)
        doc.text('Cant.', col1End + 2, newHeaderY + 5, { align: 'right' })
        doc.text('Precio Unit.', col2End + 2, newHeaderY + 5, { align: 'right' })
        doc.text('Total', col3End + 2, newHeaderY + 5, { align: 'right' })
        doc.line(tableStartX, newHeaderY + headerHeight, tableEndX, newHeaderY + headerHeight)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        yPosition = newHeaderY + headerHeight + 2
      }

      const productName = movement.product.name
      const quantity = movement.quantity
      const unitPrice = Number(movement.unitPrice)
      const totalAmount = Number(movement.totalAmount)

      // Dividir nombre del producto si es muy largo
      const maxProductWidth = col1End - tableStartX - 4
      const productLines = doc.splitTextToSize(productName, maxProductWidth)
      
      // Dibujar bordes de la fila
      const rowTop = yPosition - 3
      const rowBottom = yPosition - 3 + (productLines.length * 4) + 2
      
      // Líneas verticales
      doc.line(col1End, rowTop, col1End, rowBottom)
      doc.line(col2End, rowTop, col2End, rowBottom)
      doc.line(col3End, rowTop, col3End, rowBottom)
      
      // Texto de la fila
      let textY = yPosition
      doc.text(productLines, tableStartX + 2, textY, { maxWidth: maxProductWidth })
      
      // Si el producto tiene múltiples líneas, centrar verticalmente los otros datos
      const centerY = textY + (productLines.length - 1) * 2
      
      doc.text(quantity.toString(), col1End + 2, centerY, { align: 'right' })
      doc.text(`$${unitPrice.toLocaleString('es-CO')}`, col2End + 2, centerY, { align: 'right' })
      doc.text(`$${totalAmount.toLocaleString('es-CO')}`, col3End + 2, centerY, { align: 'right' })
      
      // Línea inferior de la fila
      doc.line(tableStartX, rowBottom, tableEndX, rowBottom)
      
      yPosition = rowBottom + 2
    })
    
    // Cerrar la tabla con línea final
    doc.line(tableStartX, yPosition, tableEndX, yPosition)
    yPosition += 5

    // Totales - asegurar que estén en la misma página
    if (yPosition > pageHeight - 50) {
      doc.addPage()
      yPosition = 20
    }
    
    yPosition += 5
    doc.line(20, yPosition, 190, yPosition)
    yPosition += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', 150, yPosition, { align: 'right' })
    doc.text(`$${subtotal.toLocaleString('es-CO')}`, 180, yPosition, { align: 'right' })
    yPosition += 8

    if (shippingCost > 0) {
      doc.text('Envío:', 150, yPosition, { align: 'right' })
      doc.text(`$${shippingCost.toLocaleString('es-CO')}`, 180, yPosition, { align: 'right' })
      yPosition += 8
    }

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL:', 150, yPosition, { align: 'right' })
    doc.text(`$${total.toLocaleString('es-CO')}`, 180, yPosition, { align: 'right' })
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
        'Content-Disposition': `inline; filename="factura-${relatedMovements[0]?.movementNumber || 'venta'}.pdf"`,
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
