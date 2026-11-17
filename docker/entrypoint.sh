#!/bin/sh
set -eu

# Keep the SQLite file and the encryption key outside the image.
data=/var/lib/fangschool
install -d -o www-data -g www-data -m 0750 "$data"
key_file="$data/app.key"
if [ ! -s "$key_file" ]; then
    umask 077
    tmp="$(mktemp "$data/.app.key.XXXXXX")"
    php -r 'echo "base64:", base64_encode(random_bytes(32)), PHP_EOL;' > "$tmp"
    mv "$tmp" "$key_file"
    umask 022
fi
APP_KEY="$(cat "$key_file")"
export APP_KEY

touch "$DB_DATABASE"
chown www-data:www-data "$DB_DATABASE"
chmod 0640 "$DB_DATABASE"
runuser -u www-data -- php artisan migrate --force --no-interaction

exec docker-php-entrypoint "$@"
