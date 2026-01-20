import Fastify from "fastify";
import cors from "@fastify/cors";

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

  app.get("/health", async () => ({ ok: true }));

  app.get("/metrics/latest", async () => {
    return { data: [], message: "TODO: implement Postgres query" };
  });

  await app.listen({ port: PORT, host: HOST });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
