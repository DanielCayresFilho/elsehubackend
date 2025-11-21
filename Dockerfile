# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

FROM base AS development
ENV NODE_ENV=development

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

CMD ["npm", "run", "start:dev"]

FROM base AS build
ENV NODE_ENV=production

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]

