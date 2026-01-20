import { FastifyInstance } from "fastify";
import { AmbientStatusService } from "../services/ambientStatus.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function ambientStatusRoutes(app: FastifyInstance) {
  const service = new AmbientStatusService();

  // Listar todos os status
  app.get("/status/ambient", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const statuses = await service.findAll();
      return { data: statuses };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar status por sensor
  app.get("/sensors/:sensorId/status/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const sensorId = parseInt(request.params.sensorId);
      if (isNaN(sensorId)) {
        reply.code(400);
        return { error: "ID do sensor inválido" };
      }

      const status = await service.findBySensorId(sensorId);
      if (!status) {
        reply.code(404);
        return { error: "Status não encontrado" };
      }

      return { data: status };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Criar ou atualizar status
  app.post("/status/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const { sensor_id, status } = request.body;

      if (!sensor_id || !status) {
        reply.code(400);
        return { error: "sensor_id e status são obrigatórios" };
      }

      if (status !== "online" && status !== "offline") {
        reply.code(400);
        return { error: "status deve ser 'online' ou 'offline'" };
      }

      const result = await service.createOrUpdate({ sensor_id, status });
      reply.code(201);
      return { data: result };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Atualizar status
  app.put("/sensors/:sensorId/status/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const sensorId = parseInt(request.params.sensorId);
      if (isNaN(sensorId)) {
        reply.code(400);
        return { error: "ID do sensor inválido" };
      }

      const { status } = request.body;
      if (!status || (status !== "online" && status !== "offline")) {
        reply.code(400);
        return { error: "status deve ser 'online' ou 'offline'" };
      }

      const result = await service.update(sensorId, status);
      if (!result) {
        reply.code(404);
        return { error: "Status não encontrado" };
      }

      return { data: result };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Deletar status
  app.delete("/sensors/:sensorId/status/ambient", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const sensorId = parseInt(request.params.sensorId);
      if (isNaN(sensorId)) {
        reply.code(400);
        return { error: "ID do sensor inválido" };
      }

      const deleted = await service.delete(sensorId);
      if (!deleted) {
        reply.code(404);
        return { error: "Status não encontrado" };
      }

      return { message: "Status deletado com sucesso" };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });
}
