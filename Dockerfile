FROM node:22-alpine AS builder

WORKDIR /usr/src/app

ARG NPM_REGISTRY=https://registry.npmjs.org
# O prisma generate não liga à BD; só precisa de um URL válido
ARG DATABASE_URL=mysql://build:build@localhost:3306/build

# O Prisma precisa do OpenSSL, que a imagem alpine não traz
RUN apk add --no-cache openssl && \
    npm config set registry "$NPM_REGISTRY" && \
    npm config set fetch-timeout 600000

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# As devDependencies não vão para a imagem final
RUN npx prisma generate && \
    npm run build --if-present && \
    npm prune --omit=dev


FROM node:22-alpine

WORKDIR /usr/src/app
# Sem avisos de atualizações do npm e do Prisma (pedidos à internet a cada arranque)
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    CHECKPOINT_DISABLE=1

RUN apk add --no-cache openssl tzdata

# O código fica do root (só leitura para a API); só uploads e logs são do utilizador node
COPY --from=builder /usr/src/app ./
RUN mkdir -p logs uploads && chown node:node logs uploads

# No fim, para o commit não invalidar a cache das camadas anteriores
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

USER node
EXPOSE 3000
# Aplica as migrações, corre o seed e arranca a API (ver package.json)
CMD ["npm", "run", "start:prod"]
