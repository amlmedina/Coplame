# upload_drive.py - Script para subir cotizaciones y certificados en PDF a Google Drive desde GitHub Actions
import os
import json
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ID de la carpeta raíz de Google Drive destino
ROOT_FOLDER_ID = '10eSCp_mrEjeLlMx6x6ZCxmm4XyfP_6Nz'

MESES_ES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

def get_or_create_folder(service, name, parent_id):
    clean_name = name.strip()
    clean_name_lower = clean_name.lower()
    query = f"'{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    
    try:
        results = service.files().list(q=query, fields="files(id, name)").execute()
        files = results.get('files', [])
        for f in files:
            if f.get('name', '').strip().lower() == clean_name_lower:
                return f['id']
    except Exception as e:
        print(f"  ⚠️ Error al listar carpetas en Drive: {e}")

    metadata = {
        'name': clean_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    folder = service.files().create(body=metadata, fields='id').execute()
    print(f"  📁 Carpeta creada: {clean_name}")
    return folder['id']

def file_exists_in_folder(service, name, folder_id):
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

def upload_file_to_drive(service, local_file_path, drive_filename, folder_id, mime_type):
    existing_id = file_exists_in_folder(service, drive_filename, folder_id)
    media = MediaFileUpload(local_file_path, mimetype=mime_type)

    if existing_id:
        print(f"  ℹ️  Ya existe {drive_filename} en Drive. Actualizando...")
        service.files().update(fileId=existing_id, media_body=media).execute()
        print(f"  ✅ {drive_filename} actualizado.")
    else:
        print(f"  ⬆️  Subiendo {drive_filename} a Drive...")
        file_metadata = {'name': drive_filename, 'parents': [folder_id]}
        uploaded = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        print(f"  ✅ Subido con éxito. ID: {uploaded.get('id')}")

def main():
    creds_json = os.environ.get('GCP_SERVICE_ACCOUNT_KEY')
    if not creds_json:
        print("❌ Error: No se encontró la variable GCP_SERVICE_ACCOUNT_KEY.")
        return

    info = json.loads(creds_json)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=['https://www.googleapis.com/auth/drive']
    )
    service = build('drive', 'v3', credentials=creds)

    local_dir = 'cotizaciones'
    if not os.path.exists(local_dir):
        print("No hay carpeta 'cotizaciones/' local. Nada que subir.")
        return

    json_files = [f for f in os.listdir(local_dir) if f.endswith('.json')]
    if not json_files:
        print("No hay archivos JSON en 'cotizaciones/'. Nada que subir.")
        return

    print(f"📂 Procesando {len(json_files)} documento(s)...")

    for filename in json_files:
        json_path = os.path.join(local_dir, filename)
        pdf_path = os.path.join(local_dir, filename.replace('.json', '.pdf'))

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"  ⚠️  Error al leer {filename}: {e}")
            continue

        cliente = data.get('cliente', 'Sin_Cliente').strip().replace('/', '-').replace('\\', '-')
        is_cert = data.get('tipo') == 'certificado'
        fecha_str = data.get('fecha-aplicacion', '') if is_cert else data.get('fecha', '')

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

        pdf_drive_filename = f"{prefix}_{anio}-{dt.month:02d}-{dt.day:02d}_{cliente}_{folio}.pdf"
        json_drive_filename = f"{prefix}_{anio}-{dt.month:02d}-{dt.day:02d}_{cliente}_{folio}.json"

        try:
            print(f"\n📄 Procesando: {pdf_drive_filename}")
            year_folder_id = get_or_create_folder(service, anio, ROOT_FOLDER_ID)
            month_folder_id = get_or_create_folder(service, mes, year_folder_id)
            client_folder_id = get_or_create_folder(service, cliente, month_folder_id)

            if os.path.exists(pdf_path):
                upload_file_to_drive(service, pdf_path, pdf_drive_filename, client_folder_id, 'application/pdf')
            else:
                print(f"  ⚠️ PDF no encontrado localmente: {pdf_path}. Solo se subirá el JSON.")

            upload_file_to_drive(service, json_path, json_drive_filename, client_folder_id, 'application/json')
        except Exception as file_process_err:
            print(f"  ❌ Error procesando {filename} para Drive: {file_process_err}")

    print("\n🎉 Sincronización de PDFs y JSONs con Google Drive completada.")

if __name__ == '__main__':
    main()
