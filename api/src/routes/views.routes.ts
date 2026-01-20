import { FastifyInstance } from "fastify";
import { ViewsService } from "../services/views.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function viewsRoutes(app: FastifyInstance) {
  const service = new ViewsService();

  // Última telemetria de todos os sensores
  app.get("/views/last-telemetry", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const telemetries = await service.getLastTelemetry();
      return { data: telemetries };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Última telemetria de um sensor específico
  app.get("/views/last-telemetry/:sensorId", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const sensorId = parseInt(request.params.sensorId);
      if (isNaN(sensorId)) {
        reply.code(400);
        return { error: "ID do sensor inválido" };
      }

      const telemetry = await service.getLastTelemetryBySensorId(sensorId);
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

  // Visão geral de todos os sensores
  app.get("/views/sensor-overview", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const overview = await service.getSensorOverview();
      return { data: overview };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Visão geral dos sensores de uma estufa
  app.get("/views/sensor-overview/greenhouse/:greenhouseId", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const greenhouseId = parseInt(request.params.greenhouseId);
      if (isNaN(greenhouseId)) {
        reply.code(400);
        return { error: "ID da estufa inválido" };
      }

      const overview = await service.getSensorOverviewByGreenhouseId(greenhouseId);
      return { data: overview };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Alertas de sensores offline há mais de 10 minutos
  app.get("/views/offline-alerts", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const alerts = await service.getOfflineAlerts();
      return { data: alerts };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });
}
