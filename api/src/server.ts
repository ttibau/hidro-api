import Fastify from "fastify";
import cors from "@fastify/cors";
import { closePool } from "./db/config";
import { greenhouseRoutes } from "./routes/greenhouse.routes";
import { sensorRoutes } from "./routes/sensor.routes";
import { ambientTelemetryRoutes } from "./routes/ambientTelemetry.routes";
import { ambientStatusRoutes } from "./routes/ambientStatus.routes";
import { viewsRoutes } from "./routes/views.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { ViewsService } from "./services/views.service";

async function start() {
  const app = Fastify({ logger: true });

  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || "0.0.0.0";

  await app.register(cors, { origin: true });

  // MVP: proteção por API KEY (opcional)
  app.addHook("onRequest", async (req, reply) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return; // se não setar, não bloqueia
    const headerKey = req.headers["x-api-key"];
    if (headerKey !== apiKey) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });

  // Health check
  app.get("/health", async () => ({ ok: true }));

  // Endpoint de métricas (mantido para compatibilidade)
  app.get("/metrics/latest", async (request, reply) => {
    try {
      const viewsService = new ViewsService();
      const telemetries = await viewsService.getLastTelemetry();
      return { data: telemetries };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Registrar todas as rotas
  await app.register(greenhouseRoutes);
  await app.register(sensorRoutes);
  await app.register(ambientTelemetryRoutes);
  await app.register(ambientStatusRoutes);
  await app.register(viewsRoutes);
  await app.register(dashboardRoutes);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Encerrando servidor...");
    await closePool();
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Servidor rodando em http://${HOST}:${PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
