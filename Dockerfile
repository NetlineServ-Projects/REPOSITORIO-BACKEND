FROM node:22-alpine AS builder

WORKDIR /usr/src/app
RUN npm config set registry https://registry.npmmirror.com --global && \
    npm config set fetch-timeout 600000 --global

# O Prisma precisa do OpenSSL, que a imagem alpine não traz
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
RUN DATABASE_URL="mysql://build:build@localhost:3306/build" npx prisma generate

COPY . .

RUN mkdir -p /usr/src/app/logs && \
    chown -R node:node /usr/src/app

FROM node:22-alpine

WORKDIR /usr/src/app
RUN apk add --no-cache openssl
COPY --from=builder /usr/src/app .
RUN mkdir -p logs && chown -R node:node logs

RUN mkdir -p /usr/src/app/uploads && chown -R node:node /usr/src/app/uploads


USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
