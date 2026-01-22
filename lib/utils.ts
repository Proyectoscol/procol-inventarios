import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  // FORZAR 'es-CO' para que una Mac en USA no ponga USD o formatos raros
  // Esto asegura que todos los dispositivos vean el mismo formato
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(amount: number): string {
  // Formato con coma como separador de miles (sin símbolo de moneda)
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, ""))
}

