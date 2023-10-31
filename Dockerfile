FROM node:18-alpine AS base

RUN ["addgroup", "--system", "--gid", "1001", "nodejs"]
RUN ["adduser" , "--system", "--uid", "1001", "nodejs"]


FROM base AS dependencies

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN ["apk", "add", "--no-cache", "libc6-compat"]
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN ["npm", "i", "-g", "pnpm"]
RUN ["pnpm", "i", "--frozen-lockfile", "--prod"]


FROM base AS build

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN ["npm", "i", "-g", "@swc/cli"]
RUN ["npm", "run", "build"]


FROM base AS runner

WORKDIR /app
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER nodejs
ENV NODE_ENV production
ENV PORT     3000
EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
