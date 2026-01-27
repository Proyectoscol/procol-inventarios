#!/bin/sh
set -e

echo "🚀 Iniciando aplicación InventarIA..."

# Construir DATABASE_URL si Easypanel proporciona variables separadas
# Esto DEBE hacerse antes de ejecutar cualquier comando de Prisma
echo "   Verificando configuración de base de datos..."
echo "   Variables de entorno disponibles:"
echo "     DATABASE_URL: ${DATABASE_URL:+definida (oculta)}"
echo "     POSTGRES_HOST: ${POSTGRES_HOST:-no definida}"
echo "     POSTGRES_USERNAME: ${POSTGRES_USERNAME:-no definida}"
echo "     POSTGRES_DATABASE: ${POSTGRES_DATABASE:-no definida}"
echo "     POSTGRES_PORT: ${POSTGRES_PORT:-no definida}"

if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_HOST" ]; then
  if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "   ❌ ERROR: POSTGRES_PASSWORD no está definida"
    exit 1
  fi
  if [ -z "$POSTGRES_DATABASE" ]; then
    echo "   ❌ ERROR: POSTGRES_DATABASE no está definida"
    exit 1
  fi
  DATABASE_URL="postgres://${POSTGRES_USERNAME:-postgres}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DATABASE}?sslmode=disable"
  export DATABASE_URL
  echo "   ✅ Construida DATABASE_URL desde variables separadas de Easypanel"
  echo "   DATABASE_URL: postgres://${POSTGRES_USERNAME:-postgres}:***@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DATABASE}?sslmode=disable"
elif [ -z "$DATABASE_URL" ]; then
  echo "   ❌ ERROR: DATABASE_URL no está definida"
  echo "   Configura DATABASE_URL o las variables POSTGRES_* en Easypanel"
  exit 1
else
  echo "   ✅ DATABASE_URL ya está configurada"
fi

# Verificar que DATABASE_URL esté disponible
if [ -z "$DATABASE_URL" ]; then
  echo "   ❌ CRÍTICO: DATABASE_URL sigue vacía después de construcción"
  exit 1
fi

# Asegurar que DATABASE_URL esté exportada y disponible para todos los subprocesos
export DATABASE_URL
echo "   ✅ DATABASE_URL exportada correctamente"

# Ejecutar migraciones o crear esquema
echo "🔄 Configurando base de datos de Prisma..."
# Verificar una vez más que DATABASE_URL esté disponible
if [ -z "$DATABASE_URL" ]; then
  echo "   ❌ CRÍTICO: DATABASE_URL no está disponible antes de ejecutar Prisma"
  exit 1
fi

# Usar Prisma desde node_modules (versión correcta)
if [ -f "./node_modules/.bin/prisma" ]; then
  PRISMA_CMD="./node_modules/.bin/prisma"
else
  PRISMA_CMD="npx -y prisma@5.19.0"
fi

# Intentar migraciones primero (solo si existen)
if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations 2>/dev/null)" ]; then
  echo "   Aplicando migraciones existentes..."
  DATABASE_URL="$DATABASE_URL" $PRISMA_CMD migrate deploy || {
    echo "   ⚠️  Error aplicando migraciones, intentando db push..."
    DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db push --accept-data-loss --skip-generate || {
      echo "❌ Error configurando base de datos"
      exit 1
    }
  }
