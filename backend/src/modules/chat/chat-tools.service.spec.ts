import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ChatToolsService } from "./chat-tools.service.js";

type AsyncMock = (...args: unknown[]) => Promise<unknown>;

const catalog = { listProducts: jest.fn<AsyncMock>() };
const branches = { findAll: jest.fn<AsyncMock>() };

function service() {
  return new ChatToolsService(catalog as never, branches as never);
}

describe("ChatToolsService", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("searches the public catalog and returns prices and units per branch", async () => {
    catalog.listProducts.mockResolvedValue({
      meta: { total: 1 },
      data: [
        {
          name: "Creatina monohidratada 300 g",
          category: { id: "c1", name: "Aminoácidos" },
          price: "99900.00",
          branchUnits: 4,
          availableInWarehouse: true,
          branches: [{ branchId: "b1", name: "Tunja Centro", quantity: 4 }],
        },
      ],
    });

    const result = JSON.parse(
      await service().run("buscar_productos", { texto: " creatina " }),
    ) as unknown;

    expect(catalog.listProducts).toHaveBeenCalledWith({
      page: 1,
      limit: 5,
      search: "creatina",
      sort: "name",
    });
    expect(result).toEqual({
      encontrados: 1,
      productos: [
        {
          nombre: "Creatina monohidratada 300 g",
          categoria: "Aminoácidos",
          precio: 99900,
          unidadesEnSedes: 4,
          sedes: [{ sede: "Tunja Centro", unidades: 4 }],
          disponibleEnBodega: true,
        },
      ],
    });
  });

  it("asks for the product name instead of searching with one letter", async () => {
    const result = await service().run("buscar_productos", { texto: "a" });

    expect(catalog.listProducts).not.toHaveBeenCalled();
    expect(result).toContain("error");
  });

  it("lists the active branches with readable schedules", async () => {
    branches.findAll.mockResolvedValue({
      data: [
        {
          name: "Tunja Centro",
          address: "Calle 19 # 10-20",
          phone: "3001234567",
          openNow: true,
          deliveryEnabled: false,
          schedule: [
            {
              dayOfWeek: 1,
              intervals: [{ opensAt: "08:00", closesAt: "18:00" }],
            },
            { dayOfWeek: 7, intervals: [] },
          ],
        },
      ],
    });

    const result = JSON.parse(await service().run("consultar_sedes", {})) as {
      sedes: unknown[];
    };

    expect(branches.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      active: true,
    });
    expect(result.sedes[0]).toEqual({
      nombre: "Tunja Centro",
      direccion: "Calle 19 # 10-20",
      telefono: "3001234567",
      abiertaAhora: true,
      domicilios: false,
      horario: [
        { dia: "lunes", franjas: "08:00-18:00" },
        { dia: "domingo", franjas: "cerrado" },
      ],
    });
  });

  it("tells the model to offer a human when a lookup fails", async () => {
    branches.findAll.mockRejectedValue(new Error("db down"));

    const result = await service().run("consultar_sedes", {});

    expect(result).toContain("Ofrece escalar");
  });

  it("acknowledges the escalation", async () => {
    const result = await service().run("escalar_a_humano", { motivo: "x" });

    expect(JSON.parse(result)).toMatchObject({ escalado: true });
  });
});
