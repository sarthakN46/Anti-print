import sys
import os
import traceback

def convert_to_pdf(input_path, output_path):
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    ext = os.path.splitext(input_path)[1].lower()

    print(f"Converting {input_path} to {output_path}...")

    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if ext in ['.docx', '.doc']:
            from docx2pdf import convert
            convert(input_path, output_path)
        
        elif ext in ['.pptx', '.ppt']:
            import comtypes.client
            powerpoint = comtypes.client.CreateObject("Powerpoint.Application")
            powerpoint.Visible = 1
            deck = powerpoint.Presentations.Open(input_path)
            deck.SaveAs(output_path, 32) # 32 = ppSaveAsPDF
            deck.Close()
            powerpoint.Quit()
            
        elif ext in ['.xlsx', '.xls']:
            import comtypes.client
            excel = comtypes.client.CreateObject("Excel.Application")
            excel.Visible = 0
            wb = excel.Workbooks.Open(input_path)
            wb.ExportAsFixedFormat(0, output_path) # 0 = xlTypePDF
            wb.Close()
            excel.Quit()
            
        else:
            raise ValueError(f"Unsupported format: {ext}")

        if not os.path.exists(output_path):
            raise Exception("Output PDF was not created.")

        print("Success")

    except Exception as e:
        sys.stderr.write(f"Conversion Error: {str(e)}\n")
        sys.stderr.write(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert.py <input> <output>")
        sys.exit(1)
    
    convert_to_pdf(sys.argv[1], sys.argv[2])