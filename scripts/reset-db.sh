#!/bin/bash
set -e

echo "🗑️  Resetando banco de dados..."
echo ""

# Usar o Prisma local
node node_modules/.bin/prisma migrate reset --force --skip-seed

echo ""
echo "✅ Banco resetado com sucesso!"
echo ""
echo "📊 Criando usuário admin..."
npm run seed

echo ""
echo "🎉 Tudo pronto!"

