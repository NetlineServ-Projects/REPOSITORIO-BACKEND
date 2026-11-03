FROM node:22-alpine AS builder

WORKDIR /usr/src/app

ARG NPM_REGISTRY=https://registry.npmjs.org
ARG DATABASE_URL=mysql://build:build@localhost:3306/build

RUN apk add --no-cache openssl && \
    npm config set registry "$NPM_REGISTRY" && \
    npm config set fetch-timeout 600000

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build --if-present


FROM node:22-alpine

WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=builder --chown=node:node /usr/src/app ./

RUN mkdir -p logs uploads && chown node:node logs uploads

USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]