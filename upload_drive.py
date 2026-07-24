# upload_drive.py - Script para subir cotizaciones y certificados en PDF a Google Drive desde GitHub Actions
import os
import json
import tempfile
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    import subprocess
    import sys
    try:
        print("📦 Instalando Playwright dinámicamente...")
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
        from playwright.sync_api import sync_playwright
        PLAYWRIGHT_AVAILABLE = True
    except Exception as install_err:
        print(f"⚠️ Warning: No se pudo instalar Playwright dinámicamente ({install_err}).")
        PLAYWRIGHT_AVAILABLE = False

# ID de la carpeta raíz de Google Drive destino
ROOT_FOLDER_ID = '10eSCp_mrEjeLlMx6x6ZCxmm4XyfP_6Nz'

MESES_ES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

def get_or_create_folder(service, name, parent_id):
    """Busca una subcarpeta por nombre (insensible a mayúsculas y espacios). Si no existe, la crea."""
    clean_name = name.strip()
    clean_name_lower = clean_name.lower()

    # 1. Obtener todas las carpetas dentro de parent_id (sin filtrar por nombre en la query de Drive)
    query = (
        f"'{parent_id}' in parents "
        f"and mimeType = 'application/vnd.google-apps.folder' "
        f"and trashed = false"
    )
    
    try:
        results = service.files().list(q=query, fields="files(id, name)").execute()
        files = results.get('files', [])
        
        # 2. Búsqueda exacta insensible a mayúsculas
        for f in files:
            if f.get('name', '').strip().lower() == clean_name_lower:
                return f['id']
    except Exception as e:
        print(f"  ⚠️ Error al listar carpetas en Drive: {e}")

    # 3. No existe → crearla
    metadata = {
        'name': clean_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    folder = service.files().create(body=metadata, fields='id').execute()
    print(f"  📁 Carpeta creada: {clean_name}")
    return folder['id']


def file_exists_in_folder(service, name, folder_id):
    """Devuelve el ID del archivo si ya existe en la carpeta (insensible a mayúsculas), o None."""
    clean_name_lower = name.strip().lower()
    query = f"'{folder_id}' in parents and trashed = false"
    try:
        results = service.files().list(q=query, fields="files(id, name)").execute()
        files = results.get('files', [])
        for f in files:
            if f.get('name', '').strip().lower() == clean_name_lower:
                return f['id']
    except Exception as e:
        print(f"  ⚠️ Error al buscar archivo en Drive: {e}")
    return None


def generate_pdf_for_quote(pw, data, pdf_output_path):
    """Genera un archivo PDF exacto desde index.html utilizando Playwright."""
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 800, "height": 1100})
    page = context.new_page()

    index_abs_path = os.path.abspath("index.html")
    page.goto(f"file://{index_abs_path}")
    page.wait_for_load_state("networkidle")

    # Ejecutar la renderización de la cotización o certificado en el DOM de la página
    page.evaluate("""(data) => {
        if (typeof updatePreview === 'function') {
            updatePreview(data);
        }
    }""", data)

    # Estilos CSS específicos para forzar la exportación limpia en PDF
    page.add_style_tag(content="""
        @page { size: letter; margin: 8mm; }
        body { background: white !important; padding: 0 !important; margin: 0 !important; }
        .no-print, nav, .preview-actions, .pin-screen, .app-header { display: none !important; }
        .preview-card, .scale-wrapper { transform: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; background: white !important; }
        .quote-document-sheet, .cert-document-sheet { border: none !important; width: 100% !important; margin: 0 !important; box-shadow: none !important; }
    """)

    page.wait_for_timeout(300)

    page.pdf(
        path=pdf_output_path,
        format="Letter",
        print_background=True,
        margin={"top": "8mm", "bottom": "8mm", "left": "8mm", "right": "8mm"}
    )
    browser.close()


def upload_file_to_drive(service, local_file_path, drive_filename, folder_id, mime_type):
    """Sube o actualiza un archivo en Google Drive."""
    existing_id = file_exists_in_folder(service, drive_filename, folder_id)
    media = MediaFileUpload(local_file_path, mimetype=mime_type)

    if existing_id:
        print(f"  ℹ️  Ya existe {drive_filename} en Drive. Actualizando...")
        service.files().update(
            fileId=existing_id,
            media_body=media
        ).execute()
        print(f"  ✅ {drive_filename} actualizado.")
    else:
        print(f"  ⬆️  Subiendo {drive_filename} a Drive...")
        file_metadata = {
            'name': drive_filename,
            'parents': [folder_id]
        }
        uploaded = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        print(f"  ✅ Subido con éxito. ID: {uploaded.get('id')}")


