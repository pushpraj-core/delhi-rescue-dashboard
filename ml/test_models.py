import pytest
import os

def test_triage_metrics():
    metrics_file = 'ml/artifacts/triage_metrics.txt'
    assert os.path.exists(metrics_file), "Triage metrics file missing"
    
    with open(metrics_file, 'r') as f:
        content = f.read()
    
    # Simple check to ensure we got some accuracy metric
    assert "accuracy" in content.lower() or "avg" in content.lower(), "Metrics missing expected evaluation strings"

def test_hotspot_metrics():
    metrics_file = 'ml/artifacts/hotspot_metrics.txt'
    assert os.path.exists(metrics_file), "Hotspot metrics file missing"
    
    with open(metrics_file, 'r') as f:
        content = f.read()
    
    # e.g., MAE: 1.234
    parts = content.strip().split(':')
    assert len(parts) == 2, "Invalid hotspot metrics format"
    mae = float(parts[1].strip())
    
    assert mae < 5.0, f"Hotspot MAE ({mae}) is suspiciously high for the synthetic generation scope."
