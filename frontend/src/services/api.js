const API_BASE = "http://127.0.0.1:8000";

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function predictMri({ t1File, t1gdFile, t2File, flairFile }) {
  const formData = new FormData();
  formData.append("t1", t1File);
  formData.append("t1gd", t1gdFile);
  formData.append("t2", t2File);
  formData.append("flair", flairFile);

  const res = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data?.detail?.details || data?.detail?.error || "Inference failed";
    throw new Error(errorMsg);
  }
  return data;
}

export async function fetchSampleFiles() {
  const modalities = [
    { key: "t1", name: "BraTS2021_00000_t1.nii.gz" },
    { key: "t1gd", name: "BraTS2021_00000_t1ce.nii.gz" },
    { key: "t2", name: "BraTS2021_00000_t2.nii.gz" },
    { key: "flair", name: "BraTS2021_00000_flair.nii.gz" },
  ];

  const results = {};
  for (const mod of modalities) {
    const res = await fetch(`${API_BASE}/api/sample-files/${mod.key}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch sample file for ${mod.key}`);
    }
    const blob = await res.blob();
    results[mod.key] = new File([blob], mod.name, { type: "application/gzip" });
  }
  return results;
}

export async function fetchSlice({
  jobId,
  plane,
  index,
  modality = "flair",
  showWt = true,
  showTc = true,
  showEt = true,
  wtOpacity = 0.35,
  tcOpacity = 0.65,
  etOpacity = 0.85,
}) {
  const params = new URLSearchParams({
    plane,
    index: String(index),
    modality,
    show_wt: String(showWt),
    show_tc: String(showTc),
    show_et: String(showEt),
    wt_opacity: String(wtOpacity),
    tc_opacity: String(tcOpacity),
    et_opacity: String(etOpacity),
  });

  const res = await fetch(`${API_BASE}/api/result/${jobId}/slice?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.detail || `Failed to fetch slice for ${plane} index ${index}`);
  }
  return res.json();
}
