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
  const [currentMonth, setCurrentMonth] = useState(new Date(from))
  const [selectingStart, setSelectingStart] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const handleDateClick = (date: Date) => {
    if (selectingStart) {
      onChange(date, to)
      setSelectingStart(false)
    } else {
      if (date < from) {
        // Si la fecha final es anterior a la inicial, intercambiar
        onChange(date, from)
      } else {
        onChange(from, date)
      }
      setIsOpen(false)
    }
  }

  const isDateInRange = (date: Date) => {
    const dateStr = date.toDateString()
    const fromStr = from.toDateString()
    const toStr = to.toDateString()
    return dateStr >= fromStr && dateStr <= toStr
  }

  const isDateSelected = (date: Date) => {
    return date.toDateString() === from.toDateString() || date.toDateString() === to.toDateString()
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
                const isSelected = isDateSelected(day.date)
                const inRange = isDateInRange(day.date)
                const isToday = day.date.toDateString() === new Date().toDateString()

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDateClick(day.date)}
                    className={cn(
                      "h-8 w-8 text-xs rounded-md transition-colors",
                      !day.isCurrentMonth && "text-gray-300",
                      day.isCurrentMonth && "text-gray-700 hover:bg-gray-100",
                      isSelected && "bg-primary text-white font-semibold",
                      inRange && !isSelected && "bg-primary/20",
                      isToday && !isSelected && "border-2 border-primary"
                    )}
                  >
                    {day.date.getDate()}
                  </button>
                )
              })}
            </div>

            {/* Instrucciones */}
            <div className="mt-4 text-xs text-gray-500 text-center">
              {selectingStart 
                ? "Selecciona la fecha de inicio" 
                : "Selecciona la fecha de fin"}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
