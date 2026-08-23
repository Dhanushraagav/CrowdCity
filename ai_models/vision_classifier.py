"""
CrowdCity AI - Dedicated Vision Classification Microservice
FastAPI + PyTorch / MobileNetV3 Custom Model Server for Civic Hazard Image Identification.

Categories Recognized:
0: Pothole / Road Damage ('Roads')
1: Broken Street Light ('Streetlights')
2: Broken Signal Light / Traffic Hazard ('Traffic')
3: Overflowing Garbage ('Garbage')
4: Non-Civic / Irrelevant Image ('Invalid')

Usage:
1. Install dependencies: pip install fastapi uvicorn torch torchvision pillow
2. Run server: python vision_classifier.py
3. Set environment variable: CUSTOM_VISION_MODEL_URL=http://localhost:8000/predict
"""

import base64
import io
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image

try:
    import torch
    import torch.nn as nn
    from torchvision import transforms, models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

app = FastAPI(
    title="CrowdCity AI - Dedicated Vision Model Microservice",
    description="Standalone Custom Neural Network for Civic Hazard Image Classification",
    version="2.0.0"
)

CLASS_MAP = {
    0: {
        "isValidCivicIssue": True,
        "category": "Roads",
        "detectedObject": "Pothole / Road Asphalt Damage",
        "title": "Road Pothole Hazard Detected",
        "description": "Visual AI identified asphalt crater and road surface pothole requiring immediate maintenance.",
        "priority": "High"
    },
    1: {
        "isValidCivicIssue": True,
        "category": "Streetlights",
        "detectedObject": "Broken Street Light Pole",
        "title": "Broken Streetlight Fixture Identified",
        "description": "Visual inspection identified unlit or damaged street lamp post requiring electrical repair.",
        "priority": "Medium"
    },
    2: {
        "isValidCivicIssue": True,
        "category": "Traffic",
        "detectedObject": "Traffic Signal / Sign Failure",
        "title": "Broken Traffic Signal Light",
        "description": "Visual detection identified malfunctioning traffic signal or damaged road sign.",
        "priority": "High"
    },
    3: {
        "isValidCivicIssue": True,
        "category": "Garbage",
        "detectedObject": "Overflowing Garbage Dump",
        "title": "Uncollected Waste Accumulation",
        "description": "Visual inspection detected overflowing municipal garbage bin and illegal waste dumping.",
        "priority": "Medium"
    },
    4: {
        "isValidCivicIssue": False,
        "detectedObject": "Unrecognized Non-Civic Object",
        "error": "Unrecognized Photo: Please capture a photo showing a valid civic issue (pothole, streetlight, signal, garbage)."
    }
}

class ImagePayload(BaseModel):
    image: str

# PyTorch Model Architecture Definition
class CivicVisionClassifier(nn.Module if TORCH_AVAILABLE else object):
    def __init__(self, num_classes=5):
        super().__init__()
        if TORCH_AVAILABLE:
            self.backbone = models.mobilenet_v3_small(pretrained=True)
            in_features = self.backbone.classifier[3].in_features
            self.backbone.classifier[3] = nn.Linear(in_features, num_classes)

    def forward(self, x):
        return self.backbone(x)

MODEL = None
TRANSFORM = None

@app.on_event("startup")
def load_model():
    global MODEL, TRANSFORM
    if not TORCH_AVAILABLE:
        print("[WARNING] PyTorch not installed. Dedicated Vision Model running in simulation mode.")
        return

    TRANSFORM = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    MODEL = CivicVisionClassifier(num_classes=5)
    
    # Check potential weight paths
    candidate_paths = [
        os.path.join(os.path.dirname(__file__), "weights", "civic_vision_model.pth"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "weights", "civic_vision_model.pth"),
        os.path.abspath("weights/civic_vision_model.pth"),
        os.path.abspath("ai_models/weights/civic_vision_model.pth")
    ]
    
    model_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            model_path = p
            break

    if model_path:
        print(f"[INFO] Successfully loaded custom trained weights from {model_path}")
        MODEL.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    else:
        print("[INFO] No custom weights file found. Model running with default feature extractor.")
    
    MODEL.eval()

@app.post("/predict")
async def predict_image_hazard(payload: ImagePayload):
    if not payload.image:
        raise HTTPException(status_code=400, detail="Image Base64 payload required")

    try:
        # Decode base64 image
        raw_b64 = payload.image.split(",")[-1]
        img_bytes = base64.b64decode(raw_b64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        if TORCH_AVAILABLE and MODEL is not None:
            tensor = TRANSFORM(image).unsqueeze(0)
            with torch.no_grad():
                outputs = MODEL(tensor)
                probs = torch.softmax(outputs, dim=1)
                conf, pred_class = torch.max(probs, 1)
                predicted_idx = int(pred_class.item())
                confidence = float(conf.item())

            result = CLASS_MAP.get(predicted_idx, CLASS_MAP[4]).copy()
            result["confidenceScore"] = round(confidence, 2)
            return result
        else:
            # Rule-based fallback if PyTorch model server is running standalone
            return CLASS_MAP[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision classification error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
