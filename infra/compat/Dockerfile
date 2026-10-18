FROM python:3.12-slim

# MIT, verified from the PyPI 0.0.4 wheel LICENSE. Test client only (ADR-001).
COPY requirements.txt /opt/compat/requirements.txt
RUN pip install --no-cache-dir --disable-pip-version-check --only-binary=:all: -r /opt/compat/requirements.txt \
    && pip check \
    && python -c 'from importlib.metadata import metadata, version; assert version("ltiaas") == "0.0.4"; assert metadata("ltiaas")["License"] == "MIT"'

COPY entrypoint.py /opt/compat/entrypoint.py
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ENTRYPOINT ["python", "/opt/compat/entrypoint.py"]
CMD ["python", "/tests/compat/run.py"]
