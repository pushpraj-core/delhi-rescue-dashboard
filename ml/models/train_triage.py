import pandas as pd
import numpy as np
import os
import joblib
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt
import seaborn as sns

def train_triage_model():
    print("Loading data...")
    df = pd.read_csv('data/raw/mumbai_synthetic.csv')
    
    # Feature Engineering
    features = ['hour', 'day_of_week', 'month', 'lat', 'lng', 'ward', 'category', 'confidence_score']
    target = 'urgency'
    
    X = df[features].copy()
    y = df[target] - 1  # LightGBM expects 0-indexed classes (0 to 4)
    
    # Categorical encoding
    le_ward = LabelEncoder()
    le_category = LabelEncoder()
    
    X['ward'] = le_ward.fit_transform(X['ward'])
    X['category'] = le_category.fit_transform(X['category'])
    
    # Save encoders
    os.makedirs('artifacts', exist_ok=True)
    joblib.dump(le_ward, 'artifacts/le_ward.pkl')
    joblib.dump(le_category, 'artifacts/le_category.pkl')
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training LightGBM model...")
    clf = lgb.LGBMClassifier(
        objective='multiclass',
        num_class=5,
        learning_rate=0.05,
        n_estimators=100,
        random_state=42
    )
    
    clf.fit(X_train, y_train)
    
    print("Evaluating...")
    y_pred = clf.predict(X_test)
    
    # Metrics
    report = classification_report(y_test, y_pred)
    print("Classification Report:\n", report)
    
    with open('artifacts/triage_metrics.txt', 'w') as f:
        f.write("Classification Report:\n")
        f.write(report)
        
    # Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(8,6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=[1,2,3,4,5], yticklabels=[1,2,3,4,5])
    plt.xlabel('Predicted Urgency')
    plt.ylabel('True Urgency')
    plt.title('Triage Model Confusion Matrix')
    plt.savefig('artifacts/triage_confusion_matrix.png')
    plt.close()
    
    # Feature Importance
    lgb.plot_importance(clf, importance_type='split', max_num_features=10)
    plt.title('Feature Importance')
    plt.tight_layout()
    plt.savefig('artifacts/triage_feature_importance.png')
    plt.close()
    
    # Save model
    joblib.dump(clf, 'artifacts/triage_model.pkl')
    print("Model and artifacts saved to artifacts/")

if __name__ == '__main__':
    train_triage_model()
