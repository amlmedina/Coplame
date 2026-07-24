# upload_drive.py - Script para subir cotizaciones organizadas en Google Drive desde GitHub Actions
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
    """Busca una subcarpeta por nombre dentro del padre. Si no existe, la crea."""
    query = (
        f"name = '{name}' "
        f"and '{parent_id}' in parents "
        f"and mimeType = 'application/vnd.google-apps.folder' "
        f"and trashed = false"
    )
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get('files', [])
    if files:
        return files[0]['id']

    # No existe → crearla
    metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    folder = service.files().create(body=metadata, fields='id').execute()
    print(f"  📁 Carpeta creada: {name}")
    return folder['id']


def file_exists_in_folder(service, name, folder_id):
    """Devuelve el ID del archivo si ya existe en la carpeta, o None."""
    query = f"name = '{name}' and '{folder_id}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    files = results.get('files', [])
    return files[0]['id'] if files else None


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

    print(f"📂 Procesando {len(json_files)} cotización(es)...")

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
        fecha_str = data.get('fecha', '')  # Puede ser YYYY-MM-DD o texto en español

        # Parsear la fecha
        try:
            if fecha_str and '-' in fecha_str and len(fecha_str) == 10:
                dt = datetime.strptime(fecha_str, '%Y-%m-%d')
            elif 'de' in fecha_str.lower():
                # Formato "24 de Julio de 2026"
                parts = fecha_str.lower().split(' de ')
                mes_idx = MESES_ES.index(parts[1].capitalize())
                dt = datetime(int(parts[2].strip()), mes_idx, int(parts[0].strip()))
            else:
                dt = datetime.now()
        except Exception:
            dt = datetime.now()

        anio = str(dt.year)
        mes = f"{dt.month:02d} - {MESES_ES[dt.month]}"

        # Nombre amigable del archivo en Drive
        folio = data.get('id', 'ID')[-6:]
        drive_filename = f"COT_{anio}-{dt.month:02d}-{dt.day:02d}_{cliente}_{folio}.json"

        # 3. Crear la jerarquía de carpetas: Raíz / Año / Mes / Cliente
        print(f"\n📄 {drive_filename}")
        year_folder_id = get_or_create_folder(service, anio, ROOT_FOLDER_ID)
        month_folder_id = get_or_create_folder(service, mes, year_folder_id)
        client_folder_id = get_or_create_folder(service, cliente, month_folder_id)

        # 4. Verificar si ya existe para no duplicar
        try:
            existing_id = file_exists_in_folder(service, drive_filename, client_folder_id)
            if existing_id:
                print(f"  ℹ️  Ya existe en Drive. Actualizando contenido...")
                media = MediaFileUpload(file_path, mimetype='application/json')
                service.files().update(
                    fileId=existing_id,
                    media_body=media
                ).execute()
                print(f"  ✅ Actualizado en Drive.")
            else:
                print(f"  ⬆️  Subiendo a Drive en carpeta ID: {client_folder_id}")
                file_metadata = {
                    'name': drive_filename,
                    'parents': [client_folder_id]
                }
                media = MediaFileUpload(file_path, mimetype='application/json')
                uploaded = service.files().create(
                    body=file_metadata,
                    media_body=media,
                    fields='id'
                ).execute()
                print(f"  ✅ Subido con éxito. ID en Drive: {uploaded.get('id')}")
        except Exception as upload_err:
            print(f"  ❌ ERROR al subir {drive_filename}: {upload_err}")
            import traceback
            traceback.print_exc()

    print("\n🎉 Sincronización con Google Drive completada.")


if __name__ == '__main__':
    main()

