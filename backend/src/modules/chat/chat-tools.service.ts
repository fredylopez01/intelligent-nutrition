import { Injectable, Logger } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import { BranchesService } from "../branches/branches.service.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { CatalogSort } from "../catalog/dto/list-catalog-products-query.dto.js";

export const ESCALATE_TOOL = "escalar_a_humano";

const DAY_NAMES = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_productos",
    description:
      "Busca productos del catálogo que se pueden comprar hoy. Devuelve nombre, categoría, precio en pesos y unidades disponibles por sede. Úsala para cualquier pregunta de precios, existencias o recomendaciones de productos concretos.",
    input_schema: {
      type: "object",
      properties: {
        texto: {
          type: "string",
          description:
            "Nombre, marca, tipo de producto o código a buscar, mínimo 2 letras. Ej: proteína whey, creatina, BCAA.",
        },
      },
      required: ["texto"],
    },
  },
  {
    name: "consultar_sedes",
    description:
      "Lista las sedes activas con dirección, teléfono, horario semanal, si están abiertas en este momento y si hacen domicilios.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: ESCALATE_TOOL,
    description:
      "Marca la conversación para que la atienda una persona del equipo. Úsala cuando no puedas resolver la consulta o la persona pida hablar con alguien; después explícale cómo contactar al equipo.",
    input_schema: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          description: "Resumen corto de lo que la persona necesita.",
        },
      },
      required: ["motivo"],
    },
  },
];

function stringField(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);

  constructor(
    private readonly catalogService: CatalogService,
    private readonly branchesService: BranchesService,
  ) {}

  async run(name: string, input: unknown): Promise<string> {
    try {
      switch (name) {
        case "buscar_productos":
          return await this.searchProducts(stringField(input, "texto"));
        case "consultar_sedes":
          return await this.branches();
        case ESCALATE_TOOL:
          return JSON.stringify({
            escalado: true,
            indicacion:
              "La conversación quedó marcada para atención humana. Explica cómo contactar al equipo.",
          });
        default:
          return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
      }
    } catch (error) {
      this.logger.warn(
        `Chat tool ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return JSON.stringify({
        error:
          "No fue posible consultar la información en este momento. Ofrece escalar con una persona.",
      });
    }
  }

  private async searchProducts(text: string): Promise<string> {
    if (text.length < 2) {
      return JSON.stringify({
        error: "Pide a la persona el nombre del producto que busca.",
      });
    }
    const result = await this.catalogService.listProducts({
      page: 1,
      limit: 5,
      search: text.slice(0, 80),
      sort: CatalogSort.NAME,
    });
    return JSON.stringify({
      encontrados: result.meta.total,
      productos: result.data.map((product) => ({
        nombre: product.name,
        categoria: product.category.name,
        precio: Number(product.price),
        unidadesEnSedes: product.branchUnits,
        sedes: product.branches.map((branch) => ({
          sede: branch.name,
          unidades: branch.quantity,
        })),
        disponibleEnBodega: product.availableInWarehouse,
      })),
    });
  }

  private async branches(): Promise<string> {
    const result = await this.branchesService.findAll({
      page: 1,
      limit: 50,
      active: true,
    });
    return JSON.stringify({
      sedes: result.data.map((branch) => ({
        nombre: branch.name,
        direccion: branch.address,
        telefono: branch.phone,
        abiertaAhora: branch.openNow,
        domicilios: branch.deliveryEnabled,
        horario: branch.schedule.map((day) => ({
          dia: DAY_NAMES[day.dayOfWeek - 1],
          franjas:
            day.intervals.length === 0
              ? "cerrado"
              : day.intervals
                  .map((interval) => `${interval.opensAt}-${interval.closesAt}`)
                  .join(", "),
        })),
      })),
    });
  }
}
