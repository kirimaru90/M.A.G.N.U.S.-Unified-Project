FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

# Stamp the service-worker cache version from the deployed commit at build time,
# mirroring apps/cms/Dockerfile's API_BASE_URL sed. The tracked sw.js keeps the
# stable `__BUILD_ID__` placeholder; a build with no BUILD_ID falls back to `dev`.
ARG BUILD_ID=dev
RUN sed -i "s/__BUILD_ID__/${BUILD_ID}/" /usr/share/nginx/html/sw.js

# Stamp the CARTO basemap key the same way. It ships to every browser anyway —
# its protection is CARTO's per-key domain lock — but it stays out of git. An
# empty value leaves tile URLs keyless (see src/tabs/basemap.js).
ARG CARTO_BASEMAP_KEY=
RUN sed -i "s|__CARTO_BASEMAP_KEY__|${CARTO_BASEMAP_KEY}|" /usr/share/nginx/html/src/tabs/basemap.js

EXPOSE 80
