"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar as CalendarIcon } from "lucide-react"

interface RangeCalendarProps {
  companyId: string
  warehouseIds?: string[]
  dateRange: { from: Date; to: Date }
  onDateSelect: (date: Date) => void
}

export function RangeCalendar({ companyId, warehouseIds = [], dateRange, onDateSelect }: RangeCalendarProps) {
  const [daysWithActivity, setDaysWithActivity] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchActivityDays()
  }, [companyId, warehouseIds, dateRange])

  const fetchActivityDays = async () => {
    if (!companyId) return
    
    setLoading(true)
    try {
      const warehouseParams = warehouseIds.length > 0 
        ? `&warehouseIds=${warehouseIds.join(",")}`
        : ""
      
      const from = new Date(dateRange.from)
      from.setHours(0, 0, 0, 0)
      const to = new Date(dateRange.to)
      to.setHours(23, 59, 59, 999)

      const res = await fetch(
        `/api/movements/calendar?companyId=${companyId}&from=${from.toISOString()}&to=${to.toISOString()}${warehouseParams}`
      )
      if (res.ok) {
        const data = await res.json()
        setDaysWithActivity(new Set(data.daysWithActivity || []))
      }
    } catch (error) {
      console.error("Error cargando días con actividad:", error)
    } finally {
      setLoading(false)
    }
  }

  const getAllDaysInRange = () => {
    const days: Date[] = []
    const current = new Date(dateRange.from)
    current.setHours(0, 0, 0, 0)
    const end = new Date(dateRange.to)
    end.setHours(23, 59, 59, 999)

    // Calcular total de días en el rango
    const totalDays = Math.ceil((end.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Si el rango es mayor a 32 días, solo mostrar días con actividad
    if (totalDays > 32) {
      // Convertir días con actividad a objetos Date
      const activityDates = Array.from(daysWithActivity).map(dateStr => {
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
      }).filter(date => {
        // Filtrar solo los que están en el rango
        return date >= current && date <= end
      }).sort((a, b) => a.getTime() - b.getTime())

      return activityDates
    }

    // Si el rango es 32 días o menos, mostrar todos los días
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }

  const formatDateKey = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const formatDayLabel = (date: Date): string => {
    return date.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short"
    })
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isInRange = (date: Date): boolean => {
    return date >= dateRange.from && date <= dateRange.to
  }

  const handleDateClick = (date: Date) => {
    onDateSelect(date)
  }

  const days = getAllDaysInRange()
  const totalDaysInRange = Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24)) + 1
  const showOnlyActivityDays = totalDaysInRange > 32
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

  // Agrupar días por semana
  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  
  if (showOnlyActivityDays) {
    // Si solo mostramos días con actividad, agruparlos de forma más compacta
    // Agrupar en semanas pero sin preocuparnos por completar semanas
    days.forEach((day, index) => {
      const dayOfWeek = day.getDay()
      
      // Si es el primer día y no empieza en domingo, agregar días vacíos
      if (index === 0 && dayOfWeek !== 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push(null as any)
        }
      }
      
      currentWeek.push(day)
      
      // Si es domingo o el último día, cerrar la semana
      if (dayOfWeek === 6 || index === days.length - 1) {
        // Completar la semana si no termina en sábado
        if (dayOfWeek !== 6 && index === days.length - 1) {
          for (let i = dayOfWeek + 1; i < 7; i++) {
            currentWeek.push(null as any)
          }
        }
        weeks.push([...currentWeek])
        currentWeek = []
      }
    })
  } else {
    // Comportamiento original: mostrar todos los días
    days.forEach((day, index) => {
      const dayOfWeek = day.getDay()
      
      // Si es el primer día y no empieza en domingo, agregar días vacíos
      if (index === 0 && dayOfWeek !== 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push(null as any)
        }
      }
      
      currentWeek.push(day)
      
      // Si es domingo o el último día, cerrar la semana
      if (dayOfWeek === 6 || index === days.length - 1) {
        // Completar la semana si no termina en sábado
        if (dayOfWeek !== 6 && index === days.length - 1) {
          for (let i = dayOfWeek + 1; i < 7; i++) {
            currentWeek.push(null as any)
          }
        }
        weeks.push([...currentWeek])
        currentWeek = []
      }
    })
  }

  return (
    <div className="w-full overflow-x-auto">
      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            Calendario de Movimientos
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {showOnlyActivityDays 
                ? `(${days.length} días con actividad de ${totalDaysInRange} días totales)`
                : `(${days.length} días)`
              }
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6">
          <div className="grid grid-cols-7 gap-1 min-w-[280px]">
            {/* Días de la semana */}
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs sm:text-sm font-semibold p-1 sm:p-2 text-muted-foreground">
                {day}
              </div>
            ))}

            {/* Días del rango */}
            {weeks.map((week, weekIdx) => (
              week.map((day, dayIdx) => {
                if (!day) {
                  return <div key={`empty-${weekIdx}-${dayIdx}`} className="aspect-square" />
                }

                const dateKey = formatDateKey(day)
                const hasActivity = daysWithActivity.has(dateKey)
                const todayClass = isToday(day) ? "ring-2 ring-primary" : ""

                return (
                  <button
                    key={dateKey}
                    onClick={() => handleDateClick(day)}
                    className={`
                      aspect-square p-1 sm:p-2 rounded-md border transition-colors
                      hover:bg-accent hover:text-accent-foreground
                      ${hasActivity ? "bg-blue-50 border-blue-200" : "border-gray-200"}
                      ${todayClass}
                      flex flex-col items-center justify-center relative
                      min-w-[32px] sm:min-w-[40px]
                    `}
                  >
                    <span className={`text-xs sm:text-sm ${isToday(day) ? "font-bold text-primary" : ""}`}>
                      {day.getDate()}
                    </span>
                    <span className="text-[8px] sm:text-[10px] text-muted-foreground mt-0.5">
                      {day.toLocaleDateString("es-CO", { month: "short" })}
                    </span>
                    {hasActivity && (
                      <span className="absolute bottom-0.5 sm:bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 sm:w-1.5 sm:h-1.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                )
              })
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
