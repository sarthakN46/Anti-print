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
            try:
                # Primary Method: Use COM automation with Word (Accurate & supports .doc)
                import comtypes.client
                
                word_app = None
                is_new_instance = False
                
                try:
                    word_app = comtypes.client.GetActiveObject("Word.Application")
                    is_new_instance = False
                except:
                    word_app = comtypes.client.CreateObject("Word.Application")
                    is_new_instance = True
                    word_app.Visible = False
                    word_app.DisplayAlerts = 0
                
                try:
                    # Open file (ReadOnly, not visible)
                    doc = word_app.Documents.Open(file_path, ReadOnly=True, Visible=False)
                    # wdStatisticPages = 2
                    page_count = doc.ComputeStatistics(2)
                    doc.Close(SaveChanges=False)
                finally:
                    if is_new_instance and word_app:
                        word_app.Quit()

            except Exception as e:
                # Fallback method if Word automation fails
                # sys.stderr.write(f"COM Warning: {str(e)}\n") # Optional: log warning
                
                try:
                    if ext == '.doc':
                        # No pure python lib for .doc, fallback to 1
                        page_count = 1
                    else:
                        # Fallback for .docx using metadata
                        from docx import Document
                        doc = Document(file_path)
                        if doc.core_properties.page_count:
                            page_count = doc.core_properties.page_count
                        else:
                            page_count = 1
                except:
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