"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useSession } from "next-auth/react"

interface CompanyContextType {
  selectedCompanyId: string | null
  setSelectedCompanyId: (id: string | null) => void
  companies: any[]
  loading: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchCompanies()
    }
  }, [session])

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies")
      if (res.ok) {
        const data = await res.json()
        setCompanies(data)
        // Si hay compañías y no hay una seleccionada, seleccionar la primera
        if (data.length > 0 && !selectedCompanyId) {
          // Intentar obtener de localStorage primero
          const savedCompanyId = typeof window !== "undefined" 
            ? localStorage.getItem("selectedCompanyId") 
            : null
          
          if (savedCompanyId && data.find((c: any) => c.id === savedCompanyId)) {
            setSelectedCompanyId(savedCompanyId)
          } else {
            setSelectedCompanyId(data[0].id)
            if (typeof window !== "undefined") {
              localStorage.setItem("selectedCompanyId", data[0].id)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error cargando compañías:", error)
    } finally {
      setLoading(false)
    }
  }

  // Guardar en localStorage cuando cambia la compañía seleccionada
  useEffect(() => {
    if (selectedCompanyId && typeof window !== "undefined") {
      localStorage.setItem("selectedCompanyId", selectedCompanyId)
    }
  }, [selectedCompanyId])

  return (
    <CompanyContext.Provider
      value={{
        selectedCompanyId,
        setSelectedCompanyId,
        companies,
        loading
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider")
  }
  return context
}
