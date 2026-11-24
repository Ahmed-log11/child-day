FROM python:3.11-slim

# System libraries OpenCV needs, and ffmpeg for the alert clips (H.264, plays in every browser)
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face runs containers as user 1000
RUN useradd -m -u 1000 user
WORKDIR /app

# CPU-only PyTorch first, so ultralytics doesn't pull the CUDA version
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=user app ./app
RUN chown -R user /app
USER user

# Hugging Face Spaces expects port 7860; locally docker-compose maps it to 8000
ENV PORT=7860
EXPOSE 7860
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}