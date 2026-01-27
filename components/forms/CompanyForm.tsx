"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { companySchema } from "@/lib/validations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Company } from "@/types"
import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import { departamentosColombia, getCiudadesByDepartamento } from "@/lib/colombia-data"

type CompanyFormData = {
  name: string
  nombreEncargado?: string
  phone?: string
  cedula?: string
  departamento?: string
  ciudad?: string
  barrio?: string
  direccion1?: string
  direccion2?: string
  alertEmails?: string[]
  enableAlerts?: boolean
}

interface CompanyFormProps {
  company?: Company
  onSuccess?: () => void
  onCancel?: () => void
}

export function CompanyForm({ company, onSuccess, onCancel }: CompanyFormProps) {
  const [emailInput, setEmailInput] = useState("")
  const [emails, setEmails] = useState<string[]>(company ? [] : [])
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>(company?.departamento || "")
  const [selectedCiudad, setSelectedCiudad] = useState<string>(company?.ciudad || "")
  const [showDepartamentoDropdown, setShowDepartamentoDropdown] = useState(false)
  const [showCiudadDropdown, setShowCiudadDropdown] = useState(false)
  const [departamentoSearch, setDepartamentoSearch] = useState("")
  const [ciudadSearch, setCiudadSearch] = useState("")
  const [nombreEncargadoModified, setNombreEncargadoModified] = useState(false)
  const departamentoRef = useRef<HTMLDivElement>(null)
  const ciudadRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company?.name || "",
      nombreEncargado: company?.nombreEncargado || company?.name || "",
      phone: company?.phone || "",
      cedula: company?.cedula || "",
      departamento: company?.departamento || "",
      ciudad: company?.ciudad || "",
      barrio: company?.barrio || "",
      direccion1: company?.direccion1 || "",
      direccion2: company?.direccion2 || "",
      enableAlerts: true
    }
  })

  const nameValue = watch("name")
  const nombreEncargadoValue = watch("nombreEncargado")
  const departamento = watch("departamento")

  // Actualizar nombreEncargado cuando cambia el nombre (solo si no ha sido modificado manualmente)
  useEffect(() => {
    if (!nombreEncargadoModified && nameValue) {
      if (!nombreEncargadoValue || nombreEncargadoValue === company?.name) {
        setValue("nombreEncargado", nameValue)
      }
    }
  }, [nameValue, setValue, company?.name, nombreEncargadoModified, nombreEncargadoValue])

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

  // Filtrar departamentos basado en búsqueda
  const departamentosFiltrados = departamentoSearch
    ? departamentosColombia.filter(dept =>
        dept.departamento.toUpperCase().startsWith(departamentoSearch.toUpperCase())
      )
    : departamentosColombia

  // Filtrar ciudades basado en búsqueda
  const ciudadesFiltradas = ciudadSearch
    ? ciudadesDisponibles.filter(ciudad =>
        ciudad.toUpperCase().startsWith(ciudadSearch.toUpperCase())
      )
    : ciudadesDisponibles

  const addEmail = () => {
    if (emailInput && !emails.includes(emailInput)) {
      const newEmails = [...emails, emailInput]
      setEmails(newEmails)
      setValue("alertEmails", newEmails)
      setEmailInput("")
    }
  }

  const removeEmail = (email: string) => {
    const newEmails = emails.filter(e => e !== email)
    setEmails(newEmails)
    setValue("alertEmails", newEmails)
  }

  const handleSelectDepartamento = (dept: string) => {
    setSelectedDepartamento(dept)
    setValue("departamento", dept)
    setSelectedCiudad("")
    setValue("ciudad", "")
    setDepartamentoSearch("")
    setShowDepartamentoDropdown(false)
  }

  const handleSelectCiudad = (ciudad: string) => {
    setSelectedCiudad(ciudad)
    setValue("ciudad", ciudad)
    setCiudadSearch("")
    setShowCiudadDropdown(false)
  }

  const onSubmit = async (data: CompanyFormData) => {
    try {
      const url = company ? `/api/companies/${company.id}` : `/api/companies`
      const method = company ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          alertEmails: emails
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error al guardar compañía")
      }

      toast.success(company ? "Compañía actualizada" : "Compañía creada exitosamente")
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "Error al guardar compañía")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Nombre de la Compañía */}
      <div>
        <Label htmlFor="name">Nombre de la Compañía *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Ej: Deportes XYZ"
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      {/* Nombre de la persona encargada */}
      <div>
        <Label htmlFor="nombreEncargado">Nombre de la persona encargada</Label>
        <Input
          id="nombreEncargado"
          {...register("nombreEncargado", {
            onChange: () => setNombreEncargadoModified(true)
          })}
          placeholder="Ej: María García (por defecto: nombre de la compañía)"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Por defecto es el mismo nombre de la compañía, pero puedes cambiarlo
        </p>
      </div>

      {/* Cédula/NIT */}
      <div>
        <Label htmlFor="cedula">Cédula/NIT</Label>
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
        <Label htmlFor="departamento">Departamento</Label>
        <div className="relative">
          <Input
            type="text"
            value={selectedDepartamento || departamentoSearch}
            onChange={(e) => {
              const value = e.target.value
              setDepartamentoSearch(value)
              if (value) {
                setSelectedDepartamento("")
                setValue("departamento", "")
                setShowDepartamentoDropdown(true)
              } else {
                setShowDepartamentoDropdown(false)
              }
            }}
            onFocus={() => {
              setShowDepartamentoDropdown(true)
              if (selectedDepartamento) {
                setDepartamentoSearch(selectedDepartamento)
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                setShowDepartamentoDropdown(false)
              }, 200)
            }}
            placeholder="Escribe para buscar (ej: RI para Risaralda)"
            className="pr-10"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        {showDepartamentoDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {departamentosFiltrados.length > 0 ? (
              departamentosFiltrados.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleSelectDepartamento(dept.departamento)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-base"
                >
                  {dept.departamento}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                No se encontraron departamentos
              </div>
            )}
          </div>
        )}
        <input type="hidden" {...register("departamento")} />
      </div>

      {/* Ciudad/Municipio */}
      <div className="relative" ref={ciudadRef}>
        <Label htmlFor="ciudad">Ciudad/Municipio</Label>
        <div className="relative">
          <Input
            type="text"
            value={selectedCiudad || ciudadSearch}
            onChange={(e) => {
              const value = e.target.value
              if (!selectedDepartamento) {
                toast.error("Primero selecciona un departamento")
                return
              }
              setCiudadSearch(value)
              if (value) {
                setSelectedCiudad("")
                setValue("ciudad", "")
                setShowCiudadDropdown(true)
              } else {
                setShowCiudadDropdown(false)
              }
            }}
            onFocus={() => {
              if (!selectedDepartamento) {
                toast.error("Primero selecciona un departamento")
                return
              }
              setShowCiudadDropdown(true)
              if (selectedCiudad) {
                setCiudadSearch(selectedCiudad)
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                setShowCiudadDropdown(false)
              }, 200)
            }}
            disabled={!selectedDepartamento}
            placeholder={selectedDepartamento ? "Escribe para buscar (ej: PE para Pereira)" : "Selecciona primero un departamento"}
            className="pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        {showCiudadDropdown && ciudadesFiltradas.length > 0 && selectedDepartamento && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {ciudadesFiltradas.map((ciudad, index) => (
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
        {showCiudadDropdown && ciudadesFiltradas.length === 0 && selectedDepartamento && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="px-4 py-2 text-sm text-muted-foreground">
              No se encontraron ciudades
            </div>
          </div>
        )}
        <input type="hidden" {...register("ciudad")} />
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

      {/* Emails para Alertas */}
      <div>
        <Label>Emails para Alertas</Label>
        <div className="flex gap-2 mb-2">
          <Input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="email@ejemplo.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addEmail()
              }
            }}
          />
          <Button type="button" onClick={addEmail} variant="outline">
            Agregar
          </Button>
        </div>
        {emails.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {emails.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Agrega emails que recibirán alertas cuando el stock esté bajo
        </p>
      </div>

      {/* Activar alertas */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="enableAlerts"
          {...register("enableAlerts")}
          className="h-4 w-4"
        />
        <Label htmlFor="enableAlerts">Activar alertas por email</Label>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Guardando..." : company ? "Actualizar" : "Crear Compañía"}
        </Button>
      </div>
    </form>
  )
}
