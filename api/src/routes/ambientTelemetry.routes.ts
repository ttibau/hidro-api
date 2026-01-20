import { FastifyInstance } from "fastify";
import { AmbientTelemetryService } from "../services/ambientTelemetry.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function ambientTelemetryRoutes(app: FastifyInstance) {
  const service = new AmbientTelemetryService();

  // Listar telemetrias com filtros
  app.get("/telemetry/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const filters = {
        sensor_id: request.query.sensor_id ? parseInt(request.query.sensor_id) : undefined,
        start_date: request.query.start_date,
        end_date: request.query.end_date,
        limit: request.query.limit ? parseInt(request.query.limit) : undefined,
        offset: request.query.offset ? parseInt(request.query.offset) : undefined,
      };

      const telemetries = await service.findAll(filters);
      return { data: telemetries };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar telemetria por ID
  app.get("/telemetry/ambient/:id", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      const telemetry = await service.findById(id);
      if (!telemetry) {
        reply.code(404);
        return { error: "Telemetria não encontrada" };
      }

      return { data: telemetry };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar telemetrias por sensor
  app.get("/sensors/:sensorId/telemetry/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const sensorId = parseInt(request.params.sensorId);
      if (isNaN(sensorId)) {
        reply.code(400);
        return { error: "ID do sensor inválido" };
      }

      const limit = request.query.limit ? parseInt(request.query.limit) : 100;
      const telemetries = await service.findBySensorId(sensorId, limit);
      return { data: telemetries };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Criar nova telemetria
  app.post("/telemetry/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const { sensor_id, temp_c, hum_pct, rssi, uptime_s, raw } = request.body;

      if (!sensor_id || !raw) {
        reply.code(400);
        return { error: "sensor_id e raw são obrigatórios" };
      }

      const telemetry = await service.create({
        sensor_id,
        temp_c,
        hum_pct,
        rssi,
        uptime_s,
        raw,
      });

      reply.code(201);
      return { data: telemetry };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Deletar telemetria
  app.delete("/telemetry/ambient/:id", async (request: any, reply) => {
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
        return { error: "Telemetria não encontrada" };
      }

      return { message: "Telemetria deletada com sucesso" };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });
}
