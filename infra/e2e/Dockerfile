# Playwright 1.56.0 (matches @playwright/test 1.56.0 in package.json) + certutil for the NSS database.
FROM mcr.microsoft.com/playwright:v1.56.0-noble@sha256:35246d87a7c88ea9b771c65d33171b2611b02a8253b4b12ce6f94376c55f99f2
RUN apt-get update \
 && apt-get install -y --no-install-recommends libnss3-tools \
 && rm -rf /var/lib/apt/lists/*
