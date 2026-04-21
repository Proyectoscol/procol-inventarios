"use client"

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { QuickProductCreationModal } from "@/components/modals/QuickProductCreationModal"
import { BackButton } from "@/components/shared/BackButton"
import { EditProductModal } from "@/components/modals/EditProductModal"
import { EditThresholdModal } from "@/components/modals/EditThresholdModal"
import { ConfirmDialog } from "@/components/modals/ConfirmDialog"
import { Edit, Package, Calendar, DollarSign, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useCompany } from "@/contexts/CompanyContext"

function InventoryPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedCompanyId } = useCompany()
  const [products, setProducts] = useState<any[]>([])
  const [filteredProducts, setFilteredProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
  const [sortBy, setSortBy] = useState<"name" | "name-desc" | "stock-high" | "stock-low" | "last-purchase" | "last-sale">("name")
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productDetails, setProductDetails] = useState<Record<string, any>>({})
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editingThreshold, setEditingThreshold] = useState<any>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<any>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [inventoryValue, setInventoryValue] = useState<number | null>(null)
  const [loadingInventoryValue, setLoadingInventoryValue] = useState(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (searchParams.get("addProduct") === "1") {
      setShowAddProduct(true)
      router.replace("/dashboard/inventory", { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (selectedCompanyId) {
      fetchWarehouses(selectedCompanyId)
    }
  }, [selectedCompanyId])

  useEffect(() => {
    if (selectedCompanyId && selectedWarehouseId) {
      fetchProducts(selectedCompanyId, selectedWarehouseId)
      fetchInventoryValue(selectedWarehouseId)
    } else {
      // Limpiar productos si no hay bodega seleccionada
      setProducts([])
      setFilteredProducts([])
    }
  }, [selectedCompanyId, selectedWarehouseId])

  // Función para filtrar y ordenar productos (memoizada)
  const applyFiltersAndSort = useCallback((productsList: any[], query: string, sort: string, warehouseId: string): any[] => {
    // Primero filtrar por bodega seleccionada - solo productos que tienen stock en esta bodega
    let filtered = productsList.filter((product: any) => {
      const stock = product.stock?.find((s: any) => s.warehouseId === warehouseId)
      // Mostrar productos que tienen stock en esta bodega (incluso si es 0)
      return stock !== undefined
    })

    // Agregar currentStock a cada producto
    filtered = filtered.map((product: any) => {
      const stock = product.stock?.find((s: any) => s.warehouseId === warehouseId)
      return {
        ...product,
        currentStock: stock?.quantity ?? 0
      }
    })

    // Filtrar por búsqueda (solo si hay más de 2 caracteres)
    if (query.length >= 2) {
      const queryLower = query.toLowerCase()
      filtered = filtered.filter((product) => {
        const nameMatch = product.name?.toLowerCase().includes(queryLower)
        // Buscar por nombre (que es lo que tenemos, no hay campo "referencia" separado)
        return nameMatch
      })
    }

    // Ordenar
    let sorted = [...filtered]
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
        break
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name, "es", { sensitivity: "base" }))
        break
      case "stock-high":
        sorted.sort((a, b) => {
          const stockA = a.currentStock || 0
          const stockB = b.currentStock || 0
          if (stockB === stockA) {
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          }
          return stockB - stockA
        })
        break
      case "stock-low":
        sorted.sort((a, b) => {
          const stockA = a.currentStock || 0
          const stockB = b.currentStock || 0
          if (stockA === stockB) {
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          }
          return stockA - stockB
        })
        break
      case "last-purchase":
        sorted.sort((a, b) => {
          const dateA = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0
          const dateB = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0
          if (dateB === dateA) {
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          }
          return dateB - dateA // Más reciente primero
        })
        break
      case "last-sale":
        sorted.sort((a, b) => {
          const dateA = a.lastSaleDate ? new Date(a.lastSaleDate).getTime() : 0
          const dateB = b.lastSaleDate ? new Date(b.lastSaleDate).getTime() : 0
          if (dateB === dateA) {
            return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
          }
          return dateB - dateA // Más reciente primero
        })
        break
    }

    return sorted
  }, [])

  // Memoizar los productos filtrados para evitar re-renders innecesarios
  const filteredProductsMemo = useMemo(() => {
    if (products.length === 0) return []
    return applyFiltersAndSort(products, search, sortBy, selectedWarehouseId)
  }, [products, search, sortBy, selectedWarehouseId, applyFiltersAndSort])

  // Actualizar estado solo cuando cambie el resultado memoizado
  useEffect(() => {
    if (isMountedRef.current) {
      setFilteredProducts(filteredProductsMemo)
    }
  }, [filteredProductsMemo])

  const fetchInventoryValue = async (warehouseId: string) => {
    setLoadingInventoryValue(true)
    try {
      const res = await fetch(`/api/warehouses/${warehouseId}/inventory-value`)
      if (res.ok) {
        const data = await res.json()
        setInventoryValue(data.totalValue || 0)
      } else {
        setInventoryValue(0)
      }
    } catch (error) {
      console.error("Error cargando valor del inventario:", error)
      setInventoryValue(0)
    } finally {
      setLoadingInventoryValue(false)
    }
  }

  const fetchWarehouses = async (compId: string) => {
    try {
      const res = await fetch(`/api/companies/${compId}/warehouses`)
      if (res.ok) {
        const data = await res.json()
        
        // Obtener información de stock para cada bodega y ordenar
        const warehousesWithStock = await Promise.all(
          data.map(async (warehouse: any) => {
            try {
              const stockRes = await fetch(`/api/warehouses/${warehouse.id}/inventory-value`)
              if (stockRes.ok) {
                const stockData = await stockRes.json()
                return {
                  ...warehouse,
                  totalStock: stockData.totalItems || 0,
                  inventoryValue: stockData.totalValue || 0
                }
              }
              return {
                ...warehouse,
                totalStock: 0,
                inventoryValue: 0
              }
            } catch {
              return {
                ...warehouse,
                totalStock: 0,
                inventoryValue: 0
              }
            }
          })
        )
        
        // Ordenar: primero las que tienen inventario (totalStock > 0), luego las que tienen 0
        warehousesWithStock.sort((a, b) => {
          if (a.totalStock > 0 && b.totalStock === 0) return -1
          if (a.totalStock === 0 && b.totalStock > 0) return 1
          // Si ambas tienen o no tienen stock, ordenar por nombre
          return a.name.localeCompare(b.name)
        })
        
        setWarehouses(warehousesWithStock)
        if (warehousesWithStock.length > 0 && !selectedWarehouseId) {
          // Seleccionar la primera bodega que tenga inventario, o la primera si ninguna tiene
          const firstWithStock = warehousesWithStock.find((w: any) => w.totalStock > 0)
          setSelectedWarehouseId(firstWithStock?.id || warehousesWithStock[0].id)
        }
      }
    } catch (error) {
      console.error("Error cargando bodegas:", error)
    }
  }

  const fetchProducts = async (compId: string, warehouseId: string) => {
    try {
      const res = await fetch(
        `/api/companies/${compId}/products/inventory?warehouseId=${encodeURIComponent(warehouseId)}`
      )
      if (res.ok) {
        const data = await res.json()
        if (isMountedRef.current) {
          setProducts(data.products || [])
          setProductDetails(data.detailsByProductId || {})
        }
      }
    } catch (error) {
      console.error("Error cargando productos:", error)
    }
  }

  const handleEditProduct = (product: any) => {
    setEditingProduct(product)
  }

  const handleEditThreshold = (product: any) => {
    setEditingThreshold(product)
  }

  const handleAddStock = (product: any) => {
    // Redirigir a página de compra con producto y bodega pre-seleccionados
    router.push(`/dashboard/movements/purchase?productId=${product.id}&warehouseId=${selectedWarehouseId}`)
  }

  const handleDeleteProduct = (product: any) => {
    setProductToDelete(product)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE"
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error al eliminar producto")
      }

      const result = await res.json()
      
      toast.success(result.softDelete 
        ? "✅ Producto movido a la papelera" 
        : "✅ Producto eliminado completamente", {
        description: result.message,
        duration: 3000
      })

      // Cerrar modal y limpiar estado
      setDeleteConfirmOpen(false)
      setProductToDelete(null)

      // Refrescar lista de productos
      if (selectedCompanyId && selectedWarehouseId) {
        fetchProducts(selectedCompanyId, selectedWarehouseId)
      }
    } catch (error: any) {
      toast.error("❌ Error al eliminar producto", {
        description: error.message || "Por favor, intenta nuevamente",
        duration: 4000
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (status === "loading") {
    return <div className="p-8">Cargando...</div>
  }

  if (!selectedCompanyId) {
    return (
      <div className="p-8">
        <div className="mb-4">
          <BackButton href="/dashboard" />
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Por favor selecciona una compañía en el header para ver el inventario.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (warehouses.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-4">
          <BackButton href="/dashboard" />
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Primero necesitas crear una bodega para ver el inventario.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-4">
        <BackButton href="/dashboard" />
      </div>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventario</h1>
        {selectedCompanyId && !showAddProduct && (
          <Button onClick={() => setShowAddProduct(true)}>+ Agregar Producto</Button>
        )}
      </div>

      {/* Selector de Bodega */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Seleccionar Bodega</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label htmlFor="warehouse">Bodega</Label>
              <Select
                id="warehouse"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="">Seleccionar bodega...</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                    {warehouse.totalStock !== undefined && (
                      ` (${warehouse.totalStock > 0 ? `${warehouse.totalStock} items` : 'Sin inventario'})`
                    )}
                  </option>
                ))}
              </Select>
            </div>
            
            {/* Valor total del inventario */}
            {selectedWarehouseId && (
              <div className="bg-muted rounded-lg p-4 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-base">Valor Total del Inventario</span>
                  </div>
                  {loadingInventoryValue ? (
                    <span className="text-muted-foreground">Calculando...</span>
                  ) : (
                    <span className="text-2xl font-bold text-primary">
                      ${(inventoryValue || 0).toLocaleString("es-CO")} COP
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Basado en el último precio de compra de cada producto
                </p>
              </div>
            )}
            
            {!selectedWarehouseId && (
              <p className="text-sm text-muted-foreground">
                Selecciona una bodega para ver el inventario
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {showAddProduct && selectedCompanyId && (
        <QuickProductCreationModal
          companyId={selectedCompanyId}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name }))}
          initialWarehouseId={selectedWarehouseId || undefined}
          onSuccess={() => {
            setShowAddProduct(false)
            if (selectedCompanyId && selectedWarehouseId) {
              fetchProducts(selectedCompanyId, selectedWarehouseId)
              fetchInventoryValue(selectedWarehouseId)
            }
          }}
          onCancel={() => setShowAddProduct(false)}
        />
      )}

      {selectedWarehouseId && (
        <>
          {/* Buscador y Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Buscar y Ordenar Productos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="search">Buscar Producto</Label>
                  <Input
                    id="search"
                    placeholder="Escribe al menos 2 caracteres para buscar por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-md"
                  />
                  {search.length > 0 && search.length < 2 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Escribe al menos 2 caracteres para buscar
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="sort">Ordenar por</Label>
                  <Select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="name">Alfabéticamente (A-Z)</option>
                    <option value="name-desc">Alfabéticamente (Z-A)</option>
                    <option value="stock-high">Más Inventario</option>
                    <option value="stock-low">Menos Inventario</option>
                    <option value="last-purchase">Último Pedido</option>
                    <option value="last-sale">Vendido Más Reciente</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const stock = product.stock?.find((s: any) => s.warehouseId === selectedWarehouseId)
              const stockQuantity = stock?.quantity ?? 0 // Usar ?? para que 0 se muestre correctamente
              const isLowStock = stockQuantity < product.minStockThreshold
              const details = productDetails[product.id] || {}
              
              return (
                <Card key={product.id} className={`hover:shadow-lg transition-shadow ${isLowStock ? 'border-red-300 bg-red-50' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg flex-1">{product.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.imageBase64 && (
                      <img
                        src={product.imageBase64}
                        alt={product.name || "Producto"}
                        className="w-full h-48 object-cover rounded-md"
                        loading="lazy"
                        onError={(e) => {
                          // Ocultar imagen si falla al cargar
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    )}
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {product.description || "Sin descripción"}
                    </p>
                    
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Stock:
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                            {stockQuantity} unidades
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddStock(product)}
                            className="h-6 px-2 text-xs"
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Agregar
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Umbral mínimo:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{product.minStockThreshold} unidades</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditThreshold(product)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {details.lastPurchase && (
                        <>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Último pedido:
                            </span>
                            <span className="text-xs">
                              {new Date(details.lastPurchaseDate).toLocaleDateString("es-CO")}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Precio último pedido:
                            </span>
                            <span className="text-sm font-semibold">
                              ${details.lastPurchasePrice?.toLocaleString("es-CO")} COP
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Costo de adquisición:</span>
                            <span className="text-sm font-semibold text-blue-600">
                              ${details.lastPurchasePrice?.toLocaleString("es-CO")} COP/unidad
                            </span>
                          </div>
                        </>
                      )}

                      {isLowStock && (
                        <p className="text-xs text-red-600 font-semibold mt-2 pt-2 border-t">
                          ⚠️ Stock bajo
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredProducts.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  {search.length >= 2 
                    ? "No se encontraron productos que coincidan con la búsqueda."
                    : "No hay productos registrados."}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modales de edición */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          companyId={selectedCompanyId || ""}
          open={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            if (selectedCompanyId && selectedWarehouseId) {
              fetchProducts(selectedCompanyId, selectedWarehouseId)
            }
          }}
        />
      )}

      {editingThreshold && (
        <EditThresholdModal
          productId={editingThreshold.id}
          productName={editingThreshold.name}
          currentThreshold={editingThreshold.minStockThreshold}
          open={!!editingThreshold}
          onClose={() => setEditingThreshold(null)}
          onSuccess={() => {
            if (selectedCompanyId && selectedWarehouseId) {
              fetchProducts(selectedCompanyId, selectedWarehouseId)
            }
          }}
        />
      )}

      {/* Modal de confirmación de eliminación */}
      {productToDelete && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false)
            setProductToDelete(null)
          }}
          onConfirm={confirmDeleteProduct}
          title={`Eliminar Producto: ${productToDelete.name}`}
          description={
            (productToDelete._count?.movements > 0 || productToDelete.movements?.length > 0)
              ? `Este producto tiene ${productToDelete._count?.movements || productToDelete.movements?.length || 0} movimiento(s) histórico(s) (compras o ventas). Será movido a la papelera y podrás restaurarlo más tarde desde Configuración > Papelera. Los movimientos históricos se mantendrán intactos.`
              : `Este producto no tiene movimientos históricos. Será eliminado completamente y no podrás restaurarlo. Esta acción no se puede deshacer.`
          }
          type={(productToDelete._count?.movements > 0 || productToDelete.movements?.length > 0) ? "soft-delete" : "hard-delete"}
          loading={isDeleting}
        />
      )}
      
      {/* Botón de atrás al final */}
      <div className="mt-8 flex justify-center">
        <BackButton href="/dashboard" />
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando...</div>}>
      <InventoryPageContent />
    </Suspense>
  )
}
