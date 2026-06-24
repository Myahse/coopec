#!/bin/sh
set -e

export API_UPSTREAM="${API_UPSTREAM:-https://coopec.djogana-pay.com:9091}"
export API_UPSTREAM_HOST="${API_UPSTREAM_HOST:-coopec.djogana-pay.com}"

envsubst '${API_UPSTREAM} ${API_UPSTREAM_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
