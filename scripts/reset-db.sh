#!/bin/sh
set -e

echo "🗑️  Resetando banco de dados..."
echo ""

# Prisma CLI está instalado globalmente no container
prisma migrate reset --force --skip-seed

echo ""
echo "✅ Banco resetado com sucesso!"
echo ""
echo "📊 Criando usuário admin..."
npm run seed

echo ""
echo "🎉 Tudo pronto!"

