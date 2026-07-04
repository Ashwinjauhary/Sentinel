FROM python:3.11-slim

WORKDIR /app

# Copy the backend requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the required spaCy NLP model
RUN python -m spacy download en_core_web_sm

# Copy the entire backend directory into the container
COPY backend/ .

# Hugging Face Spaces default port is 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port 7860"]
