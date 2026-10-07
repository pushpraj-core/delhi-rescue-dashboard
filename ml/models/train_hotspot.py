import pandas as pd
import numpy as np
import h3
import joblib
import os
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

def get_h3_index(lat, lng, resolution=8):
    return h3.latlng_to_cell(lat, lng, resolution)

def train_hotspot_model():
    print("Loading data for hotspot forecast...")
    df = pd.read_csv('data/raw/mumbai_synthetic.csv')
    df['incident_time'] = pd.to_datetime(df['incident_time'])
    df['date'] = df['incident_time'].dt.date
    
    # Create H3 bins
    df['h3_res8'] = df.apply(lambda row: get_h3_index(row['lat'], row['lng'], 8), axis=1)
    
    # Aggregate daily counts per cell
    daily_counts = df.groupby(['date', 'h3_res8']).size().reset_index(name='count')
    daily_counts['date'] = pd.to_datetime(daily_counts['date'])
    
    # Create a full grid of date x h3 to capture 0s
    all_dates = pd.date_range(daily_counts['date'].min(), daily_counts['date'].max(), freq='D')
    all_h3 = daily_counts['h3_res8'].unique()
    
    idx = pd.MultiIndex.from_product([all_dates, all_h3], names=['date', 'h3_res8'])
    grid = pd.DataFrame(index=idx).reset_index()
    
    merged = pd.merge(grid, daily_counts, on=['date', 'h3_res8'], how='left').fillna(0)
    merged.sort_values(['h3_res8', 'date'], inplace=True)
    
    # Feature engineering: lags
    merged['lag_1'] = merged.groupby('h3_res8')['count'].shift(1)
    merged['lag_7'] = merged.groupby('h3_res8')['count'].shift(7)
    merged['rolling_7_mean'] = merged.groupby('h3_res8')['count'].rolling(7).mean().reset_index(0, drop=True)
    
    merged.dropna(inplace=True)
    
    # Train test split (temporal)
    train = merged[merged['date'] < merged['date'].max() - pd.Timedelta(days=30)]
    test = merged[merged['date'] >= merged['date'].max() - pd.Timedelta(days=30)]
    
    features = ['lag_1', 'lag_7', 'rolling_7_mean']
    target = 'count'
    
    X_train, y_train = train[features], train[target]
    X_test, y_test = test[features], test[target]
    
    print("Training Regressor...")
    model = lgb.LGBMRegressor(n_estimators=100, learning_rate=0.05, random_state=42)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    preds = np.maximum(0, preds) # No negative incidents
    
    mae = mean_absolute_error(y_test, preds)
    print(f"Hotspot Forecast MAE: {mae:.4f}")
    
    with open('artifacts/hotspot_metrics.txt', 'w') as f:
        f.write(f"MAE: {mae:.4f}\n")
    
    joblib.dump(model, 'artifacts/hotspot_model.pkl')
    
    # Save the most recent data to use as features for the API
    latest_data = merged.groupby('h3_res8').last().reset_index()
    latest_data.to_csv('artifacts/hotspot_latest_features.csv', index=False)
    print("Hotspot model and features saved.")

if __name__ == '__main__':
    train_hotspot_model()
