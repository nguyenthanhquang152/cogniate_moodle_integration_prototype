# T8 Build Runner image: the main stack's Moodle image (erseco/alpine-moodle:v5.2.4) with its PHP dependencies
# installed at IMAGE BUILD time. Moodle 5.1+ runs `composer install` at every start; with the vendor folder already
# complete it needs no network, so a build container runs on its internal network with no internet (AC-T8-03).
# Built once by infra/scripts/build-runner.sh (the only step that downloads anything).
FROM erseco/alpine-moodle:v5.2.4
ENV COMPOSER_HOME=/tmp/composer
WORKDIR /var/www/html
RUN composer install --no-dev --classmap-authoritative --no-interaction --no-progress && rm -rf /tmp/composer
