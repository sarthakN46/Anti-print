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

        if ext == '.pdf':
            file_type = 'pdf'
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            page_count = len(reader.pages)
        
        elif ext in ['.docx', '.doc']:
            file_type = 'docx'
            from docx import Document
            doc = Document(file_path)
            # Try core properties first
            if doc.core_properties.page_count:
                page_count = doc.core_properties.page_count
            else:
                # Fallback: Count sections (often 1) or paragraphs? 
                # Let's default to 1 if property missing, as exact render is hard without Word.
                page_count = 1 
        
        elif ext in ['.pptx', '.ppt']:
            file_type = 'pptx'
            from pptx import Presentation
            prs = Presentation(file_path)
            page_count = len(prs.slides)
            
        elif ext in ['.png', '.jpg', '.jpeg']:
            file_type = 'image'
            page_count = 1

        print(json.dumps({"pageCount": page_count, "type": file_type}))

    except Exception as e:
        # Print error to stderr so Node.js can log it
        sys.stderr.write(f"Error analyzing file: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        # Return default JSON to stdout to avoid Node.js JSON parse error if possible, 
        # but exit code 1 will trigger fallback in Node.js anyway.
        print(json.dumps({"pageCount": 1, "type": "unknown", "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file provided"}))
        sys.exit(1)
    
    analyze_file(sys.argv[1])