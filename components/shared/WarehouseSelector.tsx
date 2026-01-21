"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Warehouse as WarehouseIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface Warehouse {
  id: string
  name: string
}

interface WarehouseSelectorProps {
  warehouses: Warehouse[]
  selectedWarehouseId: string | null
  onSelect: (id: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function WarehouseSelector({
  warehouses,
  selectedWarehouseId,
  onSelect,
  placeholder = "Seleccionar...",
  required = false,
  disabled = false,
  className
}: WarehouseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)

  // Cerrar al hacer click fuera
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

  const handleSelectWarehouse = (id: string) => {
    onSelect(id)
    setIsOpen(false)
  }

  if (warehouses.length === 0) {
    return (
      <div className={cn(
        "flex items-center space-x-1 text-muted-foreground text-sm",
        className
      )}>
        <WarehouseIcon className="h-4 w-4 text-gray-400" />
        <span>Sin bodegas disponibles</span>
      </div>
    )
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-between gap-2 w-full h-10 px-3 py-2 text-sm",
          !selectedWarehouse && "text-muted-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <WarehouseIcon className="h-4 w-4 text-gray-600 flex-shrink-0" />
        <span className="truncate flex-1 text-left">
          {selectedWarehouse ? selectedWarehouse.name : placeholder}
        </span>
        <ChevronDown className={cn(
          "ml-1 transition-transform h-4 w-4",
          isOpen && "rotate-180"
        )} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {warehouses.map((warehouse) => (
            <button
              key={warehouse.id}
              type="button"
              onClick={() => handleSelectWarehouse(warehouse.id)}
              className={cn(
                "block w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                selectedWarehouseId === warehouse.id && "bg-primary text-primary-foreground font-semibold"
              )}
            >
              {warehouse.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
