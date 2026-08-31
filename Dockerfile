# syntax=docker/dockerfile:1

FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend /app
COPY --from=frontend /frontend/dist /frontend/dist
ENV HOST=0.0.0.0
ENV PORT=8787
ENV COLLECTOR_IN_DOCKER=1
ENV COLLECTOR_DATA=/app/data
ENV VIGIA_FRONTEND_DIST=/frontend/dist
ENV PYTHONUNBUFFERED=1
EXPOSE 8787
CMD ["python3", "-m", "app.main"]
