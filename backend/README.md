# NeuroScope 3D — Backend Service

FastAPI service for running MONAI BraTS SegResNet inference on multi-modal brain MRI scans.

## Setup & Running
```bash
cd "/Users/subramanyam/Aura 1"
source .venv/bin/activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Endpoints
- `GET /health`: Health check
- `POST /api/predict`: Multipart form upload with `t1`, `t1gd`, `t2`, `flair`
- `GET /api/result/{job_id}`: Job lookup
- `GET /api/sample-files/{modality}`: Local sample files
