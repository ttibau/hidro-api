import { FastifyInstance } from "fastify";
import { DashboardService } from "../services/dashboard.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function dashboardRoutes(app: FastifyInstance) {
  const service = new DashboardService();

  // Resumo geral do dashboard (cards do topo)
  app.get("/dashboard/summary", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const summary = await service.getSummary();
      return { data: summary };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Lista de estufas com resumo
  app.get("/dashboard/greenhouses", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const greenhouses = await service.getGreenhousesSummary();
      return { data: greenhouses };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Alertas recentes
  app.get("/dashboard/alerts/recent", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const limit = request.query.limit
        ? parseInt(request.query.limit)
        : 10;
      const alerts = await service.getRecentAlerts(limit);
      return { data: alerts };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Resumo rápido (uptime e sensores ativos)
  app.get("/dashboard/quick-summary", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const quickSummary = await service.getQuickSummary();
      return { data: quickSummary };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Endpoint completo da home (todos os dados de uma vez)
  app.get("/dashboard/home", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const [summary, greenhouses, alerts, quickSummary] = await Promise.all([
        service.getSummary(),
        service.getGreenhousesSummary(),
        service.getRecentAlerts(10),
        service.getQuickSummary(),
      ]);

      return {
        data: {
          summary,
          greenhouses,
          recent_alerts: alerts,
          quick_summary: quickSummary,
        },
      };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });
}
