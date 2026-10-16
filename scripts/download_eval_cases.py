"""
Download 10+ held-out BraTS evaluation cases from Hugging Face into isolated evaluation directory.
"""
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from huggingface_hub import hf_hub_download

EVAL_CASES = [
    "BraTS2021_00002",
    "BraTS2021_00003",
    "BraTS2021_00005",
    "BraTS2021_00006",
    "BraTS2021_00008",
    "BraTS2021_00009",
    "BraTS2021_00011",
    "BraTS2021_00012",
    "BraTS2021_00014",
    "BraTS2021_00016",
    "BraTS2021_00017",
]

REPO_ID = "rocky93/BraTS_segmentation"
LOCAL_DIR = "./evaluation/data"

def download_file(case_id, mod):
    fname = f"{case_id}/{case_id}_{mod}.nii.gz"
    dest = os.path.join(LOCAL_DIR, fname)
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return fname, "already_exists"
    path = hf_hub_download(repo_id=REPO_ID, filename=fname, repo_type="dataset", local_dir=LOCAL_DIR)
    return fname, "downloaded"

def main():
    os.makedirs(LOCAL_DIR, exist_ok=True)
    tasks = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        for case in EVAL_CASES:
            for mod in ["flair", "t1", "t1ce", "t2", "seg"]:
                tasks.append(executor.submit(download_file, case, mod))

        for future in as_completed(tasks):
            fname, status = future.result()
            print(f"[{status}] {fname}")

    print(f"Downloaded all {len(EVAL_CASES)} evaluation cases successfully.")

if __name__ == "__main__":
    main()
