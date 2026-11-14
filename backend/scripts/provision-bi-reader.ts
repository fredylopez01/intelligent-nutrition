import "dotenv/config";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL;
const readerPassword = process.env.BI_READER_PASSWORD;

if (!databaseUrl || !readerPassword) {
  throw new Error(
    "Define DATABASE_URL y BI_READER_PASSWORD en backend/.env antes de continuar.",
  );
}

if (readerPassword.length < 32) {
  throw new Error("BI_READER_PASSWORD debe tener al menos 32 caracteres.");
}

let url: URL;
try {
  url = new URL(databaseUrl);
} catch {
  throw new Error("DATABASE_URL no es una URL válida.");
}
if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
  throw new Error("DATABASE_URL debe ser una URL PostgreSQL.");
}

const database = decodeURIComponent(url.pathname.slice(1));
const host = url.hostname;
const port = url.port || "5432";

if (!database || !host) {
  throw new Error("DATABASE_URL no contiene la base de datos o el host.");
}

console.log(`Destino: ${host}:${port}/${database}`);
console.log(
  "Confirma primero que esta URL corresponde a STAGING, no a producción.",
);

const readline = createInterface({ input: stdin, output: stdout });
const confirmation = await readline.question(
  `Escribe "STAGING ${database}" para continuar: `,
);
readline.close();

if (confirmation !== `STAGING ${database}`) {
  console.log("Aprovisionamiento cancelado; no se modificó la base de datos.");
  process.exitCode = 1;
} else {
  const sqlFile = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../prisma/scripts/provision-bi-reader.sql",
  );
  const provisioningSql = await readFile(sqlFile, "utf8");
  const adminClient = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    await adminClient.$connect();

    const [connectionInfo] = await adminClient.$queryRaw<
      Array<{
        name: string;
        can_create_roles: boolean;
        bi_views_exist: boolean;
      }>
    >`
      SELECT current_database() AS name,
             EXISTS (
               SELECT 1
               FROM pg_roles
               WHERE rolname = current_user
                 AND (rolsuper OR rolcreaterole)
             ) AS can_create_roles,
             (
               SELECT count(*) = 4
               FROM pg_class relation
               JOIN pg_namespace ns ON ns.oid = relation.relnamespace
               WHERE ns.nspname = 'public'
                 AND relation.relkind = 'v'
                 AND relation.relname IN (
                   'bi_sales',
                   'bi_sale_lines',
                   'bi_purchase_lines',
                   'bi_stock_status'
                 )
             ) AS bi_views_exist
    `;
    if (connectionInfo.name !== database) {
      throw new Error(
        "La base conectada no coincide con la base indicada en DATABASE_URL.",
      );
    }
    if (!connectionInfo.can_create_roles) {
      throw new Error(
        "El usuario de DATABASE_URL no tiene permiso para crear roles PostgreSQL.",
      );
    }
    if (!connectionInfo.bi_views_exist) {
      throw new Error(
        "No se encontraron las cuatro vistas BI esperadas en public; revisa las migraciones.",
      );
    }

    await adminClient.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT set_config('app.bi_reader_password', ${readerPassword}, true)
      `;
      await transaction.$executeRawUnsafe(provisioningSql);
    });

    const [role] = await adminClient.$queryRaw<
      Array<{
        rolcanlogin: boolean;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
        rolinherit: boolean;
        rolconnlimit: number;
        rolconfig: string[] | null;
      }>
    >`
      SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
             rolbypassrls, rolinherit, rolconnlimit, rolconfig
      FROM pg_roles
      WHERE rolname = 'bi_reader'
    `;

    if (
      !role ||
      !role.rolcanlogin ||
      role.rolsuper ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolreplication ||
      role.rolbypassrls ||
      role.rolinherit ||
      role.rolconnlimit !== 5 ||
      !role.rolconfig?.includes("statement_timeout=120s")
    ) {
      throw new Error(
        "La configuración final de bi_reader no pasó la validación.",
      );
    }
  } finally {
    await adminClient.$disconnect();
  }

  const readerUrl = new URL(databaseUrl);
  readerUrl.username = "bi_reader";
  readerUrl.password = readerPassword;
  const readerClient = new PrismaClient({
    adapter: new PrismaPg({ connectionString: readerUrl.toString() }),
  });

  try {
    await readerClient.$connect();
    const [identity] = await readerClient.$queryRaw<
      Array<{ role: string; statement_timeout: string }>
    >`
      SELECT current_user AS role,
             current_setting('statement_timeout') AS statement_timeout
    `;

    if (identity.role !== "bi_reader") {
      throw new Error("La conexión de verificación no usa el rol bi_reader.");
    }

    await readerClient.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      for (const view of [
        "public.bi_sales",
        "public.bi_sale_lines",
        "public.bi_purchase_lines",
        "public.bi_stock_status",
      ]) {
        await transaction.$queryRawUnsafe(`SELECT 1 FROM ${view} LIMIT 0`);
      }
    });

    console.log(
      `bi_reader quedó aprovisionado; statement_timeout=${identity.statement_timeout} y las cuatro vistas son accesibles.`,
    );
  } finally {
    await readerClient.$disconnect();
  }
}
