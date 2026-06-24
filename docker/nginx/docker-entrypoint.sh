#!/bin/sh
set -e

export API_UPSTREAM="${API_UPSTREAM:-http://host.docker.internal:9091}"
export API_UPSTREAM_HOST="${API_UPSTREAM_HOST:-coopeccollect.djogana-pay.com}"
export API_PUBLIC_ORIGIN="${API_PUBLIC_ORIGIN:-https://coopeccollect.djogana-pay.com:9091}"

echo "Nginx API proxy: upstream=${API_UPSTREAM} host=${API_UPSTREAM_HOST} origin=${API_PUBLIC_ORIGIN}"

envsubst '${API_UPSTREAM} ${API_UPSTREAM_HOST} ${API_PUBLIC_ORIGIN}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
