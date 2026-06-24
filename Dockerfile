# Build SPA (Vite)
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .


ARG VITE_API_BASE=""
ARG VITE_LOGIN_PATH="/api/auth/login-web"
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_LOGIN_PATH=$VITE_LOGIN_PATH

RUN npm run build


FROM nginx:1.27-alpine

RUN apk add --no-cache gettext

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/dist /usr/share/nginx/html

ENV API_UPSTREAM="http://host.docker.internal:9091"
ENV API_UPSTREAM_HOST="coopeccollect.djogana-pay.com"
ENV API_PUBLIC_ORIGIN="https://coopeccollect.djogana-pay.com:9091"

EXPOSE 8010

ENTRYPOINT ["/docker-entrypoint.sh"]
