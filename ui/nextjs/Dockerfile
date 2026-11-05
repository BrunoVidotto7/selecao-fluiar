# Build stage runs on the builder's own architecture; runtime dependencies are
# installed again for the target architecture so native binaries match.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Next.js inlines NEXT_PUBLIC_* at build time, so the API origin must be known here.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /build/.next .next
COPY --from=build /build/next.config.mjs ./
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
USER node
EXPOSE 3000
CMD ["npm", "start"]
