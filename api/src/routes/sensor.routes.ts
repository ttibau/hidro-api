import { FastifyInstance } from "fastify";
import { SensorService } from "../services/sensor.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function sensorRoutes(app: FastifyInstance) {
  const service = new SensorService();

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
      const { greenhouse_id, device_key, sensor_type, name } = request.body;

      if (!greenhouse_id || !device_key || !sensor_type) {
        reply.code(400);
        return { error: "greenhouse_id, device_key e sensor_type são obrigatórios" };
      }

      const sensor = await service.create({ greenhouse_id, device_key, sensor_type, name });
      reply.code(201);
      return { data: sensor };
    } catch (error: any) {
      reply.code(500);
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

      const { greenhouse_id, device_key, sensor_type, name } = request.body;
      const sensor = await service.update(id, { greenhouse_id, device_key, sensor_type, name });

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
}
