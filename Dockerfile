# ---------------
# Install Dependencies
# ---------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# node:22-alpine resolves to whatever copy the build host already has, which can predate a
# Node security release. --engine-strict fails the build below the engines floor in package.json.
RUN npm ci --engine-strict

# ---------------
# Build App
# ---------------
FROM deps AS build
WORKDIR /app
COPY . .
ENV SETUP_KEY=build-time-placeholder
RUN npm run build

# ---------------
# Release App
# ---------------
FROM node:22-alpine AS final
WORKDIR /app
RUN apk add --update --no-cache postgresql-client
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules/ ./node_modules
COPY --from=build /app/dist/ ./dist
COPY --from=build /app/proto/ ./proto
COPY --from=build /app/public/ ./public
COPY --from=build /app/scripts/ ./scripts
RUN mkdir -p /app/data/tmp
ARG SERVER_PORT=3321
EXPOSE ${SERVER_PORT}
CMD ["npm", "run", "start"]
