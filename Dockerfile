# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install
COPY frontend ./frontend
RUN cd frontend && npm run build

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install
COPY backend ./backend
RUN cd backend && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /build/backend/dist ./dist
COPY --from=build /build/backend/package.json ./package.json
COPY --from=build /build/backend/package-lock.json ./package-lock.json
RUN npm install --omit=dev
COPY --from=build /build/frontend/dist /frontend/dist
ENV HOST=0.0.0.0
ENV PORT=8787
ENV COLLECTOR_IN_DOCKER=1
ENV COLLECTOR_DATA=/app/data
ENV VIGIA_FRONTEND_DIST=/frontend/dist
EXPOSE 8787
CMD ["node", "dist/main.js"]
