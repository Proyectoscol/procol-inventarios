"use client"

import { useState, useRef, useEffect } from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
// Función auxiliar para formatear fecha en formato corto
const formatShortDate = (date: Date): string => {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

interface DateRangeSelectorProps {
  from: Date
  to: Date
  onChange: (from: Date, to: Date) => void
  className?: string
}

export function DateRangeSelector({
  from,
  to,
  onChange,
  className
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    return fromDate
  })
  const [selectingStart, setSelectingStart] = useState(true)
  const [tempFrom, setTempFrom] = useState<Date | null>(null)
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Resetear estado cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setSelectingStart(true)
      setTempFrom(null)
    }
  }, [isOpen])

  // Actualizar currentMonth cuando cambia el rango
  useEffect(() => {
    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    setCurrentMonth(fromDate)
  }, [from])

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

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Días del mes anterior para completar la primera semana
    const prevMonth = new Date(year, month, 0)
    const daysInPrevMonth = prevMonth.getDate()
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false
      })
    }

    // Días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true
      })
    }

    // Días del mes siguiente para completar la última semana
    const remainingDays = 42 - days.length // 6 semanas * 7 días
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false
      })
    }

    return days
  }

  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date)
    normalized.setHours(0, 0, 0, 0)
    return normalized
  }

  const handleDateClick = (date: Date) => {
    const normalizedDate = normalizeDate(date)
    
    if (selectingStart) {
      // Seleccionar fecha de inicio
      setTempFrom(normalizedDate)
      setSelectingStart(false)
    } else {
      // Seleccionar fecha de fin
      const startDate = tempFrom || normalizeDate(from)
      
      if (normalizedDate < startDate) {
        // Si la fecha final es anterior a la inicial, intercambiar
        onChange(normalizedDate, startDate)
      } else {
        onChange(startDate, normalizedDate)
      }
      setIsOpen(false)
      setSelectingStart(true)
      setTempFrom(null)
    }
  }

  const isDateInRange = (date: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return false
    
    const normalizedDate = normalizeDate(date)
    const normalizedFrom = normalizeDate(from)
    const normalizedTo = normalizeDate(to)
    
    // Si estamos seleccionando el fin y hay una fecha de inicio temporal,
    // mostrar preview del rango desde tempFrom hasta hoveredDate o la fecha actual
    if (!selectingStart && tempFrom) {
      const tempFromNormalized = normalizeDate(tempFrom)
      const hoveredNormalized = hoveredDate ? normalizeDate(hoveredDate) : null
      
      // Si hay hover, mostrar rango desde tempFrom hasta hoveredDate
      if (hoveredNormalized) {
        if (hoveredNormalized >= tempFromNormalized) {
          return normalizedDate >= tempFromNormalized && normalizedDate <= hoveredNormalized
        } else {
          return normalizedDate >= hoveredNormalized && normalizedDate <= tempFromNormalized
        }
      }
      
      // Si no hay hover, no mostrar rango
      return false
    }
    
    // Mostrar rango establecido
    return normalizedDate >= normalizedFrom && normalizedDate <= normalizedTo
  }

  const isDateSelected = (date: Date) => {
    const normalizedDate = normalizeDate(date)
    const normalizedFrom = normalizeDate(from)
    const normalizedTo = normalizeDate(to)
    const currentFrom = tempFrom ? normalizeDate(tempFrom) : normalizedFrom
    
    // Si estamos seleccionando inicio, resaltar la fecha temporal
    if (selectingStart && tempFrom) {
      return normalizedDate.getTime() === currentFrom.getTime()
    }
    
    // Si estamos seleccionando fin, resaltar ambas fechas
    if (!selectingStart && tempFrom) {
      return normalizedDate.getTime() === currentFrom.getTime() || normalizedDate.getTime() === normalizedDate.getTime()
    }
    
    return normalizedDate.getTime() === normalizedFrom.getTime() || normalizedDate.getTime() === normalizedTo.getTime()
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const quickSelect = (preset: "today" | "thisMonth" | "lastMonth" | "last3Months" | "thisYear" | "lastYear" | "last7Days" | "last30Days") => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let newFrom: Date
    let newTo: Date = new Date(today)
    newTo.setHours(23, 59, 59, 999)

    switch (preset) {
      case "today":
        newFrom = new Date(today)
        break
      case "thisMonth":
        newFrom = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case "lastMonth":
        newFrom = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        newTo = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)
        break
      case "last3Months":
        newFrom = new Date(today.getFullYear(), today.getMonth() - 3, 1)
        break
      case "thisYear":
        newFrom = new Date(today.getFullYear(), 0, 1)
        break
      case "lastYear":
        newFrom = new Date(today.getFullYear() - 1, 0, 1)
        newTo = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
        break
      case "last7Days":
        newFrom = new Date(today)
        newFrom.setDate(today.getDate() - 6)
        break
      case "last30Days":
        newFrom = new Date(today)
        newFrom.setDate(today.getDate() - 29)
        break
    }

    onChange(newFrom, newTo)
    setIsOpen(false)
  }

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

  const days = getDaysInMonth(currentMonth)

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        <Calendar className="h-4 w-4" />
        <span className="text-sm">
          {formatShortDate(from)} - {formatShortDate(to)}
        </span>
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-[320px]">
          {/* Botones rápidos */}
          <div className="mb-4 space-y-2">
            <div className="text-xs font-semibold text-gray-600 mb-2">Períodos rápidos</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("today")}
                className="text-xs"
              >
                Hoy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("thisMonth")}
                className="text-xs"
              >
                Este mes
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("lastMonth")}
                className="text-xs"
              >
                Mes pasado
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("last7Days")}
                className="text-xs"
              >
                Últimos 7 días
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("last30Days")}
                className="text-xs"
              >
                Últimos 30 días
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("last3Months")}
                className="text-xs"
              >
                Últimos 3 meses
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("thisYear")}
                className="text-xs"
              >
                Este año
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickSelect("lastYear")}
                className="text-xs"
              >
                Año pasado
              </Button>
            </div>
          </div>

          {/* Calendario */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth("prev")}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-sm">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth("next")}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Días del mes */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const normalizedDay = normalizeDate(day.date)
                const isSelected = isDateSelected(day.date)
                const inRange = isDateInRange(day.date, day.isCurrentMonth)
                const isToday = (() => {
                  const today = normalizeDate(new Date())
                  return normalizedDay.getTime() === today.getTime()
                })()
                const isStart = (() => {
                  const currentFrom = tempFrom ? normalizeDate(tempFrom) : normalizeDate(from)
                  return normalizedDay.getTime() === currentFrom.getTime() && day.isCurrentMonth
                })()
                const isEnd = (() => {
                  if (!selectingStart && tempFrom) {
                    return false // Aún no hay fecha final seleccionada
                  }
                  return normalizedDay.getTime() === normalizeDate(to).getTime() && day.isCurrentMonth
                })()

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateClick(day.date)}
                    onMouseEnter={() => {
                      if (!selectingStart && tempFrom && day.isCurrentMonth) {
                        setHoveredDate(day.date)
                      }
                    }}
                    onMouseLeave={() => {
                      if (!selectingStart && tempFrom) {
                        setHoveredDate(null)
                      }
                    }}
                    disabled={!day.isCurrentMonth}
                    className={cn(
                      "h-8 w-8 text-xs rounded-md transition-colors relative",
                      !day.isCurrentMonth && "text-gray-300 cursor-not-allowed",
                      day.isCurrentMonth && !isSelected && !inRange && "text-gray-700 hover:bg-gray-100",
                      isSelected && "bg-primary text-white font-semibold hover:bg-primary/90 z-10",
                      inRange && !isSelected && "bg-primary/10 text-primary font-medium",
                      isToday && !isSelected && !inRange && "ring-2 ring-primary ring-offset-1",
                      isStart && "rounded-l-md",
                      isEnd && "rounded-r-md"
                    )}
                  >
                    {day.date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Instrucciones y preview */}
            <div className="mt-4 space-y-2">
              <div className="text-xs text-gray-500 text-center">
                {selectingStart 
                  ? "Selecciona la fecha de inicio" 
                  : "Selecciona la fecha de fin"}
              </div>
              {tempFrom && (
                <div className="text-xs text-center bg-blue-50 border border-blue-200 rounded p-2">
                  <span className="font-semibold text-blue-700">
                    Desde: {formatShortDate(tempFrom)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
