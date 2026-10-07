from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import h3
import os

app = FastAPI(title="Raksha Mumbai ML Service")

# Load models and encoders globally
try:
    triage_model = joblib.load('artifacts/triage_model.pkl')
    le_ward = joblib.load('artifacts/le_ward.pkl')
    le_category = joblib.load('artifacts/le_category.pkl')
    hotspot_model = joblib.load('artifacts/hotspot_model.pkl')
    hotspot_features = pd.read_csv('artifacts/hotspot_latest_features.csv')
except Exception as e:
    print(f"Warning: Models not fully loaded. Run training scripts first. {e}")

class TriageRequest(BaseModel):
    hour: int
    day_of_week: int
    month: int
    lat: float
    lng: float
    ward: str
    category: str
    confidence_score: int

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "raksha-ml"}

@app.post("/triage/predict")
def predict_triage(req: TriageRequest):
    try:
        ward_enc = le_ward.transform([req.ward])[0]
    except:
        ward_enc = 0 # Default/unknown fallback
        
    try:
        cat_enc = le_category.transform([req.category])[0]
    except:
        cat_enc = 0

    features = pd.DataFrame([{
        'hour': req.hour,
        'day_of_week': req.day_of_week,
        'month': req.month,
        'lat': req.lat,
        'lng': req.lng,
        'ward': ward_enc,
        'category': cat_enc,
        'confidence_score': req.confidence_score
    }])
    
    pred = triage_model.predict(features)[0]
    # Reverse the 0-index offset back to 1-5 urgency
    urgency = int(pred) + 1
    
    return {"urgency": urgency}

@app.get("/hotspots/forecast")
def forecast_hotspots():
    try:
        # We predict for the next day for all tracked H3 cells
        X = hotspot_features[['lag_1', 'lag_7', 'rolling_7_mean']]
        preds = hotspot_model.predict(X)
        preds = [max(0, p) for p in preds] # Relu
        
        results = []
        import hashlib
        for h3_idx, pred in zip(hotspot_features['h3_res8'], preds):
            if pred > 0.1: 
                results.append({
                    "h3_index": h3_idx,
                    "expected_incidents": round(pred, 2)
                })
        
        # Sort descending
        results.sort(key=lambda x: x['expected_incidents'], reverse=True)
        return {"forecast": results[:50]} # Top 50
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