def main():
    # 1. Cargar credenciales desde la variable de entorno de GitHub Secrets
    creds_json = os.environ.get('GCP_SERVICE_ACCOUNT_KEY')
    if not creds_json:
        print("❌ Error: No se encontró la variable GCP_SERVICE_ACCOUNT_KEY.")
        return

    info = json.loads(creds_json)
    creds = service_account.Credentials.from_service_account_info(
        info,
        scopes=['https://www.googleapis.com/auth/drive']
    )
    service = build('drive', 'v3', credentials=creds)

    # 2. Buscar archivos JSON de cotizaciones en la carpeta local 'cotizaciones/'
    local_dir = 'cotizaciones'
    if not os.path.exists(local_dir):
        print("No hay carpeta 'cotizaciones/' local. Nada que subir.")
        return

    json_files = [f for f in os.listdir(local_dir) if f.endswith('.json')]
    if not json_files:
        print("No hay archivos JSON en 'cotizaciones/'. Nada que subir.")
        return

    print(f"📂 Procesando {len(json_files)} documento(s)...")

    pw_instance = None
    pw_manager = None
    if PLAYWRIGHT_AVAILABLE:
        try:
            pw_manager = sync_playwright()
            pw_instance = pw_manager.start()
        except Exception as pw_init_err:
            print(f"⚠️ Warning: No se pudo iniciar Playwright ({pw_init_err}). Continuando con subida en Drive...")
            pw_instance = None

    with tempfile.TemporaryDirectory() as temp_dir:
        for filename in json_files:
            file_path = os.path.join(local_dir, filename)

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except Exception as e:
                print(f"  ⚠️  Error al leer {filename}: {e}")
                continue

            # Extraer datos para la jerarquía de carpetas
            cliente = data.get('cliente', 'Sin_Cliente').strip().replace('/', '-').replace('\\', '-')
            is_cert = data.get('tipo') == 'certificado'
            fecha_str = data.get('fecha-aplicacion', '') if is_cert else data.get('fecha', '')

            # Parsear la fecha
            try:
                if fecha_str and '-' in fecha_str and len(fecha_str) == 10:
                    dt = datetime.strptime(fecha_str, '%Y-%m-%d')
                elif 'de' in fecha_str.lower():
                    parts = fecha_str.lower().split(' de ')
                    mes_idx = MESES_ES.index(parts[1].capitalize())
                    dt = datetime(int(parts[2].strip()), mes_idx, int(parts[0].strip()))
                else:
                    dt = datetime.now()
            except Exception:
                dt = datetime.now()

            anio = str(dt.year)
            mes = f"{dt.month:02d} - {MESES_ES[dt.month]}"
            folio = data.get('id', 'ID')[-6:]
            prefix = 'CERT' if is_cert else 'COT'

            # Nombre de archivos
            pdf_drive_filename = f"{prefix}_{anio}-{dt.month:02d}-{dt.day:02d}_{cliente}_{folio}.pdf"
            json_drive_filename = f"{prefix}_{anio}-{dt.month:02d}-{dt.day:02d}_{cliente}_{folio}.json"

            try:
                print(f"\n📄 Procesando: {pdf_drive_filename}")
                year_folder_id = get_or_create_folder(service, anio, ROOT_FOLDER_ID)
                month_folder_id = get_or_create_folder(service, mes, year_folder_id)
                client_folder_id = get_or_create_folder(service, cliente, month_folder_id)

                # Generar PDF local si Playwright está disponible
                pdf_local_path = os.path.join(temp_dir, pdf_drive_filename)
                if pw_instance:
                    try:
                        generate_pdf_for_quote(pw_instance, data, pdf_local_path)
                        upload_file_to_drive(service, pdf_local_path, pdf_drive_filename, client_folder_id, 'application/pdf')
                    except Exception as pdf_err:
                        print(f"  ❌ Error al generar/subir PDF: {pdf_err}")

                # Subir también el respaldo JSON
                upload_file_to_drive(service, file_path, json_drive_filename, client_folder_id, 'application/json')
            except Exception as file_process_err:
                print(f"  ❌ Error procesando {filename} para Drive: {file_process_err}")

    if pw_manager and pw_instance:
        try:
            pw_manager.stop()
        except Exception:
            pass

    print("\n🎉 Sincronización de PDFs y JSONs con Google Drive completada.")

if __name__ == '__main__':
    main()
