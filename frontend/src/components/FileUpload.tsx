import React, { useState, useCallback } from 'react';
import api from '../services/api';
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';

interface UploadedFile {
  storageKey: string;
  originalName: string;
  fileHash: string;
  pageCount: number;
  mimeType: string;
  fileType?: string; // New
  previewUrl?: string;
}

interface FileUploadProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  shopId?: string;
}

const FileUpload = ({ onUploadComplete, shopId }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Drag & Drop Handlers ---
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleManualSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  // --- The Upload Logic ---
  const processFiles = async (fileList: FileList) => {
    setUploading(true);
    setError(null);
    
    const uploadedFiles: UploadedFile[] = [];
    const files = Array.from(fileList);

    // Filter Allowed Types (Added PPT/PPTX)
    const validTypes = [
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'image/png', 
      'image/jpeg'
    ];
    
    const validFiles = files.filter(f => validTypes.includes(f.type));

    if (validFiles.length !== files.length) {
      setError('Some files were skipped. Only PDF, Word, PPT, and Images are supported.');
    }

    try {
      for (const file of validFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (shopId) {
           formData.append('shopId', shopId);
        }

        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Create a local preview URL
        const objectUrl = URL.createObjectURL(file);

        uploadedFiles.push({
          storageKey: data.storageKey,
          originalName: data.originalName,
          fileHash: data.fileHash,
          pageCount: data.pageCount || 1,
          mimeType: file.type,
          fileType: data.fileType, // Capture from backend
          previewUrl: objectUrl
        });
      }

      onUploadComplete(uploadedFiles);

    } catch (err) {
      console.error(err);
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-200
          ${isDragging ? 'border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50'}
          ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-primary hover:bg-white dark:hover:bg-slate-800'}
        `}
      >
        <input 
          type="file" 
          multiple 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          onChange={handleManualSelect}
          onClick={(e) => (e.currentTarget.value = '')} // RESET VALUE FIX
          disabled={uploading}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" 
        />
        
        {uploading ? (
          <div className="text-center">
            <Loader2 className="animate-spin text-primary mx-auto mb-3" size={40} />
            <p className="font-medium text-slate-700 dark:text-slate-300">Uploading & Encrypting...</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="flex justify-center gap-3 mb-3 text-slate-400 dark:text-slate-500">
              <UploadCloud size={40} />
            </div>
            <p className="font-medium text-lg text-slate-700 dark:text-slate-200">
              {isDragging ? 'Drop files here' : 'Drag & Drop files here'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">or click to browse</p>
            
            <div className="flex gap-2 justify-center mt-4 text-xs text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 py-1 px-3 rounded-full border border-slate-200 dark:border-slate-700 w-fit mx-auto">
              <span>PDF</span><span>DOC</span><span>PPT</span><span>IMG</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-3 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
          <AlertCircle size={16} /> {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;