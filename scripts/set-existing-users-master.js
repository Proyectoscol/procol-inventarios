// Script para actualizar usuarios existentes a tipo MASTER
// Versión JavaScript para ejecutar directamente con node

const { PrismaClient } = require("@prisma/client")

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
  } catch (error) {
    console.error("❌ Error actualizando usuarios:", error.message)
    // No lanzar error para no bloquear el inicio de la aplicación
    // Si hay un error, simplemente continuar
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar el script
setExistingUsersToMaster()
  .then(() => {
    console.log("✅ Script completado")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error)
    // No salir con error para no bloquear el inicio
    process.exit(0)
  })
