import sys
import os
import traceback
import comtypes.client

def get_app_instance(app_name):
    """
    Try to get running instance, otherwise create new one.
    Returns (app, is_new_instance)
    """
    try:
        app = comtypes.client.GetActiveObject(app_name)
        return app, False
    except:
        app = comtypes.client.CreateObject(app_name)
        return app, True

def convert_to_pdf(input_path, output_path):
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    ext = os.path.splitext(input_path)[1].lower()

    print(f"Converting {input_path} to {output_path}...")

    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if ext in ['.docx', '.doc']:
            word, is_new = get_app_instance("Word.Application")
            if is_new:
                word.Visible = False
                word.DisplayAlerts = 0
            
            try:
                doc = word.Documents.Open(input_path, ReadOnly=True, Visible=False)
                doc.SaveAs(output_path, FileFormat=17) # 17 = wdFormatPDF
                doc.Close(SaveChanges=False)
            except Exception as e:
                # If attachment fails, might be due to modal dialogs in existing app
                raise e
            finally:
                if is_new:
                    word.Quit()
        
        elif ext in ['.pptx', '.ppt']:
            ppt, is_new = get_app_instance("Powerpoint.Application")
            # PowerPoint often requires visibility for export, but minimized works.
            # Or WithWindow=False in Open.
            if is_new:
                # Start minimized/hidden if possible
                # ppt.Visible = 1 # Required for some operations? 
                # Let's try minimizing
                pass 

            try:
                # WithWindow=0 (False) to hide
                presentation = ppt.Presentations.Open(input_path, ReadOnly=True, Untitled=False, WithWindow=0)
                presentation.SaveAs(output_path, 32) # 32 = ppSaveAsPDF
                presentation.Close()
            except Exception as e:
                raise e
            finally:
                if is_new:
                    ppt.Quit()
            
        elif ext in ['.xlsx', '.xls']:
            excel, is_new = get_app_instance("Excel.Application")
            if is_new:
                excel.Visible = False
                excel.DisplayAlerts = False
            
            try:
                wb = excel.Workbooks.Open(input_path)
                wb.ExportAsFixedFormat(0, output_path) # 0 = xlTypePDF
                wb.Close()
            finally:
                if is_new:
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