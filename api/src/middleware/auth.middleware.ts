import { FastifyRequest, FastifyReply } from "fastify";

export function validateApiKey(request: FastifyRequest, reply: FastifyReply): boolean {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return true; // se não setar, não bloqueia

  const headerKey = request.headers["x-api-key"];
  if (headerKey !== apiKey) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }

  return true;
}
