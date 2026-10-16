import os
import torch
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
MODEL_WEIGHTS_PATH = MODELS_DIR / "brats_mri_segmentation" / "models" / "model.pt"

# Device selection: MPS for Apple Silicon GPU, CPU fallback
if torch.backends.mps.is_available():
    DEVICE = torch.device("mps")
elif torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")

# CORS Origins
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

# Service Metadata
SERVICE_NAME = "NeuroScope 3D"
DISCLAIMER = (
    "Research/teaching prototype only. The displayed region is a suspected tumour region "
    "predicted by the model and is not a medical diagnosis."
)
