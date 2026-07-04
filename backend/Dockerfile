FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download the required spaCy NLP model
RUN python -m spacy download en_core_web_sm

# Copy the rest of the backend code
COPY . .

# Start the FastAPI server using uvicorn, binding to the platform's dynamic PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
