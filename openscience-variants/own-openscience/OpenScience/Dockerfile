FROM python:3.12-slim AS analysis

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl r-base-core r-cran-jsonlite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM analysis AS app
COPY run.py .
COPY src ./src

EXPOSE 7070

# Bind host to 0.0.0.0 via env and set port to 7070
ENV HOST=0.0.0.0 PORT=7070

CMD ["python", "run.py"]
