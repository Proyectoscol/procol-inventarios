import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function setExistingUsersToMaster() {
  try {
    console.log("🔄 Actualizando usuarios existentes a tipo MASTER...")
    
    // Contar usuarios sin userType
    const usersWithoutType = await prisma.user.count({
      where: {
        userType: null
      }
    })
    
    if (usersWithoutType === 0) {
      console.log("✅ Todos los usuarios ya tienen un tipo asignado")
      return
    }
    
    console.log(`   Encontrados ${usersWithoutType} usuarios sin tipo asignado`)
    
    // Actualizar todos los usuarios sin userType a MASTER
    const result = await prisma.user.updateMany({
      where: {
        userType: null
      },
      data: {
        userType: "MASTER"
      }
    })
    
    console.log(`✅ ${result.count} usuarios actualizados a tipo MASTER`)
  } catch (error: any) {
    console.error("❌ Error actualizando usuarios:", error.message)
    // No lanzar error para no bloquear el inicio de la aplicación
    // Si hay un error, simplemente continuar
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  setExistingUsersToMaster()
    .then(() => {
      console.log("✅ Script completado")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Error fatal:", error)
      process.exit(1)
    })
}

export { setExistingUsersToMaster }
