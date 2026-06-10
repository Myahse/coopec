# Build SPA (Vite)
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Variables injectées au build CI (voir .gitlab-ci.yml / README)
ARG VITE_API_BASE=""
ARG VITE_LOGIN_PATH="/api/auth/login-web"
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_LOGIN_PATH=$VITE_LOGIN_PATH

RUN npm run build

# Serveur statique Nginx
FROM nginx:1.27-alpine
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8010

CMD ["nginx", "-g", "daemon off;"]
