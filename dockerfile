FROM python:3.13-slim

WORKDIR /app

# Copia os requisitos
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copia todo o conteúdo da pasta backend
COPY . .

# AJUSTE CRUCIAL: Garante que o Python enxergue a pasta atual no import
ENV PYTHONPATH=/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]