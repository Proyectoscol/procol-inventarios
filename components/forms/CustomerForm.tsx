"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { customerSchema } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Customer } from "@/types"
import { ContactRound, ChevronDown } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { departamentosColombia, getCiudadesByDepartamento } from "@/lib/colombia-data"

type CustomerFormData = {
  name: string
  phone?: string
  cedula?: string
  departamento?: string
  ciudad?: string
  barrio?: string
  direccion1?: string
  direccion2?: string
  address?: string
}

interface CustomerFormProps {
  companyId: string
  customer?: Customer
  onSuccess?: (customer?: Customer) => void
  onCancel?: () => void
}

export function CustomerForm({ companyId, customer, onSuccess, onCancel }: CustomerFormProps) {
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>(customer?.departamento || "")
  const [selectedCiudad, setSelectedCiudad] = useState<string>(customer?.ciudad || "")
  const [showDepartamentoDropdown, setShowDepartamentoDropdown] = useState(false)
  const [showCiudadDropdown, setShowCiudadDropdown] = useState(false)
  const departamentoRef = useRef<HTMLDivElement>(null)
  const ciudadRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name || "",
      phone: customer?.phone || "",
      cedula: customer?.cedula || "",
      departamento: customer?.departamento || "",
      ciudad: customer?.ciudad || "",
      barrio: customer?.barrio || "",
      direccion1: customer?.direccion1 || "",
      direccion2: customer?.direccion2 || "",
      address: customer?.address || ""
    }
  })

  const departamento = watch("departamento")

  // Actualizar ciudades cuando cambia el departamento
  useEffect(() => {
    if (departamento && departamento !== selectedDepartamento) {
      setSelectedDepartamento(departamento)
      setSelectedCiudad("")
      setValue("ciudad", "")
    }
  }, [departamento, selectedDepartamento, setValue])

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (departamentoRef.current && !departamentoRef.current.contains(event.target as Node)) {
        setShowDepartamentoDropdown(false)
      }
      if (ciudadRef.current && !ciudadRef.current.contains(event.target as Node)) {
        setShowCiudadDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const ciudadesDisponibles = selectedDepartamento ? getCiudadesByDepartamento(selectedDepartamento) : []

  // Verificar si la Contact Picker API está disponible
  const isContactPickerAvailable = () => {
    return 'contacts' in navigator && 'ContactsManager' in window
  }

  // Importar contacto desde el dispositivo
  const handleImportContact = async () => {
    try {
      if (!isContactPickerAvailable()) {
        toast.error("❌ Función no disponible", {
          description: "La importación de contactos no está disponible en este dispositivo o navegador. Por favor, ingresa los datos manualmente.",
          duration: 4000
        })
        return
      }

      const contactsManager = (navigator as any).contacts
      const contacts = await contactsManager.select(['name', 'tel'], {
        multiple: false
      })

      if (contacts && contacts.length > 0) {
        const contact = contacts[0]
        
        if (contact.name && contact.name.length > 0) {
          const name = Array.isArray(contact.name) ? contact.name[0] : contact.name
          setValue("name", name)
        }

        if (contact.tel && contact.tel.length > 0) {
          const phone = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel
          setValue("phone", phone)
        }

        toast.success("✅ Contacto importado", {
          description: "Los datos del contacto se han cargado en el formulario",
          duration: 3000
        })
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
        return
      }
      console.error("Error importando contacto:", error)
      toast.error("❌ Error al importar contacto", {
        description: "No se pudo importar el contacto. Por favor, ingresa los datos manualmente.",
        duration: 4000
      })
    }
  }

  const handleSelectDepartamento = (dept: string) => {
    setSelectedDepartamento(dept)
    setValue("departamento", dept)
    setSelectedCiudad("")
    setValue("ciudad", "")
    setShowDepartamentoDropdown(false)
  }

  const handleSelectCiudad = (ciudad: string) => {
    setSelectedCiudad(ciudad)
    setValue("ciudad", ciudad)
    setShowCiudadDropdown(false)
  }

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const url = customer
        ? `/api/customers/${customer.id}`
        : `/api/companies/${companyId}/customers`
      
      const method = customer ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error al guardar cliente")
      }

      const savedCustomer = await res.json()
      toast.success(customer ? "✅ Cliente actualizado" : "✅ Cliente creado exitosamente", {
        description: customer ? "Los cambios se han guardado" : "El cliente se ha agregado correctamente",
        duration: 3000
      })
      onSuccess?.(savedCustomer)
    } catch (error: any) {
      toast.error("❌ Error al guardar cliente", {
        description: error.message || "Por favor, intenta nuevamente",
        duration: 4000
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Botón para importar contacto - solo mostrar si está disponible y no es edición */}
      {!customer && isContactPickerAvailable() && (
        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleImportContact}
            className="w-full"
          >
            <ContactRound className="mr-2 h-4 w-4" />
            Importar desde Contactos
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Selecciona un contacto de tu iPhone para llenar automáticamente el formulario
          </p>
        </div>
      )}

      {/* Nombre */}
      <div>
        <Label htmlFor="name">Nombre del Cliente *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Ej: Juan Pérez"
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Cédula */}
      <div>
        <Label htmlFor="cedula">Cédula</Label>
        <Input
          id="cedula"
          {...register("cedula")}
          placeholder="Ej: 1234567890"
        />
      </div>

      {/* Teléfono */}
      <div>
        <Label htmlFor="phone">Teléfono</Label>
        <Input
          id="phone"
          type="tel"
          {...register("phone")}
          placeholder="+57 300 123 4567"
        />
      </div>

      {/* Departamento */}
      <div className="relative" ref={departamentoRef}>
        <Label htmlFor="departamento">Departamento *</Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowDepartamentoDropdown(!showDepartamentoDropdown)
              setShowCiudadDropdown(false)
            }}
            className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
              errors.departamento ? "border-red-500" : "border-input bg-background"
            }`}
          >
            <span className={selectedDepartamento ? "text-foreground" : "text-muted-foreground"}>
              {selectedDepartamento || "Seleccionar departamento"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {showDepartamentoDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {departamentosColombia.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleSelectDepartamento(dept.departamento)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-base"
                >
                  {dept.departamento}
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="hidden" {...register("departamento")} />
        {errors.departamento && (
          <p className="text-sm text-red-500 mt-1">{errors.departamento.message}</p>
        )}
      </div>

      {/* Ciudad/Municipio */}
      <div className="relative" ref={ciudadRef}>
        <Label htmlFor="ciudad">Ciudad/Municipio *</Label>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (selectedDepartamento) {
                setShowCiudadDropdown(!showCiudadDropdown)
                setShowDepartamentoDropdown(false)
              } else {
                toast.error("Primero selecciona un departamento")
              }
            }}
            disabled={!selectedDepartamento}
            className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              errors.ciudad ? "border-red-500" : "border-input bg-background"
            }`}
          >
            <span className={selectedCiudad ? "text-foreground" : "text-muted-foreground"}>
              {selectedCiudad || (selectedDepartamento ? "Seleccionar ciudad" : "Selecciona primero un departamento")}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {showCiudadDropdown && ciudadesDisponibles.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {ciudadesDisponibles.map((ciudad, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectCiudad(ciudad)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-base"
                >
                  {ciudad}
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="hidden" {...register("ciudad")} />
        {errors.ciudad && (
          <p className="text-sm text-red-500 mt-1">{errors.ciudad.message}</p>
        )}
      </div>

      {/* Barrio */}
      <div>
        <Label htmlFor="barrio">Barrio</Label>
        <Input
          id="barrio"
          {...register("barrio")}
          placeholder="Ej: El Poblado, Centro"
        />
      </div>

      {/* Dirección 1 */}
      <div>
        <Label htmlFor="direccion1">Dirección 1 (Calle, Carrera, etc.)</Label>
        <Input
          id="direccion1"
          {...register("direccion1")}
          placeholder="Ej: Calle 50 # 10-20, Carrera 7 # 45-30"
        />
      </div>

      {/* Dirección 2 */}
      <div>
        <Label htmlFor="direccion2">Dirección 2 (Edificio, Casa, etc.)</Label>
        <Input
          id="direccion2"
          {...register("direccion2")}
          placeholder="Ej: Edificio Los Rosales, Casa 5, Apto 301"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Guardando...
            </>
          ) : customer ? (
            "✅ Actualizar Cliente"
          ) : (
            "✅ Crear Cliente"
          )}
        </Button>
      </div>
    </form>
  )
}
