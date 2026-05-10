import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { jsPDF } from "jspdf"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const warehouseId = searchParams.get("warehouseId")

    if (!warehouseId) {
      return NextResponse.json({ error: "warehouseId requerido" }, { status: 400 })
    }

    // Get user type
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { userType: true }
    })

    const isVendedor = user?.userType === "VENDEDOR"

    // For VENDEDOR, verify they have access to this warehouse
    if (isVendedor) {
      const hasAccess = await prisma.warehouseAssignment.findFirst({
        where: { userId: session.user.id, warehouseId }
      })
      if (!hasAccess) {
        return NextResponse.json({ error: "No tienes acceso a esta bodega" }, { status: 403 })
      }
    }

    // Get warehouse info
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: { company: true }
    })

    if (!warehouse) {
      return NextResponse.json({ error: "Bodega no encontrada" }, { status: 404 })
    }

    // Get stock with product details
    const stocks = await prisma.stock.findMany({
      where: { warehouseId },
      include: {
        product: {
          include: {
            movements: {
              where: { warehouseId },
              orderBy: { movementDate: "desc" },
              take: 5,
              select: { movementDate: true, type: true, unitPrice: true }
            }
          }
        }
      },
      orderBy: { product: { name: "asc" } }
    })

    // Build PDF
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "letter"
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let y = 20

    // Title
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("Inventario", margin, y)
    y += 8

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(`Bodega: ${warehouse.name}`, margin, y)
    y += 6

    if (warehouse.description) {
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(warehouse.description, margin, y)
      doc.setTextColor(0)
      y += 5
    }

    doc.setFontSize(10)
    doc.setTextColor(100)
    const now = new Date()
    doc.text(
      `Generado: ${now.toLocaleDateString("es-CO")} ${now.toLocaleTimeString("es-CO")}`,
      margin,
      y
    )
    doc.setTextColor(0)
    y += 8

    // Separator line
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    if (isVendedor) {
      // VENDEDOR view: only 3 columns — product name, stock, minimum threshold
      const col1 = margin
      const col2 = margin + 140
      const col3 = margin + 185

      // Header row
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, pageWidth - margin * 2, 8, "F")
      doc.text("Producto", col1 + 2, y)
      doc.text("Stock", col2, y)
      doc.text("Umbral Mínimo", col3, y)
      y += 8

      // Data rows
      doc.setFont("helvetica", "normal")
      let rowAlt = false
      for (const s of stocks) {
        if (y > 180) {
          doc.addPage()
          y = 20
        }
        if (rowAlt) {
          doc.setFillColor(250, 250, 250)
          doc.rect(margin, y - 4, pageWidth - margin * 2, 7, "F")
        }
        rowAlt = !rowAlt

        doc.setFontSize(9)
        const nameLines = doc.splitTextToSize(s.product.name, 130)
        doc.text(nameLines[0], col1 + 2, y)
        doc.text(String(s.quantity ?? 0), col2, y)
        doc.text(String(s.product.minStockThreshold ?? 0), col3, y)
        y += 7
      }
    } else {
      // MASTER view: full columns
      const colWidths = [100, 22, 18, 22, 30, 22, 30]
      const colX = [margin]
      for (let i = 0; i < colWidths.length - 1; i++) {
        colX.push(colX[i] + colWidths[i])
      }

      const headers = [
        "Producto",
        "Disponible",
        "Stock",
        "Umbral Mín.",
        "Último Pedido",
        "Precio Unit.",
        "Total Producto"
      ]

      // Header row
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, pageWidth - margin * 2, 8, "F")
      headers.forEach((h, i) => doc.text(h, colX[i] + 2, y))
      y += 8

      const formatCurrency = (n: number) =>
        new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)

      doc.setFont("helvetica", "normal")
      let totalInventoryValue = 0
      let rowAlt = false

      for (const s of stocks) {
        if (y > 175) {
          doc.addPage()
          y = 20
        }
        if (rowAlt) {
          doc.setFillColor(250, 250, 250)
          doc.rect(margin, y - 4, pageWidth - margin * 2, 7, "F")
        }
        rowAlt = !rowAlt

        const qty = s.quantity ?? 0
        // Use the last sale price, fall back to last purchase price, then 0
        const lastSale = s.product.movements.find(m => m.type === "sale")
        const lastPurchase = s.product.movements.find(m => m.type === "purchase")
        const unitPrice = Number(lastSale?.unitPrice ?? lastPurchase?.unitPrice ?? 0)
        const totalVal = qty * unitPrice
        totalInventoryValue += totalVal

        const lastMovement = s.product.movements[0]
        const lastOrderStr = lastMovement
          ? new Date(lastMovement.movementDate).toLocaleDateString("es-CO")
          : "—"

        doc.setFontSize(9)
        const nameLines = doc.splitTextToSize(s.product.name, colWidths[0] - 4)
        doc.text(nameLines[0], colX[0] + 2, y)
        doc.text(String(qty), colX[1] + 2, y)
        doc.text(String(s.quantity ?? 0), colX[2] + 2, y)
        doc.text(String(s.product.minStockThreshold ?? 0), colX[3] + 2, y)
        doc.text(lastOrderStr, colX[4] + 2, y)
        doc.text(formatCurrency(unitPrice), colX[5] + 2, y)
        doc.text(formatCurrency(totalVal), colX[6] + 2, y)
        y += 7
      }

      // Total row
      y += 4
      doc.setDrawColor(200)
      doc.line(margin, y - 2, pageWidth - margin, y - 2)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text("Valor Total de Inventario:", colX[5] + 2, y + 5)
      doc.text(
        new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(totalInventoryValue),
        colX[6] + 2,
        y + 5
      )
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="inventario-${warehouseId}.pdf"`,
        "Cache-Control": "no-store"
      }
    })
  } catch (error: any) {
    console.error("Error generando PDF de inventario:", error)
    return NextResponse.json(
      { error: error.message || "Error generando PDF" },
      { status: 500 }
    )
  }
}
