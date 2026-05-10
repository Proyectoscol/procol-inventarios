"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { PurchaseForm } from "@/components/forms/PurchaseForm"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackButton } from "@/components/shared/BackButton"
import { useCompany } from "@/contexts/CompanyContext"

export default function PurchasePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedCompanyId } = useCompany()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [preselectedProductId, setPreselectedProductId] = useState<string>("")
  const [preselectedWarehouseId, setPreselectedWarehouseId] = useState<string>("")
  const isVendedor = (session?.user as any)?.userType === "VENDEDOR"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const productId = params.get("productId")
      const warehouseId = params.get("warehouseId")
      
      if (productId) setPreselectedProductId(productId)
      if (warehouseId) setPreselectedWarehouseId(warehouseId)
    }
  }, [])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchWarehouses(selectedCompanyId)
    }
  }, [selectedCompanyId])

  const fetchWarehouses = async (compId: string) => {
    try {
      // VENDEDOR only sees their assigned warehouses
      const url = isVendedor
        ? `/api/user/warehouses`
        : `/api/companies/${compId}/warehouses`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(isVendedor ? (data.warehouses || []) : data)
      }
    } catch (error) {
      console.error("Error cargando bodegas:", error)
    }
  }

  if (status === "loading" || !selectedCompanyId) {
    return <div className="p-8">Cargando...</div>
  }

  if (!selectedCompanyId) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/dashboard" />
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Por favor selecciona una compañía en el header para realizar una compra.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/dashboard" />
        </div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Nueva Compra</h1>
            <p className="text-muted-foreground mt-1">
              Registra una nueva compra de productos para tu inventario
            </p>
          </div>
          <Link
            href="/dashboard/inventory?addProduct=1"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex shrink-0 w-full sm:w-auto"
            )}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Crear producto primero
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Información de la Compra</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseForm
              companyId={selectedCompanyId}
              warehouses={warehouses}
              preselectedProductId={preselectedProductId}
              preselectedWarehouseId={preselectedWarehouseId}
              redirectOnQuickCreate={true}
              onSuccess={() => router.push("/dashboard/inventory")}
            />
          </CardContent>
        </Card>
        <div className="mt-6 flex justify-center">
          <BackButton href="/dashboard" />
        </div>
      </div>
    </div>
  )
}

