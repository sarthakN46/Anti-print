import sys
import json
import os
import traceback

def analyze_file(file_path):
    try:
        file_path = os.path.abspath(file_path)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        page_count = 1
        file_type = 'unknown'

        # --- PDF ---
        if ext == '.pdf':
            file_type = 'pdf'
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            page_count = len(reader.pages)
        
        # --- DOCX ---
        elif ext == '.docx':
            file_type = 'docx'
            try:
                from docx import Document
                doc = Document(file_path)
                # doc.core_properties.page_count is often None/0 if not saved by Word
                # We can try to approximate or just return 1 if metadata is missing.
                # Accurate page count without Word is HARD.
                # For now, let's trust metadata or default to user input.
                if doc.core_properties.page_count:
                     page_count = doc.core_properties.page_count
                else:
                     # Approximation: 1 page per 3000 chars? Very rough.
                     # Let's keep it safe: 
                     page_count = 1 
            except Exception as e:
                # sys.stderr.write(f"Docx Error: {e}\n")
                page_count = 1

        # --- DOC (Binary) ---
        elif ext == '.doc':
             # Binary .doc is hard on Linux without LibreOffice.
             # Return 1 and let user edit.
             file_type = 'doc'
             page_count = 1

        # --- PPTX ---
        elif ext in ['.pptx', '.ppt']:
            file_type = 'pptx'
            try:
                from pptx import Presentation
                prs = Presentation(file_path)
                page_count = len(prs.slides)
            except:
                page_count = 1
        
        # --- EXCEL / CSV ---
        elif ext in ['.xlsx', '.xls', '.csv']:
            file_type = 'excel'
            page_count = 1
            
        # --- IMAGES ---
        elif ext in ['.png', '.jpg', '.jpeg']:
            file_type = 'image'
            page_count = 1

        print(json.dumps({"pageCount": page_count, "type": file_type}))

    except Exception as e:
        sys.stderr.write(f"Error analyzing file: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        # Return fallback
        print(json.dumps({"pageCount": 1, "type": "unknown", "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)
    
    analyze_file(sys.argv[1])
