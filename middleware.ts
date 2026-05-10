import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Rutas que requieren autenticación
  if (path.startsWith("/dashboard")) {
    const token = await getToken({ req: request })

    // Si no está autenticado, redirigir al login
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Si es STORE_MANAGER, restringir acceso a ciertas rutas
    if (token.userType === "STORE_MANAGER") {
      // Rutas permitidas para STORE_MANAGER
      const allowedPaths = [
        "/dashboard",
        "/dashboard/customers",
        "/dashboard/settings", // Permitir acceso a settings solo para cerrar sesión
      ]

      // Si intenta acceder a una ruta no permitida, redirigir a customers
      const isAllowed = allowedPaths.some(p => path === p || path.startsWith(p + "/"))
      
      // Si intenta acceder a subrutas de settings (excepto la página principal), bloquear
      if (path.startsWith("/dashboard/settings/") && path !== "/dashboard/settings") {
        return NextResponse.redirect(new URL("/dashboard/customers", request.url))
      }
      
      if (!isAllowed) {
        return NextResponse.redirect(new URL("/dashboard/customers", request.url))
      }
    }

    // Si es VENDEDOR, restringir acceso a ciertas rutas
    if (token.userType === "VENDEDOR") {
      // Rutas permitidas para VENDEDOR
      const allowedPaths = [
        "/dashboard",
        "/dashboard/customers",
        "/dashboard/inventory",
        "/dashboard/movements",
        "/dashboard/settings", // Solo para cerrar sesión
      ]

      // Si intenta acceder a subrutas de settings (excepto la página principal), bloquear
      if (path.startsWith("/dashboard/settings/") && path !== "/dashboard/settings") {
        return NextResponse.redirect(new URL("/dashboard/customers", request.url))
      }

      const isAllowed = allowedPaths.some(p => path === p || path.startsWith(p + "/"))

      if (!isAllowed) {
        return NextResponse.redirect(new URL("/dashboard/customers", request.url))
      }
    }
  }

  // Si el usuario está autenticado pero no tiene userType, redirigir al onboarding
  if (path.startsWith("/dashboard") && path !== "/onboarding") {
    const token = await getToken({ req: request })
    
    if (token && !token.userType) {
      return NextResponse.redirect(new URL("/onboarding", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding"]
}

