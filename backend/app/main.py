from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import SERVICE_NAME, ALLOWED_ORIGINS
from backend.app.api.routes import router

app = FastAPI(
    title=SERVICE_NAME,
    description="3D Brain MRI Tumour Subregion Segmentation & Interactive Visualization Prototype (Research / Teaching only)",
    version="0.2.0",
)

# CORS middleware for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(router)

@app.get("/")
def root():
    return {
        "service": SERVICE_NAME,
        "status": "online",
        "endpoints": {
            "health": "/health",
            "predict": "/api/predict",
        },
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
