#!/bin/sh
set -e

echo "🗑️  Resetando banco de dados..."
echo ""

# Usar npx prisma (funciona no Alpine)
npx prisma@6.19.0 migrate reset --force --skip-seed

echo ""
echo "✅ Banco resetado com sucesso!"
echo ""
echo "📊 Criando usuário admin..."
npm run seed

echo ""
echo "🎉 Tudo pronto!"

