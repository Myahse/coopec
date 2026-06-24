#!/bin/sh
set -e


export API_UPSTREAM="${API_UPSTREAM:-http://host.docker.internal:9091}"
export API_UPSTREAM_HOST="${API_UPSTREAM_HOST:-coopec.djogana-pay.com}"

echo "Nginx API proxy: ${API_UPSTREAM} (Host: ${API_UPSTREAM_HOST})"

envsubst '${API_UPSTREAM} ${API_UPSTREAM_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
