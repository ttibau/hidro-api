# Correção - Problema de Schema PostgreSQL

## ❌ Problema Identificado

```
"error": "function get_sensor_status(timestamp with time zone, integer) does not exist"
```

A função existia no banco, mas estava no schema errado.

## 🔍 Causa Raiz

As tabelas (`sensor`, `telemetry`, `greenhouse`) estão no schema **`estufa`**, mas:
- As funções foram criadas no schema **`public`** (padrão)
- A API fazia chamadas sem qualificar o schema: `get_sensor_status()`
- PostgreSQL não encontrava a função no contexto correto

## ✅ Solução Implementada

### 1. **Script de Migração** (`db/migration_01_sensor_status.sql`)
Todas as referências agora usam o schema `estufa`:

```sql
-- Antes (errado)
ALTER TABLE sensor ADD COLUMN ...
CREATE FUNCTION get_sensor_status(...) ...

-- Depois (correto)
ALTER TABLE estufa.sensor ADD COLUMN ...
CREATE FUNCTION estufa.get_sensor_status(...) ...
```

**Mudanças específicas:**
- ✅ `ALTER TABLE estufa.sensor`
- ✅ `ALTER TABLE estufa.ambient_telemetry RENAME TO telemetry`
- ✅ `CREATE FUNCTION estufa.update_sensor_last_seen()`
- ✅ `CREATE FUNCTION estufa.get_sensor_status()`
- ✅ `CREATE TRIGGER ... ON estufa.telemetry`
- ✅ `UPDATE estufa.sensor SET last_seen_at ...`

### 2. **Services da API** (TypeScript)
Todas as chamadas à função agora são qualificadas:

```typescript
// Antes (errado)
get_sensor_status(s.last_seen_at, s.expected_interval_s) as status

// Depois (correto)
estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s) as status
```

**Arquivos corrigidos:**
- ✅ `api/src/services/sensor.service.ts` (4 ocorrências)
- ✅ `api/src/services/dashboard.service.ts` (7 ocorrências)
- ✅ `api/src/services/views.service.ts` (4 ocorrências)

### 3. **Script de Teste** (`db/test_status_logic.sql`)
Todas as referências a tabelas e funções agora usam `estufa`:

```sql
-- Tabelas
INSERT INTO estufa.sensor ...
INSERT INTO estufa.telemetry ...
SELECT ... FROM estufa.greenhouse

-- Função
estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s)
```

## 🚀 Como Aplicar a Correção

### Opção 1: Re-executar a Migração (Recomendado)

Se você já rodou o script anterior, primeiro faça rollback:

```sql
-- 1. Remover funções do schema público (se existirem)
DROP FUNCTION IF EXISTS get_sensor_status(TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS update_sensor_last_seen();

-- 2. Remover trigger
DROP TRIGGER IF EXISTS trg_update_sensor_last_seen ON estufa.telemetry;

-- 3. Remover colunas (opcional, se quiser começar do zero)
ALTER TABLE estufa.sensor 
  DROP COLUMN IF EXISTS expected_interval_s,
  DROP COLUMN IF EXISTS last_seen_at;

-- 4. Renomear tabela de volta (se necessário)
ALTER TABLE IF EXISTS estufa.telemetry RENAME TO ambient_telemetry;
```

Depois, execute o script corrigido:

```bash
psql -U postgres -d hidro_ai -f db/migration_01_sensor_status.sql
```

### Opção 2: Corrigir Manualmente (Mais Rápido)

Se você quer manter os dados e só mover as funções:

```sql
BEGIN;

-- 1. Recriar função no schema correto
CREATE OR REPLACE FUNCTION estufa.get_sensor_status(
  p_last_seen_at TIMESTAMPTZ,
  p_expected_interval_s INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_delta_seconds NUMERIC;
  v_threshold_active NUMERIC;
  v_threshold_delayed NUMERIC;
BEGIN
  IF p_last_seen_at IS NULL THEN
    RETURN 'OFFLINE';
  END IF;

  v_delta_seconds := EXTRACT(EPOCH FROM (now() - p_last_seen_at));
  v_threshold_active := p_expected_interval_s * 2;
  v_threshold_delayed := p_expected_interval_s * 3;

  IF v_delta_seconds <= v_threshold_active THEN
    RETURN 'ATIVO';
  ELSIF v_delta_seconds <= v_threshold_delayed THEN
    RETURN 'ATRASADO';
  ELSE
    RETURN 'OFFLINE';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Recriar função de trigger no schema correto
CREATE OR REPLACE FUNCTION estufa.update_sensor_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE estufa.sensor
  SET last_seen_at = NEW.received_at
  WHERE id = NEW.sensor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar trigger
DROP TRIGGER IF EXISTS trg_update_sensor_last_seen ON estufa.telemetry;
CREATE TRIGGER trg_update_sensor_last_seen
  AFTER INSERT ON estufa.telemetry
  FOR EACH ROW
  EXECUTE FUNCTION estufa.update_sensor_last_seen();

-- 4. Remover funções antigas do schema público (se existirem)
DROP FUNCTION IF EXISTS get_sensor_status(TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS update_sensor_last_seen();

COMMIT;
```

## 🧪 Validar a Correção

### 1. Verificar Schema das Funções
```sql
SELECT 
  n.nspname as schema,
  p.proname as function_name
FROM pg_proc p
INNER JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('get_sensor_status', 'update_sensor_last_seen');
```

**Resultado esperado:**
```
 schema |        function_name        
--------+----------------------------
 estufa | get_sensor_status
 estufa | update_sensor_last_seen
```

### 2. Testar a Função
```sql
-- Deve retornar 'ATIVO'
SELECT estufa.get_sensor_status(NOW() - INTERVAL '1 hour', 3600);

-- Deve retornar 'ATRASADO'
SELECT estufa.get_sensor_status(NOW() - INTERVAL '2.5 hours', 3600);

-- Deve retornar 'OFFLINE'
SELECT estufa.get_sensor_status(NOW() - INTERVAL '4 hours', 3600);

-- Deve retornar 'OFFLINE'
SELECT estufa.get_sensor_status(NULL, 3600);
```

### 3. Testar via API
```bash
# Reiniciar a API
cd api
npm run dev

# Testar endpoint
curl http://localhost:3000/sensors | jq
```

**Resposta esperada:** Status deve aparecer corretamente sem erro.

## 📊 Resumo das Mudanças

| Componente | Mudança | Status |
|------------|---------|--------|
| `migration_01_sensor_status.sql` | Schema qualificado em todas operações | ✅ |
| `sensor.service.ts` | `estufa.get_sensor_status()` | ✅ |
| `dashboard.service.ts` | `estufa.get_sensor_status()` | ✅ |
| `views.service.ts` | `estufa.get_sensor_status()` | ✅ |
| `test_status_logic.sql` | Schema qualificado | ✅ |

## 💡 Lições Aprendidas

1. **Sempre qualificar schemas**: Em ambientes com múltiplos schemas, sempre usar `schema.objeto`
2. **Consistência**: Se as tabelas estão em `estufa`, as funções também devem estar
3. **Testar em ambiente similar**: O problema só aparece quando há múltiplos schemas

## 🔗 Referências PostgreSQL

- [PostgreSQL Schema Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Schema Search Path](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)

---

✅ **Problema resolvido!** A API agora deve funcionar corretamente.
