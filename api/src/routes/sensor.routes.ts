import { FastifyInstance } from "fastify";
import { SensorService } from "../services/sensor.service";
import { TelemetryService } from "../services/ambientTelemetry.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function sensorRoutes(app: FastifyInstance) {
  const service = new SensorService();
  const telemetryService = new TelemetryService();

  // Listar todos os sensores
  app.get("/sensors", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const sensors = await service.findAll();
      return { data: sensors };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar sensor por ID
  app.get("/sensors/:id", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      const sensor = await service.findById(id);
      if (!sensor) {
        reply.code(404);
        return { error: "Sensor não encontrado" };
      }

      return { data: sensor };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar sensores por estufa
  app.get("/greenhouses/:greenhouseId/sensors", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const greenhouseId = parseInt(request.params.greenhouseId);
      if (isNaN(greenhouseId)) {
        reply.code(400);
        return { error: "ID da estufa inválido" };
      }

      const sensors = await service.findByGreenhouseId(greenhouseId);
      return { data: sensors };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar sensor por device_key
  app.get("/sensors/device/:deviceKey", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const { deviceKey } = request.params;
      const sensor = await service.findByDeviceKey(deviceKey);
      
      if (!sensor) {
        reply.code(404);
        return { error: "Sensor não encontrado" };
      }

      return { data: sensor };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Criar novo sensor
  app.post("/sensors", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const { greenhouse_id, device_key, sensor_type, name, expected_interval_s } = request.body;

      if (!greenhouse_id || !device_key || !sensor_type) {
        reply.code(400);
        return { error: "greenhouse_id, device_key e sensor_type são obrigatórios" };
      }

      const sensor = await service.create({ 
        greenhouse_id, 
        device_key, 
        sensor_type, 
        name,
        expected_interval_s 
      });
      reply.code(201);
      return { data: sensor };
    } catch (error: any) {
      reply.code(400);
      return { error: error.message };
    }
  });

  // Atualizar sensor
  app.put("/sensors/:id", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      const { greenhouse_id, device_key, sensor_type, name, expected_interval_s } = request.body;
      const sensor = await service.update(id, { 
        greenhouse_id, 
        device_key, 
        sensor_type, 
        name,
        expected_interval_s 
      });

      if (!sensor) {
        reply.code(404);
        return { error: "Sensor não encontrado" };
      }

      return { data: sensor };
    } catch (error: any) {
      reply.code(400);
      return { error: error.message };
    }
  });

  // Deletar sensor
  app.delete("/sensors/:id", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      const deleted = await service.delete(id);
      if (!deleted) {
        reply.code(404);
        return { error: "Sensor não encontrado" };
      }

      return { message: "Sensor deletado com sucesso" };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar medições de um sensor (com informações do sensor)
  app.get("/sensors/:id/measurements", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      // Verificar se o sensor existe
      const sensor = await service.findById(id);
      if (!sensor) {
        reply.code(404);
        return { error: "Sensor não encontrado" };
      }

      // Buscar medições com filtros opcionais
      const filters = {
        sensor_id: id,
        start_date: request.query.start_date,
        end_date: request.query.end_date,
        limit: request.query.limit ? parseInt(request.query.limit) : 100,
        offset: request.query.offset ? parseInt(request.query.offset) : undefined,
      };

      const measurements = await telemetryService.findAll(filters);

      return {
        data: {
          sensor: {
            id: sensor.id,
            greenhouse_id: sensor.greenhouse_id,
            device_key: sensor.device_key,
            sensor_type: sensor.sensor_type,
            name: sensor.name,
            created_at: sensor.created_at,
          },
          measurements: measurements,
          total: measurements.length,
        },
      };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });
}
