FROM node:22-alpine AS api

WORKDIR /app
COPY server ./server

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server/index.js"]

FROM node:22-alpine AS frontend-build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS frontend

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist/cook/browser/ /usr/share/nginx/html/

EXPOSE 80
