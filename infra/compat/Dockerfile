FROM python:3.12-slim

# MIT, verified from the PyPI 0.0.4 wheel LICENSE. Test client only (ADR-001).
RUN pip install --no-cache-dir --disable-pip-version-check ltiaas==0.0.4 \
    && python -c 'from importlib.metadata import metadata, version; assert version("ltiaas") == "0.0.4"; assert metadata("ltiaas")["License"] == "MIT"'

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
CMD ["python", "/tests/compat/run.py"]
