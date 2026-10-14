FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG API_BASE_URL=/api
RUN sed -i "s|apiBaseUrl: 'TODO'|apiBaseUrl: '${API_BASE_URL}'|" src/environments/environment.ts

# CARTO basemap key; empty leaves tile URLs keyless (see campaign-map-page.ts).
ARG CARTO_BASEMAP_KEY=
RUN sed -i "s|cartoBasemapKey: 'CARTO_KEY_TODO'|cartoBasemapKey: '${CARTO_BASEMAP_KEY}'|" src/environments/environment.ts

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/magnus-backoffice/browser /usr/share/nginx/html

EXPOSE 80
