# Guia de Migração - Sistema de Status Lógico

## Resumo das Mudanças

Este guia documenta as alterações realizadas para implementar o sistema de status lógico baseado em `last_seen_at` e `expected_interval_s`, eliminando a dependência de MQTT LWT (Last Will and Testament) para determinação de status dos sensores.

## Principais Alterações

### 1. Banco de Dados

#### Novas Colunas na Tabela `sensor`
- `expected_interval_s` (INTEGER): Intervalo esperado entre leituras em segundos (60-86400)
- `last_seen_at` (TIMESTAMPTZ): Timestamp da última telemetria recebida

#### Renomeação de Tabelas
- `ambient_telemetry` → `telemetry` (tabela híbrida para todos os tipos de sensores)

#### Novas Funções SQL
- `get_sensor_status(last_seen_at, expected_interval_s)`: Calcula o status lógico do sensor
  - **ATIVO**: Δ ≤ 2×T (sensor dentro do intervalo esperado)
  - **ATRASADO**: 2×T < Δ ≤ 3×T (sensor atrasado mas não crítico)
  - **OFFLINE**: Δ > 3×T ou `last_seen_at` NULL (sensor offline)

#### Trigger Automático
- `update_sensor_last_seen()`: Atualiza automaticamente `sensor.last_seen_at` quando nova telemetria é inserida

### 2. API (Node.js/Fastify)

#### SensorService
- **Novos campos retornados**:
  - `expected_interval_s`: Intervalo esperado configurado
  - `last_seen_at`: Última vez que o sensor foi visto
  - `status`: Status lógico calculado (ATIVO|ATRASADO|OFFLINE)
  - `last_temp_c`, `last_hum_pct`, `last_rssi`, `last_uptime_s`, `last_received_at`: Resumo da última telemetria

- **Validação**: 
  - `expected_interval_s` deve estar entre 60 e 86400 segundos

#### TelemetryService (anteriormente AmbientTelemetryService)
- Renomeado para refletir uso genérico
- Todas as queries agora usam a tabela `telemetry` ao invés de `ambient_telemetry`
- Mantida compatibilidade retroativa via exports

#### DashboardService
- Atualizado para usar status lógico ao invés de `ambient_status`
- Novos campos:
  - `sensors_active`: Sensores com status ATIVO
  - `sensors_delayed`: Sensores com status ATRASADO
  - `sensors_offline`: Sensores com status OFFLINE

#### ViewsService
- Todas as queries removem dependência de views antigas (`vw_ambient_*`)
- Implementadas queries diretas usando status lógico

## Como Executar a Migração

### Passo 1: Backup do Banco de Dados

```bash
pg_dump -U postgres -d hidro_ai > backup_antes_migracao.sql
```

### Passo 2: Executar o Script de Migração

```bash
psql -U postgres -d hidro_ai -f db/migration_01_sensor_status.sql
```

### Passo 3: Verificar a Migração

```sql
-- Verificar se as colunas foram adicionadas
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sensor' 
  AND column_name IN ('expected_interval_s', 'last_seen_at');

-- Verificar se a tabela foi renomeada
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'telemetry'
);

-- Verificar se a função foi criada
SELECT proname FROM pg_proc WHERE proname = 'get_sensor_status';

-- Testar a função de status
SELECT 
  id, 
  device_key, 
  last_seen_at,
  expected_interval_s,
  get_sensor_status(last_seen_at, expected_interval_s) as status
FROM sensor
LIMIT 5;
```

### Passo 4: Atualizar Dependências da API

```bash
cd api
npm install
```

### Passo 5: Reiniciar a API

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Endpoints da API

### Listar Sensores com Status
```
GET /sensors
```

**Resposta:**
```json
{
  "data": [
    {
      "id": 1,
      "greenhouse_id": 1,
      "device_key": "estufa-sht31-01",
      "sensor_type": "ambient",
      "name": "Sensor Temperatura #1",
      "expected_interval_s": 3600,
      "last_seen_at": "2026-01-20T10:30:00Z",
      "status": "ATIVO",
      "last_temp_c": 25.5,
      "last_hum_pct": 65.2,
      "last_rssi": -72,
      "last_uptime_s": 3600,
      "last_received_at": "2026-01-20T10:30:00Z",
      "created_at": "2026-01-15T08:00:00Z"
    }
  ]
}
```

