import os
import torch
from monai.networks.nets import SegResNet
from backend.app.core.config import MODEL_WEIGHTS_PATH, DEVICE

_model_instance = None

def get_segresnet_model(weights_path: str = None, device: torch.device = None) -> SegResNet:
    """
    Returns a loaded, evaluation-ready MONAI SegResNet model with pretrained BraTS weights.
    Caches the model instance for high efficiency.
    """
    global _model_instance
    if _model_instance is not None:
        return _model_instance

    if weights_path is None:
        weights_path = str(MODEL_WEIGHTS_PATH)
    if device is None:
        device = DEVICE

    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"Pretrained weights not found at: {weights_path}")

    model = SegResNet(
        blocks_down=[1, 2, 2, 4],
        blocks_up=[1, 1, 1],
        init_filters=16,
        in_channels=4,
        out_channels=3,
        dropout_prob=0.2,
    )
    
    state_dict = torch.load(weights_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    _model_instance = model
    return _model_instance
