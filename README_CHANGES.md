# Mudanças Implementadas - Sistema de Status Lógico

## ✅ Resumo

A API foi atualizada para usar **status lógico baseado em timestamps** ao invés de depender do status MQTT (LWT). Sensores em deep sleep agora são corretamente classificados como ATIVO, ATRASADO ou OFFLINE com base no tempo desde a última leitura.

## 🎯 Principais Alterações

### Banco de Dados
- ✅ Adicionadas colunas `expected_interval_s` e `last_seen_at` na tabela `sensor`
- ✅ Renomeada `ambient_telemetry` → `telemetry` (tabela híbrida)
- ✅ Criada função SQL `get_sensor_status()` para cálculo de status
- ✅ Trigger automático para atualizar `last_seen_at` em cada telemetria

### API (Fastify/Node.js)
- ✅ `SensorService`: retorna status + última telemetria em todos os endpoints
- ✅ `TelemetryService`: renomeado de `AmbientTelemetryService`, usa tabela `telemetry`
- ✅ `DashboardService`: atualizado para usar status lógico
- ✅ `ViewsService`: queries diretas sem dependência de views antigas
- ✅ Validação de `expected_interval_s` (60-86400 segundos)

## 📊 Cálculo de Status

```
T = expected_interval_s
Δ = agora - last_seen_at (em segundos)

ATIVO:     Δ ≤ 2×T
ATRASADO:  2×T < Δ ≤ 3×T
OFFLINE:   Δ > 3×T (ou last_seen_at NULL)
```

### Exemplo Prático
Sensor com `expected_interval_s = 3600` (1 hora):
- **0-2h**: ATIVO ✅
- **2-3h**: ATRASADO ⚠️
- **>3h**: OFFLINE ❌

## 🚀 Como Usar

### 1. Executar Migração do Banco

```bash
psql -U postgres -d hidro_ai -f db/migration_01_sensor_status.sql
```

### 2. Reiniciar a API

```bash
cd api
npm install
npm run dev
```

### 3. Criar/Atualizar Sensor

```bash
# Criar sensor com intervalo personalizado
curl -X POST http://localhost:3000/sensors \
  -H "Content-Type: application/json" \
  -d '{
    "greenhouse_id": 1,
    "device_key": "sensor-test-01",
    "sensor_type": "ambient",
    "name": "Sensor Teste",
    "expected_interval_s": 1800
  }'

# Atualizar intervalo de um sensor existente
curl -X PUT http://localhost:3000/sensors/1 \
  -H "Content-Type: application/json" \
  -d '{"expected_interval_s": 3600}'
```

### 4. Consultar Status

```bash
# Listar todos os sensores com status
curl http://localhost:3000/sensors

# Ver detalhes de um sensor específico
curl http://localhost:3000/sensors/1
```

## 📋 Resposta da API

```json
{
  "data": [
    {
      "id": 1,
      "device_key": "estufa-sht31-01",
      "sensor_type": "ambient",
      "greenhouse_id": 1,
      "name": "Sensor Principal",
      "expected_interval_s": 3600,
      "last_seen_at": "2026-01-20T14:30:00Z",
      "status": "ATIVO",
      "last_temp_c": 25.5,
      "last_hum_pct": 65.2,
      "last_rssi": -72,
      "last_uptime_s": 3600,
      "last_received_at": "2026-01-20T14:30:00Z",
      "created_at": "2026-01-15T08:00:00Z"
    }
  ]
}
```

## 🧪 Testes de Aceite

### Cenário 1: Sensor Ativo ✅
```
expected_interval_s = 3600 (1h)
last_seen_at = 50 minutos atrás
Resultado: status = "ATIVO"
```

### Cenário 2: Sensor Atrasado ⚠️
```
expected_interval_s = 3600 (1h)
last_seen_at = 2h10min atrás
Resultado: status = "ATRASADO"
```

### Cenário 3: Sensor Offline ❌
```
expected_interval_s = 3600 (1h)
last_seen_at = 3h30min atrás
Resultado: status = "OFFLINE"
```

## 📁 Arquivos Modificados

### SQL
- ✅ `db/migration_01_sensor_status.sql` (novo)

### Services
- ✅ `api/src/services/sensor.service.ts`
- ✅ `api/src/services/ambientTelemetry.service.ts` (renomeado internamente)
- ✅ `api/src/services/dashboard.service.ts`
- ✅ `api/src/services/views.service.ts`

### Routes
- ✅ `api/src/routes/sensor.routes.ts`
- ✅ `api/src/routes/ambientTelemetry.routes.ts`

## ⚠️ Notas Importantes

1. **Validação**: `expected_interval_s` deve estar entre 60 (1 min) e 86400 (24h)
2. **Default**: Se não especificado, usa 3600 segundos (1 hora)
3. **Compatibilidade**: `ambient_status` mantida mas não mais usada
4. **Trigger**: `last_seen_at` atualizado automaticamente a cada nova telemetria

## 📚 Documentação Completa

Para mais detalhes, consulte [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
