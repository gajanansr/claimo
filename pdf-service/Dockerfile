FROM python:3.11-slim-bookworm

# Install system dependencies for WeasyPrint
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    python3-cffi \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Chromium is used ONLY to render Uber HTML email receipts faithfully
# (reimbursement docs must be pixel-identical). It launches lazily at runtime,
# so Rapido-only reports never spawn it.
RUN playwright install chromium
RUN playwright install-deps chromium

COPY . .

# Cut glibc malloc memory retention/fragmentation for threaded Python.
# Keeps RSS from ratcheting up across requests on long-lived workers.
ENV MALLOC_ARENA_MAX=2
ENV MALLOC_TRIM_THRESHOLD_=65536
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
