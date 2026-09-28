# syntax=docker/dockerfile:1
#
# Support Fins is a buildless static SPA: three.js is vendored under web/vendor/
# and the whole app is plain ES modules loaded via an import map. There is no
# transpile/bundle step and no backend -- the image only needs to serve web/.
#
# nginx is used instead of the Python dev server because dev-server.py binds
# 127.0.0.1 (loopback only, unusable inside a container) and disables caching on
# purpose for development. nginx binds all interfaces and sets cache headers
# appropriate for an immutable image tag.

FROM nginx:stable-alpine

LABEL org.opencontainers.image.title="Support Fins" \
      org.opencontainers.image.description="Browser-based breakaway support-fin generator for 3D prints" \
      org.opencontainers.image.source="https://github.com/kodin00/support-fins" \
      org.opencontainers.image.license="MIT AND LGPL-2.1-only"

# Site config: port 80, canonical-root redirects (mirroring web/_redirects), and
# a cache policy that matches the dev server's no-store on the app's own
# JS/CSS/HTML while long-caching the vendored three.js tree.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The entire shipped app is static files under web/ -- which now also carries the
# vendored STEP engine (web/vendor/occt/, LGPL-2.1) and its licence texts.
COPY web/ /usr/share/nginx/html/

# MIT license -- kept in the image for license compliance.
COPY LICENSE /usr/share/licenses/support-fins/LICENSE

# LGPL-2.1 obligations for the bundled STEP engine: the licence texts travel with
# the image, next to the component itself and to the project licence. Their source
# and version are recorded in web/vendor/occt/NOTICE.md.
COPY web/vendor/occt/license.occt-import-js.txt \
     web/vendor/occt/license.occt.txt \
     web/vendor/occt/NOTICE.md \
     /usr/share/licenses/support-fins/occt/

EXPOSE 80

# The official nginx image already runs `nginx -g 'daemon off;'` as its default
# CMD, so no override is needed -- the container stays in the foreground serving
# requests.
