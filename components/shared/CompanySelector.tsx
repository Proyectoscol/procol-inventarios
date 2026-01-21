"use client"

import { useState, useRef, useEffect } from "react"
import { Building2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CompanySelectorProps {
  companies: any[]
  selectedCompanyId: string | null
  onSelect: (companyId: string) => void
  loading?: boolean
  className?: string
}

export function CompanySelector({
  companies,
  selectedCompanyId,
  onSelect,
  loading = false,
  className
}: CompanySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const selectedCompany = companies.find(c => c.id === selectedCompanyId)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (companyId: string) => {
    onSelect(companyId)
    setIsOpen(false)
  }

  if (loading || companies.length === 0) {
    return null
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center space-x-1.5 px-2 py-1.5 rounded-md border border-gray-300",
          "bg-white hover:bg-gray-50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
          "text-sm font-medium text-gray-700",
          "min-w-0" // Permite que el contenido se trunque
        )}
        style={{ maxWidth: "100px" }} // Reducido a aproximadamente la mitad del tamaño original
      >
        <Building2 className="h-3.5 w-3.5 text-gray-600 flex-shrink-0" />
        <span className="truncate flex-1 min-w-0 text-left">
          {selectedCompany?.name || "Seleccionar"}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-gray-500 flex-shrink-0 transition-transform",
          isOpen && "transform rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => handleSelect(company.id)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                selectedCompanyId === company.id && "bg-primary/10 text-primary font-medium"
              )}
            >
              <div className="truncate">{company.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
