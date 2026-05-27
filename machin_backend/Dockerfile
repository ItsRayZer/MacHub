FROM python:3.10-slim

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source code
COPY . .

# Expose port 8000
EXPOSE 8000

# Start uvicorn server — Render sets $PORT automatically
CMD ["sh", "-c", "uvicorn machin_scraper:app --host 0.0.0.0 --port ${PORT:-8000}"]
