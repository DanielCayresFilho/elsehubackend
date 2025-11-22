# syntax=docker/dockerfile:1.7

# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Generate Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Compile seed script
RUN npx tsc prisma/seed.ts --outDir prisma --skipLibCheck

# Verify build output
RUN ls -la dist/

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Install Prisma CLI globally for migrations
RUN npm install -g prisma@6.19.0

# Copy prisma schema
COPY prisma ./prisma

# Copy Prisma Client from builder
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Copy built application and compiled seed
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma/seed.js ./prisma/seed.js

# Copy scripts
COPY scripts ./scripts
RUN chmod +x scripts/reset-db.sh

# Verify build output
RUN ls -la dist/src/ && test -f dist/src/main.js

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
