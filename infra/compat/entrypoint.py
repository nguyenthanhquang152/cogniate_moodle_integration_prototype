"""Check the stack CA before the QA client starts. Never print credentials or a traceback."""

import os
import sys

import requests

CA_ERROR = "the CA does not match the stack certificate; run npm run gen-env and npm run stack:up again."

def fail(message):
    print(f"Compat: {message}", file=sys.stderr)
    sys.exit(1)


try:
    response = requests.get(
        os.environ["PUBLIC_LTI_URL"].rstrip("/") + "/healthz",
        verify=os.environ["REQUESTS_CA_BUNDLE"],
        timeout=5,
        allow_redirects=False,
    )
except requests.exceptions.SSLError:
    fail(CA_ERROR)
except requests.exceptions.RequestException:
    fail("the LTI service could not be reached; run npm run stack:up and check PUBLIC_LTI_URL.")
except OSError:
    fail(CA_ERROR)

if response.status_code != 200:
    fail("the LTI health check failed; run npm run stack:up and check PUBLIC_LTI_URL.")

os.execvp(sys.argv[1], sys.argv[1:])
