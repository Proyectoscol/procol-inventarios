"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PurchaseForm } from "@/components/forms/PurchaseForm"
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
      const res = await fetch(`/api/companies/${compId}/warehouses`)
      if (res.ok) {
        const data = await res.json()
        setWarehouses(data)
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Nueva Compra</h1>
          <p className="text-muted-foreground mt-1">
            Registra una nueva compra de productos para tu inventario
          </p>
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

