# Raksha Mumbai ML Service

This directory contains the machine learning components for the Raksha Mumbai platform:
1. **AI Triage Model**: A LightGBM classifier that scores incoming reports (1-5 urgency) based on context, location, and AI confidence score.
2. **Hotspot Forecasting**: An H3-based time-series model that predicts where child incidents are likely to occur in the next 24 hours.

## Prerequisites
- Python 3.9+
- `pip install -r requirements.txt`

## Running the ML API

1. Navigate to the `ml/` directory:
   ```bash
   cd ml
   ```

2. Activate your virtual environment (if using one) and install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. (Optional) Re-train the models if you have new data:
   ```bash
   python models/train_triage.py
   python models/train_hotspot.py
   ```

4. Start the FastAPI server:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```

The API will run at `http://localhost:8000` and serves the `/triage/predict` and `/hotspots/forecast` endpoints.
