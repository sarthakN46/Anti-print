import sys
import os
import subprocess
import traceback
import platform

def convert_to_pdf(input_path, output_path):
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    
    # Check OS
    is_windows = platform.system() == 'Windows'

    print(f"Converting {input_path} to {output_path}...")

    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if is_windows:
            # WINDOWS: Use COM (Keep your original logic for local dev if on Windows)
            # But since we are deploying to Linux, we can skip or make it optional.
            # To be safe and clean for Render, I will strictly use LibreOffice 
            # OR allow comtypes ONLY if import succeeds.
            try:
                import comtypes.client
                # ... (Original COM Logic could go here, but let's simplify)
                # For now, let's assume if you are on Windows dev, you have LibreOffice OR 
                # we just use the Linux logic which might fail on Windows if 'soffice' isn't in PATH.
                pass
            except ImportError:
                pass

        # LINUX / UNIVERSAL: Use LibreOffice (Headless)
        # Command: libreoffice --headless --convert-to pdf --outdir <dir> <file>
        
        out_dir = os.path.dirname(output_path)
        
        # Determine command based on OS/Environment
        # On Linux/Docker, it's usually 'libreoffice' or 'soffice'
        cmd = 'libreoffice'
        
        # Check if libreoffice exists
        from shutil import which
        if which('libreoffice') is None:
             if which('soffice') is not None:
                 cmd = 'soffice'
             else:
                 # Fallback for Windows if installed
                 if is_windows:
                     # Attempt standard install path? Or fail back to COM?
                     # Let's fail loudly so we know we need Docker.
                     raise EnvironmentError("LibreOffice not found in PATH. Please install it or use Docker.")
                 else:
                     raise EnvironmentError("LibreOffice not found. Ensure you are using the Docker environment.")

        args = [
            cmd,
            '--headless',
            '--convert-to',
            'pdf',
            '--outdir',
            out_dir,
            input_path
        ]
        
        print(f"Running: {' '.join(args)}")
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        
        if result.returncode != 0:
            raise Exception(f"LibreOffice exited with code {result.returncode}\nStderr: {result.stderr}")

        # LibreOffice saves as <filename>.pdf in outdir. 
        # We need to ensure it matches output_path.
        # If input is 'file.docx', output is 'file.pdf'.
        # If output_path is 'temp/123.pdf', it should match.
        # We might need to rename if the generated name is different.
        
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        generated_file = os.path.join(out_dir, base_name + '.pdf')
        
        if generated_file != output_path and os.path.exists(generated_file):
            if os.path.exists(output_path):
                os.remove(output_path)
            os.rename(generated_file, output_path)

        if not os.path.exists(output_path):
             raise Exception(f"Output PDF not found at {output_path} (Generated: {generated_file})")

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