### Criar Sensor
```
POST /sensors
Content-Type: application/json

{
  "greenhouse_id": 1,
  "device_key": "estufa-sht31-02",
  "sensor_type": "ambient",
  "name": "Sensor Temperatura #2",
  "expected_interval_s": 1800
}
```

### Atualizar Sensor
```
PUT /sensors/:id
Content-Type: application/json

{
  "expected_interval_s": 3600
}
```

## Validações

### expected_interval_s
- **Mínimo**: 60 segundos (1 minuto)
- **Máximo**: 86400 segundos (24 horas)
- **Padrão**: 3600 segundos (1 hora)

## Lógica de Status

### Exemplo Prático

Sensor com `expected_interval_s = 3600` (1 hora):

| Tempo desde última leitura | Status | Descrição |
|----------------------------|--------|-----------|
| 0 - 2h (0 - 7200s) | **ATIVO** | Sensor funcionando normalmente |
| 2h - 3h (7201 - 10800s) | **ATRASADO** | Sensor atrasado, atenção necessária |
| > 3h (> 10800s) | **OFFLINE** | Sensor offline, intervenção necessária |
| `last_seen_at` NULL | **OFFLINE** | Sensor nunca enviou dados |

## Compatibilidade

### Tabelas Mantidas (Não Removidas)
- `ambient_status`: Mantida para compatibilidade, mas não mais usada pela API
- Views antigas (`vw_ambient_*`): Podem ser removidas após validação completa

### Código Legado
O código mantém exports de compatibilidade:
```typescript
export { TelemetryService as AmbientTelemetryService };
export type { Telemetry as AmbientTelemetry };
```

## Testes Recomendados

### 1. Teste de Status ATIVO
```bash
# Criar sensor com intervalo de 1 hora
curl -X POST http://localhost:3000/sensors \
  -H "Content-Type: application/json" \
  -d '{
    "greenhouse_id": 1,
    "device_key": "test-sensor-01",
    "sensor_type": "ambient",
    "expected_interval_s": 3600
  }'

# Inserir telemetria
curl -X POST http://localhost:3000/telemetry/ambient \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": <ID_DO_SENSOR>,
    "temp_c": 25.0,
    "hum_pct": 60.0,
    "rssi": -70,
    "uptime_s": 100,
    "raw": {}
  }'

# Verificar status (deve ser ATIVO)
curl http://localhost:3000/sensors/<ID_DO_SENSOR>
```

### 2. Teste de Status ATRASADO
```sql
-- Simular sensor atrasado (2.5 horas atrás)
UPDATE sensor 
SET last_seen_at = NOW() - INTERVAL '2.5 hours'
WHERE id = <ID_DO_SENSOR>;
```

### 3. Teste de Status OFFLINE
```sql
-- Simular sensor offline (4 horas atrás)
UPDATE sensor 
SET last_seen_at = NOW() - INTERVAL '4 hours'
WHERE id = <ID_DO_SENSOR>;
```

## Rollback

Se necessário reverter as mudanças:

```sql
BEGIN;

-- Remover colunas adicionadas
ALTER TABLE sensor 
  DROP COLUMN IF EXISTS expected_interval_s,
  DROP COLUMN IF EXISTS last_seen_at;

-- Renomear tabela de volta
ALTER TABLE telemetry RENAME TO ambient_telemetry;

-- Remover função e trigger
DROP TRIGGER IF EXISTS trg_update_sensor_last_seen ON telemetry;
DROP FUNCTION IF EXISTS update_sensor_last_seen();
DROP FUNCTION IF EXISTS get_sensor_status(TIMESTAMPTZ, INTEGER);

COMMIT;
```

## Suporte

Em caso de dúvidas ou problemas, verifique:
1. Logs da API: `docker-compose logs -f api`
2. Logs do PostgreSQL: `docker-compose logs -f postgres`
3. Status dos sensores: `GET /sensors`
4. Dashboard: `GET /dashboard/summary`
