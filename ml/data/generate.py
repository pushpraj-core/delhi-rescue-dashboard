import pandas as pd
import numpy as np
import os
import random
from datetime import datetime, timedelta

MUMBAI_WARDS = ['A', 'B', 'C', 'D', 'E', 'F/N', 'F/S', 'G/N', 'G/S', 'H/E', 'H/W', 'K/E', 'K/W', 'L', 'M/E', 'M/W', 'N', 'P/N', 'P/S', 'R/C', 'R/N', 'R/S', 'S', 'T']
CATEGORIES = ['Child Labour', 'Begging', 'Lost Child', 'Trafficking', 'Abuse', 'Runaway']

def generate_mumbai_coords():
    min_lat, max_lat = 18.9, 19.3
    min_lng, max_lng = 72.8, 73.0
    return random.uniform(min_lat, max_lat), random.uniform(min_lng, max_lng)

def generate_synthetic_data(num_samples=5000):
    data = []
    
    start_date = datetime(2023, 1, 1)
    
    for _ in range(num_samples):
        # Time features
        days_offset = random.randint(0, 365)
        hours_offset = random.randint(0, 23)
        mins_offset = random.randint(0, 59)
        incident_time = start_date + timedelta(days=days_offset, hours=hours_offset, minutes=mins_offset)
        
        # Spatial features
        lat, lng = generate_mumbai_coords()
        ward = random.choice(MUMBAI_WARDS)
        
        # Core features
        category = random.choice(CATEGORIES)
        confidence_score = random.randint(30, 99)
        
        # Determine urgency (1-5, where 1 is Critical)
        urgency = 5
        if category in ['Trafficking', 'Abuse']:
            urgency = random.randint(1, 2)
        elif category == 'Child Labour':
            urgency = random.randint(2, 4)
        else:
            urgency = random.randint(3, 5)
            
        # Add some noise
        if random.random() < 0.1:
            urgency = random.randint(1, 5)
            
        data.append({
            'incident_time': incident_time,
            'hour': incident_time.hour,
            'day_of_week': incident_time.weekday(),
            'month': incident_time.month,
            'lat': lat,
            'lng': lng,
            'ward': ward,
            'category': category,
            'confidence_score': confidence_score,
            'urgency': urgency
        })
        
    df = pd.DataFrame(data)
    
    # Save to CSV
    os.makedirs('ml/data/raw', exist_ok=True)
    df.to_csv('ml/data/raw/mumbai_synthetic.csv', index=False)
    print(f"Generated {num_samples} samples and saved to ml/data/raw/mumbai_synthetic.csv")

if __name__ == '__main__':
    generate_synthetic_data(10000)
