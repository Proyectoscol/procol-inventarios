import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      userType?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name: string
    userType?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    userType?: string | null
  }
}

