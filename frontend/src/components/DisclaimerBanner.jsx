import React from "react";

export default function DisclaimerBanner() {
  return (
    <div className="disclaimer-banner">
      <div className="disclaimer-content">
        <span className="disclaimer-tag">Notice</span>
        <span>
          <strong>Research/teaching prototype only.</strong> The displayed region is a suspected tumour region predicted by the model and is not a medical diagnosis.
        </span>
      </div>
    </div>
  );
}
