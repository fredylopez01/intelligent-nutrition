import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const getId = (
  ids: Map<string, string>,
  key: string,
  entity: string,
): string => {
  const id = ids.get(key);

  if (!id) {
    throw new Error(`${entity} "${key}" was not seeded`);
  }

  return id;
};

async function main() {
  console.log("Starting database seed...");

  const documentTypes = [
    { code: "CC", name: "Cédula de Ciudadanía" },
    { code: "CE", name: "Cédula de Extranjería" },
    { code: "NIT", name: "Número de Identificación Tributaria" },
    { code: "PAS", name: "Pasaporte" },
  ];
  const documentTypeIds = new Map<string, string>();

  for (const documentType of documentTypes) {
    const seededDocumentType = await prisma.documentType.upsert({
      where: { code: documentType.code },
      update: { name: documentType.name, active: true },
      create: documentType,
    });
    documentTypeIds.set(documentType.code, seededDocumentType.id);
  }

  const roles = [
    {
      name: "SUPERADMIN",
      description: "System administrator with full access",
    },
    { name: "BRANCH_LEADER", description: "Branch leader" },
    { name: "BRANCH_ASSISTANT", description: "Branch assistant" },
    { name: "DEV", description: "Development and technical operations" },
  ];
  const roleIds = new Map<string, string>();

  for (const role of roles) {
    const seededRole = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, active: true },
      create: role,
    });
    roleIds.set(role.name, seededRole.id);
  }

  const people = [
    {
      key: "admin",
      documentTypeCode: "CC",
      documentNumber: "1000000000",
      firstName: "System",
      lastName: "Administrator",
      email: "intelligentnutrition.shop@gmail.com",
      phone: "0000000000",
      address: "System account",
    },
    {
      key: "leader-medellin",
      documentTypeCode: "CC",
      documentNumber: "1039456781",
      firstName: "Laura",
      lastName: "Restrepo",
      email: "laura.restrepo@example.com",
      phone: "3004567812",
      address: "Carrera 43A # 1-50, Medellín",
    },
    {
      key: "leader-bogota",
      documentTypeCode: "CC",
      documentNumber: "1012345678",
      firstName: "Andrés",
      lastName: "Mendoza",
      email: "andres.mendoza@example.com",
      phone: "3102345678",
      address: "Calle 93 # 15-20, Bogotá",
    },
    {
      key: "assistant-medellin",
      documentTypeCode: "CC",
      documentNumber: "1045678901",
      firstName: "Camila",
      lastName: "Vargas",
      email: "camila.vargas@example.com",
      phone: "3015678901",
      address: "Calle 10 # 35-12, Medellín",
    },
    {
      key: "assistant-bogota",
      documentTypeCode: "CC",
      documentNumber: "1023456789",
      firstName: "Santiago",
      lastName: "Pardo",
      email: "santiago.pardo@example.com",
      phone: "3153456789",
      address: "Carrera 11 # 82-10, Bogotá",
    },
    {
      key: "assistant-cali",
      documentTypeCode: "CC",
      documentNumber: "1112345678",
      firstName: "Valentina",
      lastName: "Rojas",
      email: "valentina.rojas@example.com",
      phone: "3162345678",
      address: "Avenida 6N # 23-45, Cali",
    },
    {
      key: "developer",
      documentTypeCode: "CC",
      documentNumber: "1009876543",
      firstName: "Mateo",
      lastName: "Gómez",
      email: "mateo.gomez@example.com",
      phone: "3209876543",
      address: "Carrera 70 # 45-30, Medellín",
    },
    {
      key: "customer-ana",
      documentTypeCode: "CC",
      documentNumber: "43876543",
      firstName: "Ana",
      lastName: "López",
      email: "ana.lopez@example.com",
      phone: "3001112233",
      address: "Calle 33 # 66B-18, Medellín",
    },
    {
      key: "customer-carlos",
      documentTypeCode: "CC",
      documentNumber: "79234567",
      firstName: "Carlos",
      lastName: "Ramírez",
      email: "carlos.ramirez@example.com",
      phone: "3102223344",
      address: "Carrera 15 # 100-25, Bogotá",
    },
    {
      key: "customer-lucia",
      documentTypeCode: "CE",
      documentNumber: "900123456",
      firstName: "Lucía",
      lastName: "Fernández",
      email: "lucia.fernandez@example.com",
      phone: "3203334455",
      address: "Avenida 6 # 24N-30, Cali",
    },
    {
      key: "customer-diego",
      documentTypeCode: "CC",
      documentNumber: "98765432",
      firstName: "Diego",
      lastName: "Torres",
      email: "diego.torres@example.com",
      phone: "3004445566",
      address: "Calle 8 # 43A-22, Medellín",
    },
    {
      key: "supplier-nutri",
      documentTypeCode: "NIT",
      documentNumber: "901234567-1",
      businessName: "Nutri Andina S.A.S.",
      email: "ventas@nutriandina.example",
      phone: "6044441000",
      address: "Carrera 52 # 14-80, Medellín",
    },
    {
      key: "supplier-vital",
      documentTypeCode: "NIT",
      documentNumber: "900765432-2",
      businessName: "Distribuciones Vitales S.A.S.",
      email: "pedidos@distribucionesvitales.example",
      phone: "6015552000",
      address: "Calle 17 # 68D-40, Bogotá",
    },
    {
      key: "supplier-natural",
      documentTypeCode: "NIT",
      documentNumber: "901876543-3",
      businessName: "Laboratorios Naturales del Valle S.A.S.",
      email: "comercial@naturalvalle.example",
      phone: "6026663000",
      address: "Carrera 5 # 28-60, Cali",
    },
  ];
  const personIds = new Map<string, string>();

  for (const person of people) {
    const documentTypeId = getId(
      documentTypeIds,
      person.documentTypeCode,
      "Document type",
    );
    const { key, documentTypeCode: _documentTypeCode, ...personData } = person;
    const seededPerson = await prisma.person.upsert({
      where: {
        documentTypeId_documentNumber: {
          documentTypeId,
          documentNumber: person.documentNumber,
        },
      },
      update: { ...personData, documentTypeId, active: true },
      create: { ...personData, documentTypeId },
    });
    personIds.set(key, seededPerson.id);
  }

  const userAccounts = [
    { personKey: "admin", roleName: "SUPERADMIN", branchNames: [] },
    {
      personKey: "leader-medellin",
      roleName: "BRANCH_LEADER",
      branchNames: ["Intelligent Nutrition - Medellín"],
    },
    {
      personKey: "leader-bogota",
      roleName: "BRANCH_LEADER",
      branchNames: ["Intelligent Nutrition - Bogotá"],
    },
    {
      personKey: "assistant-medellin",
      roleName: "BRANCH_ASSISTANT",
      branchNames: ["Intelligent Nutrition - Medellín"],
    },
    {
      personKey: "assistant-bogota",
      roleName: "BRANCH_ASSISTANT",
      branchNames: ["Intelligent Nutrition - Bogotá"],
    },
    {
      personKey: "assistant-cali",
      roleName: "BRANCH_ASSISTANT",
      branchNames: ["Intelligent Nutrition - Cali"],
    },
    { personKey: "developer", roleName: "DEV", branchNames: [] },
  ];
  const userIds = new Map<string, string>();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const testPassword = process.env.SEED_TEST_PASSWORD;

  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD environment variable is required");
  }
  if (!testPassword) {
    throw new Error("SEED_TEST_PASSWORD environment variable is required");
  }

  const adminPasswordHash = await argon2.hash(adminPassword);
  const testPasswordHash = await argon2.hash(testPassword);

  for (const account of userAccounts) {
    const personId = getId(personIds, account.personKey, "Person");
    const roleId = getId(roleIds, account.roleName, "Role");
    const passwordHash =
      account.personKey === "admin" ? adminPasswordHash : testPasswordHash;
    const seededAccount = await prisma.userAccount.upsert({
      where: { personId },
      update: {
        roleId,
        password: passwordHash,
        active: true,
        mustChangePassword: false,
      },
      create: {
        personId,
        roleId,
        password: passwordHash,
        active: true,
        mustChangePassword: false,
      },
    });
    userIds.set(account.personKey, seededAccount.personId);
  }

  const customers = [
    { personKey: "customer-ana", fullName: "Ana López" },
    { personKey: "customer-carlos", fullName: "Carlos Ramírez" },
    { personKey: "customer-lucia", fullName: "Lucía Fernández" },
    { personKey: "customer-diego", fullName: "Diego Torres" },
  ];
  const customerIds = new Map<string, string>();

  for (const customer of customers) {
    const personId = getId(personIds, customer.personKey, "Person");
    const seededCustomer = await prisma.customer.upsert({
      where: { personId },
      update: { fullName: customer.fullName, active: true },
      create: { personId, fullName: customer.fullName },
    });
    customerIds.set(customer.personKey, seededCustomer.personId);
  }

  const suppliers = [
    {
      personKey: "supplier-nutri",
      commercialName: "Nutri Andina",
    },
    {
      personKey: "supplier-vital",
      commercialName: "Distribuciones Vitales",
    },
    {
      personKey: "supplier-natural",
      commercialName: "Laboratorios Naturales del Valle",
    },
  ];
  const supplierIds = new Map<string, string>();

  for (const supplier of suppliers) {
    const personId = getId(personIds, supplier.personKey, "Person");
    const seededSupplier = await prisma.supplier.upsert({
      where: { personId },
      update: { commercialName: supplier.commercialName, active: true },
      create: { personId, commercialName: supplier.commercialName },
    });
    supplierIds.set(supplier.personKey, seededSupplier.personId);
  }

  const branches = [
    {
      name: "Intelligent Nutrition - Medellín",
      address: "Carrera 43A # 1-50, Medellín",
      phone: "6044441001",
    },
    {
      name: "Intelligent Nutrition - Bogotá",
      address: "Calle 93 # 15-20, Bogotá",
      phone: "6015552001",
    },
    {
      name: "Intelligent Nutrition - Cali",
      address: "Avenida 6N # 23-45, Cali",
      phone: "6026663001",
    },
  ];
  const branchIds = new Map<string, string>();

  for (const branch of branches) {
    const seededBranch = await prisma.branch.upsert({
      where: { name: branch.name },
      update: { ...branch, active: true },
      create: branch,
    });
    branchIds.set(branch.name, seededBranch.id);
  }

  for (const account of userAccounts) {
    const userId = getId(userIds, account.personKey, "User account");

    for (const branchName of account.branchNames) {
      const branchId = getId(branchIds, branchName, "Branch");
      const assignmentDate = new Date("2025-01-01T00:00:00.000Z");

      await prisma.userBranch.upsert({
        where: {
          userId_branchId_assignmentDate: {
            userId,
            branchId,
            assignmentDate,
          },
        },
        update: { active: true, endDate: null },
        create: { userId, branchId, assignmentDate },
      });
    }
  }

  const branchSchedules = [
    { dayOfWeek: 1, opensAt: "09:00", closesAt: "19:00" },
    { dayOfWeek: 2, opensAt: "09:00", closesAt: "19:00" },
    { dayOfWeek: 3, opensAt: "09:00", closesAt: "19:00" },
    { dayOfWeek: 4, opensAt: "09:00", closesAt: "19:00" },
    { dayOfWeek: 5, opensAt: "09:00", closesAt: "19:00" },
    { dayOfWeek: 6, opensAt: "09:00", closesAt: "17:00" },
    { dayOfWeek: 7, opensAt: "10:00", closesAt: "16:00" },
  ];

  for (const branchName of branchIds.keys()) {
    const branchId = getId(branchIds, branchName, "Branch");
    for (const schedule of branchSchedules) {
      await prisma.branchSchedule.upsert({
        where: {
          branchId_dayOfWeek_opensAt: {
            branchId,
            dayOfWeek: schedule.dayOfWeek,
            opensAt: schedule.opensAt,
          },
        },
        update: { closesAt: schedule.closesAt },
        create: { branchId, ...schedule },
      });
    }
  }

  const categories = [
    {
      name: "Proteínas",
      description: "Proteínas en polvo y suplementos para recuperación.",
    },
    {
      name: "Vitaminas y minerales",
      description: "Vitaminas, minerales y fórmulas multinutrientes.",
    },
    {
      name: "Aminoácidos",
      description: "Aminoácidos esenciales y productos para entrenamiento.",
    },
    {
      name: "Control de peso",
      description: "Productos complementarios para planes de control de peso.",
    },
    {
      name: "Accesorios",
      description: "Accesorios para preparación y consumo de suplementos.",
    },
  ];
  const categoryIds = new Map<string, string>();

  for (const category of categories) {
    const seededCategory = await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description, active: true },
      create: category,
    });
    categoryIds.set(category.name, seededCategory.id);
  }

  const units = [
    { name: "Unidad", abreviation: "und" },
    { name: "Gramo", abreviation: "g" },
    { name: "Mililitro", abreviation: "ml" },
    { name: "Cápsula", abreviation: "cap" },
    { name: "Servicio", abreviation: "serv" },
  ];
  const unitIds = new Map<string, string>();

  for (const unit of units) {
    const seededUnit = await prisma.unitMeasure.upsert({
      where: { name: unit.name },
      update: { abreviation: unit.abreviation, active: true },
      create: unit,
    });
    unitIds.set(unit.name, seededUnit.id);
  }

  const products = [
    {
      name: "Proteína Whey Vainilla 2 lb",
      referenceCode: "PRO-WHEY-VAN-2LB",
      description: "Proteína de suero sabor vainilla, presentación de 2 lb.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 189900,
    },
    {
      name: "Proteína Whey Chocolate 2 lb",
      referenceCode: "PRO-WHEY-CHO-2LB",
      description: "Proteína de suero sabor chocolate, presentación de 2 lb.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 189900,
    },
    {
      name: "Proteína vegetal natural 1 lb",
      referenceCode: "PRO-VEG-NAT-1LB",
      description: "Mezcla vegetal de arveja y arroz, sin saborizantes.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 124900,
    },
    {
      name: "Creatina monohidratada 300 g",
      referenceCode: "AMI-CREA-300G",
      description: "Creatina monohidratada micronizada.",
      categoryName: "Aminoácidos",
      unitName: "Unidad",
      price: 99900,
    },
    {
      name: "BCAA frutos rojos 300 g",
      referenceCode: "AMI-BCAA-300G",
      description: "Aminoácidos ramificados sabor frutos rojos.",
      categoryName: "Aminoácidos",
      unitName: "Unidad",
      price: 112900,
    },
    {
      name: "Multivitamínico diario 60 cápsulas",
      referenceCode: "VIT-MULTI-60C",
      description: "Complejo multivitamínico para consumo diario.",
      categoryName: "Vitaminas y minerales",
      unitName: "Unidad",
      price: 64900,
    },
    {
      name: "Vitamina C 1000 mg 30 cápsulas",
      referenceCode: "VIT-C-1000-30C",
      description: "Vitamina C de 1000 mg por cápsula.",
      categoryName: "Vitaminas y minerales",
      unitName: "Unidad",
      price: 42900,
    },
    {
      name: "Omega 3 1000 mg 60 cápsulas",
      referenceCode: "VIT-OMEGA3-60C",
      description: "Aceite de pescado con ácidos grasos omega 3.",
      categoryName: "Vitaminas y minerales",
      unitName: "Unidad",
      price: 79900,
    },
    {
      name: "Colágeno hidrolizado 300 g",
      referenceCode: "CON-COL-300G",
      description: "Colágeno hidrolizado sabor neutro.",
      categoryName: "Control de peso",
      unitName: "Unidad",
      price: 87900,
    },
    {
      name: "Fibra soluble 250 g",
      referenceCode: "CON-FIB-250G",
      description: "Mezcla de fibra soluble para bebidas.",
      categoryName: "Control de peso",
      unitName: "Unidad",
      price: 52900,
    },
    {
      name: "Shaker deportivo 700 ml",
      referenceCode: "ACC-SHAKER-700",
      description: "Botella mezcladora con tapa hermética.",
      categoryName: "Accesorios",
      unitName: "Unidad",
      price: 29900,
    },
    {
      name: "Cuchara medidora 30 g",
      referenceCode: "ACC-SCOOP-30G",
      description: "Cuchara medidora reutilizable para suplementos.",
      categoryName: "Accesorios",
      unitName: "Unidad",
      price: 4900,
    },
    {
      name: "Proteína Whey Cookies 2 lb",
      referenceCode: "PRO-WHEY-COO-2LB",
      description: "Proteína de suero sabor galleta, presentación de 2 lb.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 194900,
    },
    {
      name: "Proteína isolate natural 1 lb",
      referenceCode: "PRO-ISO-NAT-1LB",
      description: "Aislado de proteína de suero sin saborizantes.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 169900,
    },
    {
      name: "Proteína vegana chocolate 1 lb",
      referenceCode: "PRO-VEG-CHO-1LB",
      description: "Mezcla vegetal de arveja y arroz sabor chocolate.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 134900,
    },
    {
      name: "Creatina monohidratada 500 g",
      referenceCode: "AMI-CREA-500G",
      description: "Creatina monohidratada micronizada de 500 g.",
      categoryName: "Aminoácidos",
      unitName: "Unidad",
      price: 149900,
    },
    {
      name: "Glutamina micronizada 300 g",
      referenceCode: "AMI-GLUTA-300G",
      description: "L-glutamina micronizada para mezclar.",
      categoryName: "Aminoácidos",
      unitName: "Unidad",
      price: 89900,
    },
    {
      name: "Zinc 25 mg 60 cápsulas",
      referenceCode: "VIT-ZINC-25-60C",
      description: "Suplemento de zinc en presentación de 60 cápsulas.",
      categoryName: "Vitaminas y minerales",
      unitName: "Unidad",
      price: 35900,
    },
    {
      name: "Vitamina D3 2000 UI 60 cápsulas",
      referenceCode: "VIT-D3-2000-60C",
      description: "Vitamina D3 en presentación de 60 cápsulas.",
      categoryName: "Vitaminas y minerales",
      unitName: "Unidad",
      price: 45900,
    },
    {
      name: "Magnesio quelado 60 cápsulas",
      referenceCode: "VIT-MAG-60C",
      description: "Magnesio quelado en presentación de 60 cápsulas.",
      categoryName: "Vitaminas y minerales",
      unitName: "Unidad",
      price: 56900,
    },
    {
      name: "Té verde extracto 60 cápsulas",
      referenceCode: "CON-TEVERDE-60C",
      description: "Extracto de té verde en presentación de 60 cápsulas.",
      categoryName: "Control de peso",
      unitName: "Unidad",
      price: 48900,
    },
    {
      name: "Banda elástica de resistencia",
      referenceCode: "ACC-BANDA-RES",
      description: "Banda elástica para ejercicios de resistencia.",
      categoryName: "Accesorios",
      unitName: "Unidad",
      price: 19900,
    },
    {
      name: "Shaker deportivo 1000 ml",
      referenceCode: "ACC-SHAKER-1000",
      description: "Botella mezcladora de 1000 ml con tapa hermética.",
      categoryName: "Accesorios",
      unitName: "Unidad",
      price: 34900,
    },
    {
      name: "Barra proteica chocolate 60 g",
      referenceCode: "PRO-BAR-CHO-60G",
      description: "Barra de proteína sabor chocolate de 60 g.",
      categoryName: "Proteínas",
      unitName: "Unidad",
      price: 12900,
    },
    {
      name: "Electrolitos limón 20 servicios",
      referenceCode: "AMI-ELECTRO-LIM-20",
      description: "Mezcla en polvo de electrolitos sabor limón.",
      categoryName: "Aminoácidos",
      unitName: "Unidad",
      price: 39900,
    },
    {
      name: "Avena instantánea 500 g",
      referenceCode: "CON-AVENA-500G",
      description: "Avena instantánea para bebidas y preparaciones.",
      categoryName: "Control de peso",
      unitName: "Unidad",
      price: 16900,
    },
  ];
  const productIds = new Map<string, string>();

  for (const product of products) {
    const categoryId = getId(categoryIds, product.categoryName, "Category");
    const unitOfMeasureId = getId(unitIds, product.unitName, "Unit measure");
    const {
      categoryName: _categoryName,
      unitName: _unitName,
      ...productData
    } = product;
    const seededProduct = await prisma.product.upsert({
      where: { referenceCode: product.referenceCode },
      update: {
        ...productData,
        categoryId,
        unitOfMeasureId,
        active: true,
      },
      create: { ...productData, categoryId, unitOfMeasureId },
    });
    productIds.set(product.referenceCode, seededProduct.id);
  }

  const inventory = [
    {
      branch: "Medellín",
      product: "PRO-WHEY-VAN-2LB",
      quantity: 24,
      minimum: 5,
    },
    {
      branch: "Medellín",
      product: "PRO-WHEY-CHO-2LB",
      quantity: 18,
      minimum: 5,
    },
    {
      branch: "Medellín",
      product: "PRO-VEG-NAT-1LB",
      quantity: 12,
      minimum: 3,
    },
    { branch: "Medellín", product: "AMI-CREA-300G", quantity: 30, minimum: 8 },
    { branch: "Medellín", product: "AMI-BCAA-300G", quantity: 14, minimum: 4 },
    { branch: "Medellín", product: "VIT-MULTI-60C", quantity: 40, minimum: 10 },
    { branch: "Medellín", product: "VIT-C-1000-30C", quantity: 35, minimum: 8 },
    { branch: "Medellín", product: "VIT-OMEGA3-60C", quantity: 20, minimum: 5 },
    { branch: "Bogotá", product: "PRO-WHEY-VAN-2LB", quantity: 16, minimum: 5 },
    { branch: "Bogotá", product: "PRO-WHEY-CHO-2LB", quantity: 22, minimum: 5 },
    { branch: "Bogotá", product: "AMI-CREA-300G", quantity: 25, minimum: 8 },
    { branch: "Bogotá", product: "VIT-MULTI-60C", quantity: 28, minimum: 10 },
    { branch: "Bogotá", product: "CON-COL-300G", quantity: 17, minimum: 4 },
    { branch: "Cali", product: "PRO-VEG-NAT-1LB", quantity: 10, minimum: 3 },
    { branch: "Cali", product: "AMI-CREA-300G", quantity: 12, minimum: 5 },
    { branch: "Cali", product: "VIT-C-1000-30C", quantity: 3, minimum: 8 },
    { branch: "Cali", product: "ACC-SHAKER-700", quantity: 20, minimum: 5 },
    { branch: "Cali", product: "ACC-SCOOP-30G", quantity: 50, minimum: 10 },
  ];
  const expirationDate = new Date("2028-12-31T00:00:00.000Z");
  const inventoryQuantities = new Map<string, number>();

  for (const item of inventory) {
    const branchId = getId(
      branchIds,
      `Intelligent Nutrition - ${item.branch}`,
      "Branch",
    );
    const productId = getId(productIds, item.product, "Product");

    await prisma.branchInventory.upsert({
      where: {
        branchId_productId_expirationDate: {
          branchId,
          productId,
          expirationDate,
        },
      },
      update: {
        quantity: item.quantity,
        minimumStock: item.minimum,
      },
      create: {
        branchId,
        productId,
        quantity: item.quantity,
        minimumStock: item.minimum,
        expirationDate,
      },
    });
    inventoryQuantities.set(`${item.branch}:${item.product}`, item.quantity);
  }

  const branchNames = ["Medellín", "Bogotá", "Cali"] as const;
  for (const [productIndex, product] of products.entries()) {
    for (const [branchIndex, branch] of branchNames.entries()) {
      const inventoryKey = `${branch}:${product.referenceCode}`;
      if (inventoryQuantities.has(inventoryKey)) {
        continue;
      }

      const quantity = 6 + ((productIndex * 7 + branchIndex * 11) % 35);
      const branchId = getId(
        branchIds,
        `Intelligent Nutrition - ${branch}`,
        "Branch",
      );
      const productId = getId(productIds, product.referenceCode, "Product");

      await prisma.branchInventory.upsert({
        where: {
          branchId_productId_expirationDate: {
            branchId,
            productId,
            expirationDate,
          },
        },
        update: { quantity, minimumStock: 5 },
        create: {
          branchId,
          productId,
          quantity,
          minimumStock: 5,
          expirationDate,
        },
      });
      inventoryQuantities.set(inventoryKey, quantity);
    }
  }

  for (const product of products) {
    const productId = getId(productIds, product.referenceCode, "Product");
    const quantity = branchNames.reduce(
      (total, branch) =>
        total +
        (inventoryQuantities.get(`${branch}:${product.referenceCode}`) ?? 0),
      0,
    );
    await prisma.generalStock.upsert({
      where: { productId_expirationDate: { productId, expirationDate } },
      update: { quantity },
      create: { productId, quantity, expirationDate },
    });
  }

  const movements = [
    {
      product: "PRO-WHEY-VAN-2LB",
      branch: "Medellín",
      type: "ENTRY",
      quantity: 30,
      user: "leader-medellin",
      observation: "Ingreso inicial de inventario.",
      movementAt: new Date("2025-01-05T09:00:00.000Z"),
    },
    {
      product: "PRO-WHEY-VAN-2LB",
      branch: "Medellín",
      type: "EXIT",
      quantity: 6,
      user: "assistant-medellin",
      observation: "Salida por venta de mostrador.",
      movementAt: new Date("2025-01-12T14:30:00.000Z"),
    },
    {
      product: "AMI-CREA-300G",
      branch: "Bogotá",
      type: "ENTRY",
      quantity: 25,
      user: "leader-bogota",
      observation: "Recepción de pedido del proveedor.",
      movementAt: new Date("2025-02-03T10:15:00.000Z"),
    },
    {
      product: "VIT-C-1000-30C",
      branch: "Cali",
      type: "ADJUSTMENT_EXIT",
      quantity: 2,
      user: "assistant-cali",
      observation: "Ajuste por producto averiado.",
      movementAt: new Date("2025-02-10T16:00:00.000Z"),
    },
    {
      product: "PRO-WHEY-CHO-2LB",
      branch: "Bogotá",
      originBranch: "Medellín",
      type: "TRANSFER",
      quantity: 4,
      user: "leader-bogota",
      observation: "Traslado de producto desde Medellín.",
      movementAt: new Date("2025-02-14T11:45:00.000Z"),
    },
    {
      product: "ACC-SHAKER-700",
      branch: "Cali",
      type: "ADJUSTMENT_ENTRY",
      quantity: 3,
      user: "assistant-cali",
      observation: "Ajuste tras conteo físico.",
      movementAt: new Date("2025-02-18T08:20:00.000Z"),
    },
  ] as const;

  for (const movement of movements) {
    const productId = getId(productIds, movement.product, "Product");
    const userId = getId(userIds, movement.user, "User account");
    const branchId = movement.branch
      ? getId(branchIds, `Intelligent Nutrition - ${movement.branch}`, "Branch")
      : null;
    const originBranchId =
      "originBranch" in movement && movement.originBranch
        ? getId(
            branchIds,
            `Intelligent Nutrition - ${movement.originBranch}`,
            "Branch",
          )
        : null;
    const existingMovement = await prisma.inventoryMovement.findFirst({
      where: {
        productId,
        branchId,
        originBranchId,
        userId,
        movementType: movement.type,
        quantity: movement.quantity,
        movementAt: movement.movementAt,
      },
    });

    if (!existingMovement) {
      await prisma.inventoryMovement.create({
        data: {
          productId,
          branchId,
          originBranchId,
          userId,
          movementType: movement.type,
          quantity: movement.quantity,
          observation: movement.observation,
          movementAt: movement.movementAt,
        },
      });
    }
  }

  const paymentMethods = [
    { code: "CASH", name: "Efectivo" },
    { code: "CARD", name: "Tarjeta" },
    { code: "TRANSFER", name: "Transferencia" },
  ];
  const paymentMethodIds = new Map<string, string>();

  for (const paymentMethod of paymentMethods) {
    const seededPaymentMethod = await prisma.paymentMethod.upsert({
      where: { code: paymentMethod.code },
      update: { name: paymentMethod.name, active: true },
      create: paymentMethod,
    });
    paymentMethodIds.set(paymentMethod.code, seededPaymentMethod.id);
  }

  const supplies = [
    { name: "Avena en hojuelas", unitName: "Gramo" },
    { name: "Leche deslactosada", unitName: "Mililitro" },
    { name: "Banano", unitName: "Unidad" },
    { name: "Cacao en polvo", unitName: "Gramo" },
    { name: "Mantequilla de maní", unitName: "Gramo" },
    { name: "Proteína de suero a granel", unitName: "Gramo" },
  ];
  const supplyIds = new Map<string, string>();

  for (const supply of supplies) {
    const unitOfMeasureId = getId(
      unitIds,
      supply.unitName,
      "Supply unit measure",
    );
    const seededSupply = await prisma.supply.upsert({
      where: { name: supply.name },
      update: { unitOfMeasureId, active: true },
      create: { name: supply.name, unitOfMeasureId },
    });
    supplyIds.set(supply.name, seededSupply.id);
  }

  const recipes = [
    {
      name: "Batido de avena y banano",
      description: "Preparación de avena, leche, banano y proteína.",
      ingredients: [
        { supply: "Avena en hojuelas", quantity: 40, unit: "Gramo" },
        { supply: "Leche deslactosada", quantity: 250, unit: "Mililitro" },
        { supply: "Banano", quantity: 1, unit: "Unidad" },
        { supply: "Proteína de suero a granel", quantity: 30, unit: "Gramo" },
      ],
    },
    {
      name: "Batido de chocolate",
      description: "Batido de leche, cacao, avena y proteína.",
      ingredients: [
        { supply: "Leche deslactosada", quantity: 300, unit: "Mililitro" },
        { supply: "Cacao en polvo", quantity: 8, unit: "Gramo" },
        { supply: "Avena en hojuelas", quantity: 30, unit: "Gramo" },
        { supply: "Proteína de suero a granel", quantity: 30, unit: "Gramo" },
      ],
    },
    {
      name: "Avena proteica con cacao",
      description: "Avena preparada con leche, cacao y proteína.",
      ingredients: [
        { supply: "Avena en hojuelas", quantity: 60, unit: "Gramo" },
        { supply: "Leche deslactosada", quantity: 200, unit: "Mililitro" },
        { supply: "Cacao en polvo", quantity: 5, unit: "Gramo" },
        { supply: "Proteína de suero a granel", quantity: 25, unit: "Gramo" },
      ],
    },
    {
      name: "Batido de banano y maní",
      description: "Batido de banano, leche y mantequilla de maní.",
      ingredients: [
        { supply: "Banano", quantity: 1, unit: "Unidad" },
        { supply: "Leche deslactosada", quantity: 250, unit: "Mililitro" },
        { supply: "Mantequilla de maní", quantity: 15, unit: "Gramo" },
        { supply: "Proteína de suero a granel", quantity: 25, unit: "Gramo" },
      ],
    },
    {
      name: "Avena fría con banano",
      description: "Preparación fría de avena, leche y banano.",
      ingredients: [
        { supply: "Avena en hojuelas", quantity: 50, unit: "Gramo" },
        { supply: "Leche deslactosada", quantity: 200, unit: "Mililitro" },
        { supply: "Banano", quantity: 1, unit: "Unidad" },
        { supply: "Mantequilla de maní", quantity: 10, unit: "Gramo" },
      ],
    },
    {
      name: "Batido de cacao y maní",
      description: "Batido de cacao, leche, maní y proteína.",
      ingredients: [
        { supply: "Leche deslactosada", quantity: 250, unit: "Mililitro" },
        { supply: "Cacao en polvo", quantity: 8, unit: "Gramo" },
        { supply: "Mantequilla de maní", quantity: 12, unit: "Gramo" },
        { supply: "Proteína de suero a granel", quantity: 30, unit: "Gramo" },
      ],
    },
  ];
  const recipeIds = new Map<string, string>();
  const recipeUserId = getId(userIds, "leader-medellin", "User account");

  for (const recipe of recipes) {
    const seededRecipe = await prisma.recipe.upsert({
      where: { name: recipe.name },
      update: {
        description: recipe.description,
        createdById: recipeUserId,
        active: true,
      },
      create: {
        name: recipe.name,
        description: recipe.description,
        createdById: recipeUserId,
      },
    });
    recipeIds.set(recipe.name, seededRecipe.id);

    for (const ingredient of recipe.ingredients) {
      const recipeId = getId(recipeIds, recipe.name, "Recipe");
      const supplyId = getId(supplyIds, ingredient.supply, "Supply");
      const unitOfMeasureId = getId(
        unitIds,
        ingredient.unit,
        "Ingredient unit measure",
      );
      await prisma.recipeIngredient.upsert({
        where: { recipeId_supplyId: { recipeId, supplyId } },
        update: { quantity: ingredient.quantity, unitOfMeasureId },
        create: {
          recipeId,
          supplyId,
          quantity: ingredient.quantity,
          unitOfMeasureId,
        },
      });
    }
  }

  const promotions = [
    {
      name: "Bienvenida saludable",
      discountPercentage: 10,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
    },
    {
      name: "Mes del bienestar",
      discountPercentage: 15,
      startDate: new Date("2025-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
    },
  ];
  const promotionIds = new Map<string, string>();

  for (const promotion of promotions) {
    const seededPromotion = await prisma.promotion.upsert({
      where: { name: promotion.name },
      update: {
        ...promotion,
        createdById: recipeUserId,
        active: false,
      },
      create: {
        ...promotion,
        createdById: recipeUserId,
        active: false,
      },
    });
    promotionIds.set(promotion.name, seededPromotion.id);
  }

  const branchCodes = ["MED", "BOG", "CAL"] as const;
  const branchUsers = [
    "assistant-medellin",
    "assistant-bogota",
    "assistant-cali",
  ] as const;
  const lastShiftByBranchMonth = new Map<string, string>();
  const firstHistoryYear = 2025;
  const historyMonthCount = 22;
  const paymentCodes = ["CASH", "CARD", "TRANSFER"] as const;

  for (let monthIndex = 0; monthIndex < historyMonthCount; monthIndex += 1) {
    const year = firstHistoryYear + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const monthKey = `${year}${String(month + 1).padStart(2, "0")}`;

    for (
      let branchIndex = 0;
      branchIndex < branchNames.length;
      branchIndex += 1
    ) {
      const branchName = branchNames[branchIndex];
      const branchCode = branchCodes[branchIndex];
      const branchId = getId(
        branchIds,
        `Intelligent Nutrition - ${branchName}`,
        "Branch",
      );
      const userId = getId(userIds, branchUsers[branchIndex], "User account");

      for (let saleIndex = 0; saleIndex < 4; saleIndex += 1) {
        const saleDate = new Date(
          Date.UTC(year, month, 5 + saleIndex * 7, 10 + saleIndex, 30),
        );
        const saleNumber = `DEMO-${branchCode}-${monthKey}-${saleIndex + 1}`;
        const customerKey =
          saleIndex === 3
            ? undefined
            : [
                "customer-ana",
                "customer-carlos",
                "customer-lucia",
                "customer-diego",
              ][(monthIndex + branchIndex + saleIndex) % 4];
        const customerId = customerKey
          ? getId(customerIds, customerKey, "Customer")
          : null;
        const selectedProductCount =
          1 + ((monthIndex + saleIndex + branchIndex) % 3);
        const firstProductIndex =
          monthIndex * 3 + saleIndex * 5 + branchIndex * 4;
        const promotion =
          (monthIndex + saleIndex + branchIndex) % 5 === 0
            ? promotions[
                (monthIndex + saleIndex + branchIndex) % promotions.length
              ]
            : undefined;
        const saleLines = Array.from(
          { length: selectedProductCount },
          (_, lineIndex) => {
            const product =
              products[(firstProductIndex + lineIndex * 5) % products.length];
            const quantity =
              1 + ((monthIndex + saleIndex + lineIndex + branchIndex) % 3);
            return {
              product,
              quantity,
              subtotal: product.price * quantity,
              discountAmount: promotion
                ? Math.round(
                    (product.price * quantity * promotion.discountPercentage) /
                      100,
                  )
                : 0,
            };
          },
        );
        const subtotal = saleLines.reduce(
          (sum, line) => sum + line.subtotal,
          0,
        );
        const discountAmount = saleLines.reduce(
          (sum, line) => sum + line.discountAmount,
          0,
        );
        const total = subtotal - discountAmount;
        const promotionId = promotion
          ? getId(promotionIds, promotion.name, "Promotion")
          : null;
        const paymentCode =
          paymentCodes[
            (monthIndex + saleIndex + branchIndex) % paymentCodes.length
          ];
        const seededSale = await prisma.sale.upsert({
          where: { branchId_saleNumber: { branchId, saleNumber } },
          update: {
            userId,
            customerId,
            saleAt: saleDate,
            subtotal,
            discountAmount,
            discountReason: promotion?.name ?? null,
            taxAmount: 0,
            total,
            promotionId,
            promotionDiscount: promotion ? discountAmount : null,
            status: "COMPLETED",
            reversalReason: null,
            reversedAt: null,
          },
          create: {
            branchId,
            userId,
            customerId,
            saleNumber,
            saleAt: saleDate,
            subtotal,
            discountAmount,
            discountReason: promotion?.name ?? null,
            taxAmount: 0,
            total,
            promotionId,
            promotionDiscount: promotion ? discountAmount : null,
            status: "COMPLETED",
          },
        });

        for (const line of saleLines) {
          const productId = getId(
            productIds,
            line.product.referenceCode,
            "Product",
          );
          const existingDetail = await prisma.saleDetail.findFirst({
            where: { saleId: seededSale.id, productId },
          });
          const detailData = {
            quantity: line.quantity,
            unitPrice: line.product.price,
            subtotal: line.subtotal,
            discountAmount: line.discountAmount,
            taxAmount: 0,
            total: line.subtotal - line.discountAmount,
          };
          if (existingDetail) {
            await prisma.saleDetail.update({
              where: { id: existingDetail.id },
              data: detailData,
            });
          } else {
            await prisma.saleDetail.create({
              data: { saleId: seededSale.id, productId, ...detailData },
            });
          }

          const existingSaleMovement = await prisma.inventoryMovement.findFirst(
            {
              where: {
                saleId: seededSale.id,
                productId,
                branchId,
                userId,
                movementType: "EXIT",
                quantity: line.quantity,
                movementAt: saleDate,
              },
            },
          );
          if (!existingSaleMovement) {
            await prisma.inventoryMovement.create({
              data: {
                saleId: seededSale.id,
                productId,
                branchId,
                userId,
                movementType: "EXIT",
                quantity: line.quantity,
                observation: `Salida asociada a venta ${saleNumber}.`,
                movementAt: saleDate,
              },
            });
          }
        }

        const paymentMethodId = getId(
          paymentMethodIds,
          paymentCode,
          "Payment method",
        );
        const paymentReference = `DEMO-${saleNumber}`;
        const existingPayment = await prisma.salePayment.findFirst({
          where: {
            saleId: seededSale.id,
            paymentMethodId,
            reference: paymentReference,
          },
        });
        if (existingPayment) {
          await prisma.salePayment.update({
            where: { id: existingPayment.id },
            data: { amount: total, paidAt: saleDate },
          });
        } else {
          await prisma.salePayment.create({
            data: {
              saleId: seededSale.id,
              paymentMethodId,
              amount: total,
              reference: paymentReference,
              paidAt: saleDate,
            },
          });
        }

        const cashAmount = paymentCode === "CASH" ? total : 0;
        const openedAt = new Date(Date.UTC(year, month, 5 + saleIndex * 7, 8));
        const closedAt = new Date(Date.UTC(year, month, 5 + saleIndex * 7, 19));
        const openingAmount = 150000 + branchIndex * 25000;
        const existingShift = await prisma.cashShift.findFirst({
          where: { branchId, userId, openedAt },
        });
        const seededShift = existingShift
          ? await prisma.cashShift.update({
              where: { id: existingShift.id },
              data: {
                closedAt,
                openingAmount,
                closingAmount: openingAmount + cashAmount,
                status: "CLOSED",
                observation: `Turno de prueba del ${saleDate.toISOString().slice(0, 10)}.`,
              },
            })
          : await prisma.cashShift.create({
              data: {
                branchId,
                userId,
                openedAt,
                closedAt,
                openingAmount,
                closingAmount: openingAmount + cashAmount,
                status: "CLOSED",
                observation: `Turno de prueba del ${saleDate.toISOString().slice(0, 10)}.`,
              },
            });
        lastShiftByBranchMonth.set(`${branchCode}-${monthKey}`, seededShift.id);
      }
    }
  }

  for (let monthIndex = 0; monthIndex < historyMonthCount; monthIndex += 1) {
    const year = firstHistoryYear + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const monthKey = `${year}${String(month + 1).padStart(2, "0")}`;
    const purchaseDate = new Date(Date.UTC(year, month, 2, 9));
    const purchaseSupplierKeys = [
      "supplier-nutri",
      "supplier-vital",
      "supplier-natural",
    ] as const;
    const supplierId = getId(
      supplierIds,
      purchaseSupplierKeys[monthIndex % purchaseSupplierKeys.length],
      "Supplier",
    );
    const purchaseUserId = getId(
      userIds,
      branchUsers[monthIndex % branchUsers.length],
      "User account",
    );
    const purchaseNumber = `DEMO-COMP-${monthKey}`;
    const purchaseStatus =
      monthIndex % 11 === 0
        ? "PENDING_RECEIPT"
        : monthIndex % 7 === 0
          ? "PARTIALLY_RECEIVED"
          : "FULLY_RECEIVED";
    const purchaseLines = [0, 1].map((lineIndex) => {
      const product =
        products[(monthIndex * 3 + lineIndex * 7) % products.length];
      const requestedQuantity = 8 + ((monthIndex + lineIndex * 3) % 9);
      const unitPrice = Math.round(product.price * 0.65);
      const received =
        purchaseStatus === "FULLY_RECEIVED" ||
        (purchaseStatus === "PARTIALLY_RECEIVED" && lineIndex === 0);
      return {
        product,
        requestedQuantity,
        receivedQuantity: received ? requestedQuantity : 0,
        unitPrice,
        subtotal: requestedQuantity * unitPrice,
        received,
      };
    });
    const purchaseSubtotal = purchaseLines.reduce(
      (sum, line) => sum + line.subtotal,
      0,
    );
    const seededPurchase = await prisma.purchase.upsert({
      where: { purchaseNumber },
      update: {
        supplierId,
        userId: purchaseUserId,
        purchaseAt: purchaseDate,
        subtotal: purchaseSubtotal,
        total: purchaseSubtotal,
        observation: "Orden histórica de prueba para reportes.",
        status: purchaseStatus,
      },
      create: {
        purchaseNumber,
        supplierId,
        userId: purchaseUserId,
        purchaseAt: purchaseDate,
        subtotal: purchaseSubtotal,
        total: purchaseSubtotal,
        observation: "Orden histórica de prueba para reportes.",
        status: purchaseStatus,
      },
    });

    for (const [lineIndex, line] of purchaseLines.entries()) {
      const productId = getId(
        productIds,
        line.product.referenceCode,
        "Product",
      );
      const purchaseBranch =
        branchNames[(monthIndex + lineIndex) % branchNames.length];
      const branchId = getId(
        branchIds,
        `Intelligent Nutrition - ${purchaseBranch}`,
        "Branch",
      );
      const existingDetail = await prisma.purchaseDetail.findFirst({
        where: { purchaseId: seededPurchase.id, productId, branchId },
      });
      const detailData = {
        requestedQuantity: line.requestedQuantity,
        receivedQuantity: line.receivedQuantity,
        unitPrice: line.unitPrice,
        subtotal: line.subtotal,
        observation: line.received
          ? "Recepción registrada en la fecha de compra."
          : "Pendiente de recepción.",
        received: line.received,
      };
      if (existingDetail) {
        await prisma.purchaseDetail.update({
          where: { id: existingDetail.id },
          data: detailData,
        });
      } else {
        await prisma.purchaseDetail.create({
          data: {
            purchaseId: seededPurchase.id,
            productId,
            branchId,
            ...detailData,
          },
        });
      }

      if (line.received) {
        const movementAt = new Date(Date.UTC(year, month, 3 + lineIndex, 11));
        const existingPurchaseMovement =
          await prisma.inventoryMovement.findFirst({
            where: {
              purchaseId: seededPurchase.id,
              productId,
              branchId,
              userId: purchaseUserId,
              movementType: "ENTRY",
              quantity: line.receivedQuantity,
              movementAt,
            },
          });
        if (!existingPurchaseMovement) {
          await prisma.inventoryMovement.create({
            data: {
              purchaseId: seededPurchase.id,
              productId,
              branchId,
              userId: purchaseUserId,
              movementType: "ENTRY",
              quantity: line.receivedQuantity,
              observation: `Recepción de compra ${purchaseNumber}.`,
              movementAt,
            },
          });
        }
      }
    }
  }

  for (let monthIndex = 0; monthIndex < historyMonthCount; monthIndex += 1) {
    const year = firstHistoryYear + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const monthKey = `${year}${String(month + 1).padStart(2, "0")}`;

    for (const [branchIndex, branchName] of branchNames.entries()) {
      const branchCode = branchCodes[branchIndex];
      const branchId = getId(
        branchIds,
        `Intelligent Nutrition - ${branchName}`,
        "Branch",
      );
      const userId = getId(userIds, branchUsers[branchIndex], "User account");
      const shiftId = lastShiftByBranchMonth.get(`${branchCode}-${monthKey}`);
      if (!shiftId) {
        throw new Error(
          `Cash shift for ${branchName} ${monthKey} was not seeded`,
        );
      }
      const closureDate = new Date(Date.UTC(year, month + 1, 0));
      const notConfirmed = monthIndex % 9 === 0;
      const seededClosure = await prisma.inventoryClosure.upsert({
        where: { branchId_closureDate: { branchId, closureDate } },
        update: {
          userId,
          cashShiftId: shiftId,
          status: notConfirmed ? "NOT_CONFIRMED" : "CONFIRMED",
          confirmed: !notConfirmed,
          locked: !notConfirmed,
          closedAt: notConfirmed
            ? null
            : new Date(Date.UTC(year, month + 1, 0, 19)),
        },
        create: {
          branchId,
          userId,
          cashShiftId: shiftId,
          closureDate,
          status: notConfirmed ? "NOT_CONFIRMED" : "CONFIRMED",
          confirmed: !notConfirmed,
          locked: !notConfirmed,
          closedAt: notConfirmed
            ? null
            : new Date(Date.UTC(year, month + 1, 0, 19)),
        },
      });

      for (const [productIndex, product] of products.entries()) {
        if (productIndex % 3 !== branchIndex) {
          continue;
        }
        const productId = getId(productIds, product.referenceCode, "Product");
        const currentQuantity =
          inventoryQuantities.get(`${branchName}:${product.referenceCode}`) ??
          0;
        const systemQuantity = Math.max(
          0,
          currentQuantity + ((monthIndex + productIndex) % 7) - 3,
        );
        const difference =
          (monthIndex + productIndex + branchIndex) % 5 === 0 ? -1 : 0;
        await prisma.inventoryClosureDetail.upsert({
          where: {
            closureId_productId_expirationDate: {
              closureId: seededClosure.id,
              productId,
              expirationDate,
            },
          },
          update: {
            systemQuantity,
            physicalQuantity: systemQuantity + difference,
            difference,
            observation: difference
              ? "Diferencia detectada en conteo de prueba."
              : "Conteo físico coincide con el sistema.",
          },
          create: {
            closureId: seededClosure.id,
            productId,
            systemQuantity,
            physicalQuantity: systemQuantity + difference,
            difference,
            expirationDate,
            observation: difference
              ? "Diferencia detectada en conteo de prueba."
              : "Conteo físico coincide con el sistema.",
          },
        });
      }

      for (const [supplyIndex, supply] of supplies.entries()) {
        const supplyId = getId(supplyIds, supply.name, "Supply");
        const systemQuantity =
          20 + ((monthIndex + branchIndex + supplyIndex) % 18);
        const difference = (monthIndex + supplyIndex) % 6 === 0 ? -0.5 : 0;
        await prisma.inventoryClosureSupplyDetail.upsert({
          where: {
            closureId_supplyId: {
              closureId: seededClosure.id,
              supplyId,
            },
          },
          update: {
            systemQuantity,
            physicalQuantity: systemQuantity + difference,
            difference,
            observation: difference
              ? "Diferencia detectada en conteo de insumos."
              : "Conteo de insumos coincide con el sistema.",
          },
          create: {
            closureId: seededClosure.id,
            supplyId,
            systemQuantity,
            physicalQuantity: systemQuantity + difference,
            difference,
            observation: difference
              ? "Diferencia detectada en conteo de insumos."
              : "Conteo de insumos coincide con el sistema.",
          },
        });
      }

      if (notConfirmed) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId,
            branchId,
            type: "CLOSURE_NOT_CONFIRMED",
            title: `Cierre pendiente - ${monthKey}`,
          },
        });
        if (!existingNotification) {
          await prisma.notification.create({
            data: {
              userId,
              branchId,
              type: "CLOSURE_NOT_CONFIRMED",
              title: `Cierre pendiente - ${monthKey}`,
              message: `El cierre de inventario de ${branchName} requiere revisión.`,
            },
          });
        }
      }
    }
  }

  for (const [branchIndex, branchName] of branchNames.entries()) {
    const branchId = getId(
      branchIds,
      `Intelligent Nutrition - ${branchName}`,
      "Branch",
    );
    for (const [supplyIndex, supply] of supplies.entries()) {
      const supplyId = getId(supplyIds, supply.name, "Supply");
      const quantity = 18 + ((branchIndex * 7 + supplyIndex * 5) % 20);
      const minimumQuantity = 5 + (supplyIndex % 4);
      await prisma.supplyStock.upsert({
        where: { branchId_supplyId: { branchId, supplyId } },
        update: { quantity, minimumQuantity },
        create: { branchId, supplyId, quantity, minimumQuantity },
      });
    }
  }

  for (let monthIndex = 0; monthIndex < historyMonthCount; monthIndex += 1) {
    const year = firstHistoryYear + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    for (const [branchIndex, branchName] of branchNames.entries()) {
      const branchId = getId(
        branchIds,
        `Intelligent Nutrition - ${branchName}`,
        "Branch",
      );
      const userId = getId(userIds, branchUsers[branchIndex], "User account");
      const supply = supplies[(monthIndex + branchIndex) % supplies.length];
      const supplyId = getId(supplyIds, supply.name, "Supply");
      const movementType = monthIndex % 2 === 0 ? "ENTRY" : "EXIT";
      const quantity = 1 + ((monthIndex + branchIndex) % 8) * 0.5;
      const movementAt = new Date(Date.UTC(year, month, 15, 13));
      const existingMovement = await prisma.supplyStockMovement.findFirst({
        where: {
          branchId,
          supplyId,
          userId,
          movementType,
          quantity,
          movementAt,
        },
      });
      if (!existingMovement) {
        await prisma.supplyStockMovement.create({
          data: {
            branchId,
            supplyId,
            userId,
            movementType,
            quantity,
            observation: `Movimiento histórico de insumos ${month + 1}/${year}.`,
            movementAt,
          },
        });
      }
    }
  }

  for (const item of inventory) {
    if (item.quantity >= item.minimum) {
      continue;
    }
    const branchId = getId(
      branchIds,
      `Intelligent Nutrition - ${item.branch}`,
      "Branch",
    );
    const productId = getId(productIds, item.product, "Product");
    const userKey =
      item.branch === "Medellín"
        ? "assistant-medellin"
        : item.branch === "Bogotá"
          ? "assistant-bogota"
          : "assistant-cali";
    const userId = getId(userIds, userKey, "User account");
    const title = `Inventario bajo: ${item.product}`;
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId,
        branchId,
        productId,
        type: "LOW_STOCK",
        title,
      },
    });
    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          userId,
          branchId,
          productId,
          type: "LOW_STOCK",
          title,
          message: `Quedan ${item.quantity} unidades; el mínimo configurado es ${item.minimum}.`,
        },
      });
    }
  }

  console.log("Database seed completed successfully");
}

main()
  .catch((error) => {
    console.error("Seed failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
