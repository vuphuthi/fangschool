FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.js ./
COPY resources/js ./resources/js
RUN npm run build

FROM composer:2 AS composer-bin

FROM php:8.4-apache-bookworm
WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev unzip \
    && if ! php -m | grep -qx pdo_sqlite; then docker-php-ext-install pdo_sqlite; fi \
    && docker-php-ext-install pdo_mysql \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite

COPY --from=composer-bin /usr/bin/composer /usr/local/bin/composer
COPY composer.json composer.lock ./
RUN COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --no-interaction --prefer-dist --no-progress --no-autoloader --no-scripts

COPY --chown=www-data:www-data . .
COPY --from=frontend --chown=www-data:www-data /build/public/build ./public/build
RUN COMPOSER_ALLOW_SUPERUSER=1 composer dump-autoload --no-dev --optimize --no-interaction \
    && chown -R www-data:www-data storage/framework storage/logs bootstrap/cache

COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/fangschool-entrypoint
RUN chmod 0755 /usr/local/bin/fangschool-entrypoint

ENTRYPOINT ["/usr/local/bin/fangschool-entrypoint"]
CMD ["apache2-foreground"]
