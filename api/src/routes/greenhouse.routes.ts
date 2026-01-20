import { FastifyInstance } from "fastify";
import { GreenhouseService } from "../services/greenhouse.service";
import { validateApiKey } from "../middleware/auth.middleware";

export async function greenhouseRoutes(app: FastifyInstance) {
  const service = new GreenhouseService();

  // Listar todas as estufas
  app.get("/greenhouses", async (request, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const greenhouses = await service.findAll();
      return { data: greenhouses }; 
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Buscar estufa por ID
  app.get("/greenhouses/:id", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      const greenhouse = await service.findById(id);
      if (!greenhouse) {
        reply.code(404);
        return { error: "Estufa não encontrada" };
      }

      return { data: greenhouse };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Criar nova estufa
  app.post("/greenhouses", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const { name, location } = request.body;

      if (!name) {
        reply.code(400);
        return { error: "Nome é obrigatório" };
      }

      const greenhouse = await service.create({ name, location });
      reply.code(201);
      return { data: greenhouse };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Atualizar estufa
  app.put("/greenhouses/:id", async (request: any, reply) => {
    if (!validateApiKey(request, reply)) return;
    try {
      const id = parseInt(request.params.id);
      if (isNaN(id)) {
        reply.code(400);
        return { error: "ID inválido" };
      }

      const { name, location } = request.body;
      const greenhouse = await service.update(id, { name, location });

      if (!greenhouse) {
        reply.code(404);
        return { error: "Estufa não encontrada" };
      }

      return { data: greenhouse };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });

  // Deletar estufa
  app.delete("/greenhouses/:id", async (request: any, reply) => {
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
        return { error: "Estufa não encontrada" };
      }

      return { message: "Estufa deletada com sucesso" };
    } catch (error: any) {
      reply.code(500);
      return { error: error.message };
    }
  });
}
