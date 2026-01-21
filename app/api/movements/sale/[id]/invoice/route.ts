import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import PDFDocument from "pdfkit"

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

    // Generar PDF
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Obtener información de la compañía
    const companyId = initialMovement.product.companyId
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    })

    // Header
    doc.fontSize(24).text('FACTURA DE VENTA', { align: 'center' })
    doc.moveDown()

    // Información de la empresa
    if (company) {
      doc.fontSize(14).text(company.name, { align: 'center' })
      doc.moveDown(0.5)
    }

    // Número de factura y fecha
    doc.fontSize(12)
    doc.text(`Factura No: ${relatedMovements[0]?.movementNumber || 'N/A'}`, 50, doc.y)
    doc.text(`Fecha: ${new Date(initialMovement.movementDate).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 350, doc.y - 15)
    doc.moveDown(2)

    // Información del cliente
    doc.fontSize(14).text('INFORMACIÓN DEL CLIENTE', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11)
    if (initialMovement.customer) {
      doc.text(`Nombre: ${initialMovement.customer.name}`)
      if (initialMovement.customer.phone) {
        doc.text(`Teléfono: ${initialMovement.customer.phone}`)
      }
      if (initialMovement.customer.email) {
        doc.text(`Email: ${initialMovement.customer.email}`)
      }
      if (initialMovement.customer.address) {
        doc.text(`Dirección: ${initialMovement.customer.address}`)
      }
    } else {
      doc.text('Cliente: Sin especificar')
    }
    doc.moveDown(2)

    // Productos
    doc.fontSize(14).text('PRODUCTOS', { underline: true })
    doc.moveDown(0.5)

    // Tabla de productos
    const tableTop = doc.y
    const itemHeight = 60
    let currentY = tableTop

    // Headers
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('Producto', 50, currentY)
    doc.text('Bodega', 200, currentY)
    doc.text('Cant.', 300, currentY, { width: 50, align: 'right' })
    doc.text('Precio Unit.', 360, currentY, { width: 80, align: 'right' })
    doc.text('Total', 450, currentY, { width: 100, align: 'right' })

    currentY += 20
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke()

    // Items
    doc.font('Helvetica').fontSize(9)
    relatedMovements.forEach((movement, index) => {
      if (currentY > 700) {
        doc.addPage()
        currentY = 50
      }

      const productName = movement.product.name
      const warehouseName = movement.warehouse.name
      const quantity = movement.quantity
      const unitPrice = Number(movement.unitPrice)
      const totalAmount = Number(movement.totalAmount)

      // Producto (con imagen si existe en imageBase64)
      // Las imágenes están en el campo imageBase64 del producto

      doc.text(productName, 50, currentY, { width: 140 })
      doc.text(warehouseName, 200, currentY, { width: 90 })
      doc.text(quantity.toString(), 300, currentY, { width: 50, align: 'right' })
      doc.text(`$${unitPrice.toLocaleString('es-CO')}`, 360, currentY, { width: 80, align: 'right' })
      doc.text(`$${totalAmount.toLocaleString('es-CO')}`, 450, currentY, { width: 100, align: 'right' })

      currentY += itemHeight
    })

    // Totales
    currentY += 10
    doc.moveTo(50, currentY).lineTo(550, currentY).stroke()
    currentY += 10

    doc.fontSize(11)
    doc.text('Subtotal:', 400, currentY, { width: 100, align: 'right' })
    doc.text(`$${subtotal.toLocaleString('es-CO')}`, 450, currentY, { width: 100, align: 'right' })
    currentY += 20

    if (shippingCost > 0) {
      doc.text('Envío:', 400, currentY, { width: 100, align: 'right' })
      doc.text(`$${shippingCost.toLocaleString('es-CO')}`, 450, currentY, { width: 100, align: 'right' })
      currentY += 20
    }

    doc.fontSize(14).font('Helvetica-Bold')
    doc.text('TOTAL:', 400, currentY, { width: 100, align: 'right' })
    doc.text(`$${total.toLocaleString('es-CO')}`, 450, currentY, { width: 100, align: 'right' })
    currentY += 30

    // Información de pago
    doc.fontSize(12).font('Helvetica')
    doc.text('CONDICIONES DE PAGO', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(10)
    
    const paymentType = initialMovement.paymentType
    if (paymentType === 'cash') {
      doc.text('Forma de pago: Contado')
    } else if (paymentType === 'credit') {
      doc.text('Forma de pago: Crédito')
      if (initialMovement.creditDays) {
        doc.text(`Días de crédito: ${initialMovement.creditDays} días`)
      }
      if (initialMovement.creditDueDate) {
        doc.text(`Fecha de vencimiento: ${new Date(initialMovement.creditDueDate).toLocaleDateString('es-CO')}`)
      }
    } else if (paymentType === 'mixed') {
      doc.text('Forma de pago: Mixto (Contado + Crédito)')
      const cashAmount = Number(initialMovement.cashAmount || 0)
      const creditAmount = Number(initialMovement.creditAmount || 0)
      doc.text(`Contado: $${cashAmount.toLocaleString('es-CO')}`)
      doc.text(`Crédito: $${creditAmount.toLocaleString('es-CO')}`)
      if (initialMovement.creditDays) {
        doc.text(`Días de crédito: ${initialMovement.creditDays} días`)
      }
      if (initialMovement.creditDueDate) {
        doc.text(`Fecha de vencimiento: ${new Date(initialMovement.creditDueDate).toLocaleDateString('es-CO')}`)
      }
    }

    // Notas
    if (initialMovement.notes) {
      doc.moveDown(1)
      doc.fontSize(12).text('NOTAS', { underline: true })
      doc.moveDown(0.5)
      doc.fontSize(10).text(initialMovement.notes)
    }

    // Footer
    const pageHeight = doc.page.height
    const footerY = pageHeight - 50
    doc.fontSize(8).text(
      'Gracias por su compra',
      doc.page.width / 2,
      footerY,
      { align: 'center' }
    )

    // Finalizar el documento
    doc.end()

    // Esperar a que el PDF termine de generarse
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      doc.on('error', reject)
    })

    // Convertir Buffer a Uint8Array para NextResponse
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
