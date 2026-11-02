FROM node:22-alpine AS builder

WORKDIR /usr/src/app
# O Prisma precisa do OpenSSL
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# Valor fictício só para o prisma generate (exigido pelo prisma.config.ts)
ARG DATABASE_URL="mysql://build:build@localhost:3306/build"
RUN npx prisma generate && npm prune --omit=dev


FROM node:22-alpine

WORKDIR /usr/src/app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
COPY --from=builder --chown=node:node /usr/src/app .
RUN mkdir -p uploads && chown -R node:node uploads

USER node
EXPOSE 3000

# Aplica as migrações, garante o administrador e arranca a API
CMD ["npm", "run", "start:prod"]
