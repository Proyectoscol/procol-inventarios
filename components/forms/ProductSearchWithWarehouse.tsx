"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusCircle, Warehouse } from "lucide-react"

interface ProductWithWarehouse {
  id: string
  name: string
  nameLower: string
  stock: Array<{
    warehouse: {
      id: string
      name: string
    }
    quantity: number
  }>
}

interface ProductSearchWithWarehouseProps {
  companyId: string
  onSelect: (product: ProductWithWarehouse, warehouseId: string) => void
  onCreateNew?: (name: string) => void
  placeholder?: string
  disabled?: boolean
  excludedProductIds?: string[] // Array de "productId-warehouseId" para excluir
  /**
   * Cuando se provee, muestra todos los productos con el stock de ESA bodega (sin duplicar por bodega).
   * Cuando es undefined ("Todas las bodegas"), muestra cada producto en TODAS las bodegas de la lista,
   * aunque el stock sea 0.
   */
  warehouseId?: string
  /** Lista completa de bodegas accesibles para el usuario. Necesaria en modo "Todas las bodegas". */
  warehouses?: Array<{ id: string; name: string }>
}

export function ProductSearchWithWarehouse({ 
  companyId, 
  onSelect, 
  onCreateNew, 
  placeholder,
  disabled = false,
  excludedProductIds = [],
  warehouseId,
  warehouses = []
}: ProductSearchWithWarehouseProps) {
  const [search, setSearch] = useState("")
  const [allProducts, setAllProducts] = useState<ProductWithWarehouse[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithWarehouse[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const defaultPlaceholder = warehouseId
    ? "Buscar producto..."
    : "Buscar por producto o bodega..."

  const fetchAllProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/companies/${companyId}/products`)
      if (res.ok) {
        const data = await res.json()
        const sorted = data.sort((a: ProductWithWarehouse, b: ProductWithWarehouse) => 
          a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        )
        setAllProducts(sorted)
        setFilteredProducts(sorted)
      }
    } catch (error) {
      console.error("Error cargando productos:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyId) {
      fetchAllProducts()
    }
  }, [companyId])

  useEffect(() => {
    const searchLower = search.trim().toLowerCase()
    if (searchLower.length === 0) {
      setFilteredProducts(allProducts)
      return
    }
    const filtered = allProducts.filter(product => {
      if (product.nameLower.includes(searchLower)) return true
      // When showing all warehouses, also allow searching by warehouse name
      if (!warehouseId) {
        return product.stock.some(s =>
          s.warehouse.name.toLowerCase().includes(searchLower)
        )
      }
      return false
    })
    setFilteredProducts(filtered)
  }, [search, allProducts, warehouseId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (product: ProductWithWarehouse, selectedWarehouseId: string) => {
    onSelect(product, selectedWarehouseId)
    setSearch("")
    setShowResults(false)
  }

  const handleCreateNew = async () => {
    if (onCreateNew && search.trim()) {
      setLoading(true)
      try {
        await onCreateNew(search.trim())
        await fetchAllProducts()
      } catch (error) {
        console.error("Error creando producto:", error)
      } finally {
        setLoading(false)
      }
    }
  }

  // ── Render items ──────────────────────────────────────────────────────────

  const renderItems = () => {
    if (warehouseId) {
      // MODO BODEGA ESPECÍFICA: un ítem por producto con el stock de esa bodega
      return filteredProducts.map((product) => {
        const productKey = `${product.id}-${warehouseId}`
        if (excludedProductIds.includes(productKey)) return null

        const stockItem = product.stock.find(s => s.warehouse.id === warehouseId)
        const qty = stockItem?.quantity ?? 0
        const noStock = qty === 0

        return (
          <button
            key={product.id}
            type="button"
            className={`w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0 ${noStock ? "opacity-50" : ""}`}
            onClick={() => handleSelect(product, warehouseId)}
          >
            <div className="font-medium">{product.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {noStock ? "Sin stock en esta bodega" : `Stock disponible: ${qty}`}
            </div>
          </button>
        )
      }).filter(Boolean)
    }

    // MODO TODAS LAS BODEGAS: un ítem por cada bodega para cada producto.
    // Si hay stock → normal. Si no hay stock → opaco pero clicable (para poder agregar).
    // Si no tenemos la lista de bodegas, caemos al comportamiento anterior (solo stocks existentes).
    const warehouseList = warehouses.length > 0
      ? warehouses
      : [...new Map(
          filteredProducts.flatMap(p => p.stock.map(s => [s.warehouse.id, s.warehouse]))
        ).values()]

    return filteredProducts.flatMap((product) => {
      // Construir entradas con su cantidad para poder ordenarlas
      const entries = warehouseList.map((wh) => {
        const stockItem = product.stock.find(s => s.warehouse.id === wh.id)
        return { wh, qty: stockItem?.quantity ?? 0 }
      })

      // Orden: con stock desc, luego sin stock (estables entre sí)
      const sorted = [...entries].sort((a, b) => {
        if (a.qty > 0 && b.qty === 0) return -1
        if (a.qty === 0 && b.qty > 0) return 1
        return b.qty - a.qty
      })

      return sorted.map(({ wh, qty }) => {
        const productKey = `${product.id}-${wh.id}`
        if (excludedProductIds.includes(productKey)) return null

        const noStock = qty === 0

        return (
          <button
            key={productKey}
            type="button"
            className={`w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0 ${noStock ? "opacity-50" : ""}`}
            onClick={() => handleSelect(product, wh.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Warehouse className="h-3 w-3" />
                  {wh.name} • {noStock ? "Sin stock" : `Stock: ${qty}`}
                </div>
              </div>
            </div>
          </button>
        )
      }).filter(Boolean)
    })
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <Input
        placeholder={placeholder ?? defaultPlaceholder}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setShowResults(true) }}
        onFocus={() => setShowResults(true)}
        disabled={disabled}
      />

      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="p-4 text-sm text-muted-foreground text-center">Buscando...</div>
          )}

          {!loading && filteredProducts.length > 0 && (
            <div className="max-h-60 overflow-auto">
              {renderItems()}
            </div>
          )}

          {!loading && filteredProducts.length === 0 && search.length >= 1 && (
            <div className="p-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={handleCreateNew}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Crear nuevo: &quot;{search}&quot;
              </Button>
            </div>
          )}

          {!loading && filteredProducts.length === 0 && search.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No hay productos disponibles
            </div>
          )}
        </div>
      )}
    </div>
  )
}

