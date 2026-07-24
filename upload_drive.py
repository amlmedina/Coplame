# upload_drive.py - Script para subir cotizaciones a Google Drive desde GitHub Actions
import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# ID de la carpeta de Google Drive destino
FOLDER_ID = '10eSCp_mrEjeLlMx6x6ZCxmm4XyfP_6Nz'

def main():
    # 1. Cargar credenciales desde la variable de entorno de GitHub Secrets
    creds_json = os.environ.get('GCP_SERVICE_ACCOUNT_KEY')
    if not creds_json:
        print("Error: No se encontró la variable GCP_SERVICE_ACCOUNT_KEY.")
        return

    info = json.loads(creds_json)
    creds = service_account.Credentials.from_service_account_info(
        info, 
        scopes=['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
    )
    
    service = build('drive', 'v3', credentials=creds)

    # 2. Buscar archivos JSON de cotizaciones en la carpeta local 'cotizaciones/'
    local_dir = 'cotizaciones'
    if not os.path.exists(local_dir):
        print("No hay carpeta 'cotizaciones/' local. Nada que subir.")
        return

    # Obtener archivos ya existentes en la carpeta de Google Drive para evitar duplicar
    results = service.files().list(
        q=f"'{FOLDER_ID}' in parents and trashed = false",
        fields="files(id, name)"
    ).execute()
    drive_files = {f['name']: f['id'] for f in results.get('files', [])}

    for filename in os.listdir(local_dir):
        if filename.endswith('.json'):
            file_path = os.path.join(local_dir, filename)
            
            # Nombre amigable para el archivo en Drive (por ejemplo, el nombre del cliente y folio)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                drive_filename = f"Cotizacion_{data.get('cliente', 'Cliente')}_{data.get('id', 'ID')}.json"
            except Exception as e:
                print(f"Error al leer {filename}: {e}")
                drive_filename = filename

            if drive_filename in drive_files:
                print(f"El archivo {drive_filename} ya existe en Google Drive. Saltando...")
                continue

            print(f"Subiendo {filename} como {drive_filename} a Google Drive...")
            file_metadata = {
                'name': drive_filename,
                'parents': [FOLDER_ID]
            }
            media = MediaFileUpload(file_path, mimetype='application/json')
            
            uploaded_file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            
            print(f"Subido con éxito. ID en Drive: {uploaded_file.get('id')}")

if __name__ == '__main__':
    main()