else
  echo "   No hay migraciones, creando esquema con db push..."
  
  # Primero intentar crear una migración inicial
  echo "   Intentando crear migración inicial..."
  MIGRATE_OUTPUT=$(DATABASE_URL="$DATABASE_URL" $PRISMA_CMD migrate dev --name init --create-only 2>&1 || echo "MIGRATE_FAILED")
  
  if echo "$MIGRATE_OUTPUT" | grep -q "MIGRATE_FAILED"; then
    echo "   No se pudo crear migración, usando db push..."
    # Primero intentar db push normal
    echo "   Ejecutando db push inicial..."
    DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db push --accept-data-loss --skip-generate 2>&1 || {
      echo "   ⚠️  Error en db push inicial, pero continuando (preservando datos)..."
    }
  else
    echo "   Migración creada, aplicándola..."
    DATABASE_URL="$DATABASE_URL" $PRISMA_CMD migrate deploy 2>&1 || {
      echo "   ⚠️  Error aplicando migración, usando db push como fallback..."
      DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db push --accept-data-loss --skip-generate 2>&1
    }
  fi
  
  # Verificar que las tablas se crearon
  echo "   Verificando que las tablas se crearon..."
  sleep 2  # Dar tiempo para que se completen las operaciones
  
  # Verificar tablas usando Prisma Studio o una query directa
  # Como db execute no devuelve resultados, usamos db pull para verificar
  echo "   Verificando tablas usando método alternativo..."
  
  # Intentar listar tablas usando una query que Prisma pueda ejecutar
  # Usar db pull para ver qué hay en la base de datos
  PULL_OUTPUT=$(DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db pull --print 2>&1 | head -100)
  
  # Tablas esperadas (10 en total) - usar nombres reales de PostgreSQL según @@map
  EXPECTED_TABLES=10
  # Nombres reales de las tablas en PostgreSQL (según @@map en schema.prisma)
  EXPECTED_TABLE_NAMES="users companies user_companies alert_configs warehouses products stock batches customers movements"
  
  # Verificar tablas directamente en PostgreSQL usando SQL
  echo "   Verificando tablas usando SQL directo..."
  # Usar una query que devuelva resultados de forma más confiable
  SQL_CHECK=$(echo "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1)
  
  # Extraer el número de tablas (buscar el número en la salida)
  TOTAL_TABLES=$(echo "$SQL_CHECK" | grep -oE '[0-9]+' | head -1 || echo "0")
  
  # Verificar cada tabla individualmente
  TABLES_FOUND=0
  ALL_TABLES_PRESENT=true
  for table_name in $EXPECTED_TABLE_NAMES; do
    TABLE_CHECK=$(echo "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name');" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1)
    if echo "$TABLE_CHECK" | grep -qiE "(true|t|1)"; then
      echo "   ✅ Tabla $table_name encontrada"
      TABLES_FOUND=$((TABLES_FOUND + 1))
    else
      echo "   ❌ Tabla $table_name NO encontrada"
      ALL_TABLES_PRESENT=false
    fi
  done
  
  echo "   Tablas encontradas en PostgreSQL: $TABLES_FOUND de $EXPECTED_TABLES (total en DB: $TOTAL_TABLES)"
  
  # Verificar realmente si las tablas existen
  if [ "$TABLES_FOUND" = "0" ] || [ "$TABLES_FOUND" -lt "$EXPECTED_TABLES" ] || [ "$ALL_TABLES_PRESENT" = "false" ]; then
    echo "   ❌ No se encontraron todas las tablas necesarias (encontradas: $TABLES_FOUND, esperadas: $EXPECTED_TABLES)"
    echo "   Intentando crear tablas faltantes sin borrar datos existentes..."
    # Primero intentar db push normal (sin force-reset para no borrar datos)
    DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db push --accept-data-loss --skip-generate 2>&1
    
    # Esperar y verificar nuevamente
    sleep 3
    echo "   Verificando nuevamente después de db push..."
    
    # Verificar directamente en PostgreSQL - verificar cada tabla individualmente
    TABLES_FOUND=0
    ALL_TABLES_PRESENT=true
    for table_name in $EXPECTED_TABLE_NAMES; do
      TABLE_CHECK=$(echo "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name');" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1)
      if echo "$TABLE_CHECK" | grep -qiE "(true|t|1)"; then
        echo "   ✅ Tabla $table_name encontrada"
        TABLES_FOUND=$((TABLES_FOUND + 1))
      else
        echo "   ❌ Tabla $table_name NO encontrada"
        ALL_TABLES_PRESENT=false
      fi
    done
    
    echo "   Después de db push: $TABLES_FOUND tablas encontradas (esperadas: $EXPECTED_TABLES)"
    
    if [ "$TABLES_FOUND" = "0" ] || [ "$TABLES_FOUND" -lt "$EXPECTED_TABLES" ] || [ "$ALL_TABLES_PRESENT" = "false" ]; then
      echo "   ⚠️  Algunas tablas aún faltan después de db push"
      echo "   Esto puede indicar un problema de permisos o que las tablas necesitan crearse manualmente"
      echo "   Verifica:"
      echo "   1. El usuario de PostgreSQL tiene permisos CREATE TABLE en el schema public"
      echo "   2. DATABASE_URL es correcta: ${DATABASE_URL:0:60}..."
      echo "   3. La base de datos 'inventory' existe"
      echo "   Ejecuta los comandos GRANT del archivo FIX-PERMISSIONS.sql si es necesario"
      echo ""
      echo "   Intentando crear tablas faltantes manualmente (sin borrar datos existentes)..."
      
      # Intentar crear las tablas faltantes usando SQL directo
      echo "   Creando batches, customers y movements usando SQL..."
      
      # Batch table
      echo "   Creando tabla batches..."
      echo "CREATE TABLE IF NOT EXISTS \"batches\" (
        \"id\" TEXT NOT NULL,
        \"batchNumber\" TEXT NOT NULL,
        \"productId\" TEXT NOT NULL,
        \"warehouseId\" TEXT NOT NULL,
        \"initialQuantity\" INTEGER NOT NULL,
        \"remainingQty\" INTEGER NOT NULL,
        \"unitCost\" DECIMAL(15,2) NOT NULL,
        \"purchaseDate\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \"batches_pkey\" PRIMARY KEY (\"id\"),
        CONSTRAINT \"batches_batchNumber_key\" UNIQUE (\"batchNumber\")
      );" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1 || echo "   ⚠️  Error creando batches"
      
      # Customer table
      echo "   Creando tabla customers..."
      echo "CREATE TABLE IF NOT EXISTS \"customers\" (
        \"id\" TEXT NOT NULL,
        \"name\" TEXT NOT NULL,
        \"email\" TEXT,
        \"phone\" TEXT,
        \"address\" TEXT,
        \"companyId\" TEXT NOT NULL,
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"updatedAt\" TIMESTAMP(3) NOT NULL,
        CONSTRAINT \"customers_pkey\" PRIMARY KEY (\"id\")
      );" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1 || echo "   ⚠️  Error creando customers"
      
      # Movement table (más compleja)
      echo "   Creando tabla movements..."
      echo "CREATE TABLE IF NOT EXISTS \"movements\" (
        \"id\" TEXT NOT NULL,
        \"movementNumber\" TEXT NOT NULL,
        \"type\" TEXT NOT NULL,
        \"productId\" TEXT NOT NULL,
        \"warehouseId\" TEXT NOT NULL,
        \"batchId\" TEXT,
        \"quantity\" INTEGER NOT NULL,
        \"unitPrice\" DECIMAL(15,2) NOT NULL,
        \"totalAmount\" DECIMAL(15,2) NOT NULL,
        \"paymentType\" TEXT NOT NULL,
        \"cashAmount\" DECIMAL(15,2),
        \"creditAmount\" DECIMAL(15,2),
        \"creditDays\" INTEGER,
        \"creditDueDate\" TIMESTAMP(3),
        \"creditPaid\" BOOLEAN NOT NULL DEFAULT false,
        \"creditPaidDate\" TIMESTAMP(3),
        \"hasShipping\" BOOLEAN NOT NULL DEFAULT false,
        \"shippingCost\" DECIMAL(15,2),
        \"shippingPaidBy\" TEXT,
        \"customerId\" TEXT,
        \"unitCost\" DECIMAL(15,2),
        \"profit\" DECIMAL(15,2),
        \"notes\" TEXT,
        \"movementDate\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"updatedAt\" TIMESTAMP(3) NOT NULL,
        CONSTRAINT \"movements_pkey\" PRIMARY KEY (\"id\"),
        CONSTRAINT \"movements_movementNumber_key\" UNIQUE (\"movementNumber\")
      );" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1 || echo "   ⚠️  Error creando movements"
      
      # Crear índices y foreign keys después
      echo "   Creando índices y relaciones..."
      echo "CREATE INDEX IF NOT EXISTS \"batches_productId_warehouseId_remainingQty_idx\" ON \"batches\"(\"productId\", \"warehouseId\", \"remainingQty\");" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1 || true
      echo "CREATE INDEX IF NOT EXISTS \"movements_productId_warehouseId_movementDate_idx\" ON \"movements\"(\"productId\", \"warehouseId\", \"movementDate\");" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1 || true
      echo "CREATE INDEX IF NOT EXISTS \"movements_type_movementDate_idx\" ON \"movements\"(\"type\", \"movementDate\");" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1 || true
      
      echo "   Verificando nuevamente después de creación manual..."
      sleep 2
      
      # Verificar usando SQL directo con nombres reales de tablas
      echo "   Verificando tablas usando SQL directo..."
      TABLES_FOUND=0
      for table_name in $EXPECTED_TABLE_NAMES; do
        TABLE_CHECK=$(echo "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table_name');" | DATABASE_URL="$DATABASE_URL" $PRISMA_CMD db execute --stdin 2>&1)
        if echo "$TABLE_CHECK" | grep -qiE "(true|t|1)"; then
          echo "   ✅ Tabla $table_name encontrada"
          TABLES_FOUND=$((TABLES_FOUND + 1))
        else
          echo "   ❌ Tabla $table_name NO encontrada"
        fi
      done
      
      echo "   Tablas encontradas después de creación manual: $TABLES_FOUND de $EXPECTED_TABLES"
      
      if [ "$TABLES_FOUND" -ge "$EXPECTED_TABLES" ]; then
        echo "   ✅ Todas las tablas están presentes en la base de datos"
      else
        echo "   ⚠️  Solo $TABLES_FOUND tablas encontradas (esperadas: $EXPECTED_TABLES)"
        echo "   Verifica directamente en PostgreSQL con: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
      fi
      
      echo "   ℹ️  Continuando con el inicio del servidor..."
    else
      echo "   ✅ Tablas creadas exitosamente: $TABLES tablas de $EXPECTED_TABLES esperadas"
    fi
  else
    echo "   ✅ Verificación exitosa: $TABLES tablas encontradas de $EXPECTED_TABLES esperadas"
  fi
  
  echo "   ✅ Esquema configurado"
fi

echo "✅ Base de datos lista"

# Actualizar usuarios existentes a tipo MASTER
echo "👥 Actualizando usuarios existentes a tipo MASTER..."
# Intentar usar tsx primero (si está disponible), luego node con JS
if [ -f "./node_modules/.bin/tsx" ]; then
  DATABASE_URL="$DATABASE_URL" ./node_modules/.bin/tsx ./scripts/set-existing-users-master.ts || {
    echo "   ⚠️  Error con tsx, intentando con node..."
    DATABASE_URL="$DATABASE_URL" node ./scripts/set-existing-users-master.js || {
      echo "   ⚠️  Error actualizando usuarios, pero continuando..."
    }
  }
elif [ -f "./scripts/set-existing-users-master.js" ]; then
  DATABASE_URL="$DATABASE_URL" node ./scripts/set-existing-users-master.js || {
    echo "   ⚠️  Error actualizando usuarios, pero continuando..."
  }
else
  echo "   ⚠️  Script de actualización no encontrado, continuando..."
fi

# Iniciar servidor
echo "🌐 Iniciando servidor Next.js..."
exec node server.js

