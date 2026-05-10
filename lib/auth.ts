import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType,
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.userType = (user as any).userType
      }
      
      // Si es un refresh de sesión o no tiene userType, obtener el más reciente de la BD
      if (trigger === "update" || !token.userType) {
        if (token.id) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { 
                userType: true,
                warehouseAssignments: {
                  select: { warehouseId: true }
                }
              }
            })
            if (dbUser) {
              token.userType = dbUser.userType
              // For VENDEDOR users, include assigned warehouse IDs in JWT
              if (dbUser.userType === "VENDEDOR" && dbUser.warehouseAssignments) {
                token.warehouseIds = dbUser.warehouseAssignments.map(wa => wa.warehouseId)
              }
            }
          } catch (error) {
            console.error("Error obteniendo userType y warehouses:", error)
          }
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.userType = token.userType as string | null
        // Include warehouse IDs in session for VENDEDOR users
        if (token.warehouseIds) {
          session.user.warehouseIds = token.warehouseIds as string[]
        }
      }
      return session
    },
  },
}

