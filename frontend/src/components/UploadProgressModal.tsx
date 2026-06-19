import { X } from 'lucide-react';

interface UploadProgressModalProps {
  current: number;
  total: number;
  percent: number;
  onCancel: () => void;
}

const UploadProgressModal = ({ current, total, percent, onCancel }: UploadProgressModalProps) => {
  return (
    <div className="upload-modal-overlay">
      <div className="upload-modal-content">
        {/* Animated Document Icon */}
        <div className="upload-icon-animated">
          <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Document body */}
            <rect x="16" y="10" width="48" height="60" rx="6" fill="#FEF9C3" stroke="#CA8A04" strokeWidth="2" />
            {/* Lines on document */}
            <rect x="26" y="28" width="28" height="3" rx="1.5" fill="#CA8A04" opacity="0.5" />
            <rect x="26" y="36" width="22" height="3" rx="1.5" fill="#CA8A04" opacity="0.5" />
            <rect x="26" y="44" width="25" height="3" rx="1.5" fill="#CA8A04" opacity="0.5" />
            {/* Green tab on top */}
            <rect x="22" y="6" width="36" height="16" rx="4" fill="#16A34A" />
            <rect x="30" y="11" width="20" height="2.5" rx="1.25" fill="white" opacity="0.8" />
            <rect x="30" y="16" width="14" height="2.5" rx="1.25" fill="white" opacity="0.5" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
          Uploading Files
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {current}/{total} files
        </p>

        {/* Progress Bar */}
        <div className="upload-progress-bar-track">
          <div
            className="upload-progress-bar-fill"
            style={{ width: `${percent}%` }}
            data-percent={`${Math.round(percent)}%`}
          />
        </div>

        <p className="text-xs text-red-500 mt-4 mb-4">
          We delete your uploaded files once delivered &nbsp;›
        </p>

        <button
          onClick={onCancel}
          className="text-red-500 font-semibold text-sm hover:text-red-600 transition-colors flex items-center gap-1 mx-auto"
        >
          <X size={14} /> Cancel Uploading
        </button>
      </div>
    </div>
  );
};

export default UploadProgressModal;
