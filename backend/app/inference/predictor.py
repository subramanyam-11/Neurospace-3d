import torch
from monai.inferers import sliding_window_inference
from backend.app.core.config import DEVICE
from backend.app.models.segresnet import get_segresnet_model

def run_inference(tensor_input: torch.Tensor, device: torch.device = None):
    """
    Executes sliding window inference using the pretrained SegResNet model.
    Returns binary masks for WT, TC, and ET.
    """
    if device is None:
        device = DEVICE

    model = get_segresnet_model(device=device)
    print(f"[NeuroScope] Using device: {device}")
    print("[NeuroScope] Running SegResNet...")

    tensor_input = tensor_input.to(device)

    with torch.no_grad():
        H, W, D = tensor_input.shape[2:]
        # ROI size must be <= volume dimensions and multiples of 16 for SegResNet downsampling
        roi_size = (min(240, H), min(240, W), min(160, D))
        roi_size = (
            roi_size[0] - roi_size[0] % 16,
            roi_size[1] - roi_size[1] % 16,
            roi_size[2] - roi_size[2] % 16,
        )
        print(f"[NeuroScope] Inferer ROI size: {roi_size}")

        pred_logits = sliding_window_inference(
            inputs=tensor_input,
            roi_size=roi_size,
            sw_batch_size=1,
            predictor=model,
            overlap=0.25,
            mode="gaussian",
        )
        pred_sigmoid = torch.sigmoid(pred_logits)
        pred_binary = (pred_sigmoid > 0.5).float().squeeze(0).cpu().numpy()  # (3, H, W, D)

    # In MONAI brats_mri_segmentation:
    # Channel 0: TC (Tumour Core)
    # Channel 1: WT (Whole Tumour)
    # Channel 2: ET (Enhancing Tumour)
    tc_mask = pred_binary[0] > 0
    wt_mask = pred_binary[1] > 0
    et_mask = pred_binary[2] > 0

    print("[NeuroScope] Predicted mask statistics:")
    print(f"  Whole Tumour (WT) active voxels:    {wt_mask.sum():,} voxels")
    print(f"  Tumour Core (TC) active voxels:     {tc_mask.sum():,} voxels")
    print(f"  Enhancing Tumour (ET) active voxels: {et_mask.sum():,} voxels")

    return wt_mask, tc_mask, et_mask
