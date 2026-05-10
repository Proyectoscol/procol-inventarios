"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { SaleForm } from "@/components/forms/SaleForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BackButton } from "@/components/shared/BackButton"
import { useCompany } from "@/contexts/CompanyContext"

export default function SalePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { selectedCompanyId } = useCompany()
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const isVendedor = (session?.user as any)?.userType === "VENDEDOR"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchWarehouses(selectedCompanyId)
      fetchCustomers(selectedCompanyId)
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

  const fetchCustomers = async (compId: string) => {
    try {
      const res = await fetch(`/api/companies/${compId}/customers`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error("Error cargando clientes:", error)
    }
  }

  if (status === "loading" || !selectedCompanyId) {
    return <div className="p-8">Cargando...</div>
  }

  if (!selectedCompanyId) {
    return (
      <div className="p-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <BackButton href="/dashboard" />
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Por favor selecciona una compañía en el header para realizar una venta.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <BackButton href="/dashboard" />
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Nueva Venta</h1>
          <p className="text-muted-foreground mt-1">
            Registra una nueva venta de productos de tu inventario
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Información de la Venta</CardTitle>
          </CardHeader>
          <CardContent>
            <SaleForm
              companyId={selectedCompanyId}
              warehouses={warehouses}
              customers={customers}
              onSuccess={() => router.push("/dashboard")}
              onCustomerCreated={(newCustomer) => {
                setCustomers([...customers, newCustomer])
              }}
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

