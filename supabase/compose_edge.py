"""Genera un archivo único para el editor de Supabase. No conecta ni despliega."""
from pathlib import Path
root=Path(__file__).resolve().parent
shared=(root/'functions/_shared/ai-provider.ts').read_text()
main=(root/'functions/ai-copilot/index.ts').read_text()
main=main.replace('import { createAiCaller, AiProviderError } from "../_shared/ai-provider.ts";\n','')
header='// Nuvia: pegar TODO este archivo como index.ts de la Edge Function ai-copilot.\n// Generado por compose_edge.py. Sin tokens incluidos. Valida JWT con auth.getUser y RBAC.\n// Los secretos HF_TOKEN y GROQ_API_KEY se configuran SOLO en Supabase Secrets.\n\n'
(root/'dashboard').mkdir(exist_ok=True)
(root/'dashboard/ai-copilot.ts').write_text(header+shared+'\n'+main)
print('Generado supabase/dashboard/ai-copilot.ts, sin imports de archivos locales.')
