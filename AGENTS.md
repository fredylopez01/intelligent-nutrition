# AGENTS.md — Convenciones del proyecto

Contexto para agentes de IA que trabajen en este repositorio. La fuente oficial es la wiki de Azure DevOps
(`/Home/Documentos Generales/Contribuiting`); esto es el resumen operativo.

## 1. Estructura

- `backend/` — NestJS + Prisma + PostgreSQL (ESM, `type: module`, imports con `.js`)
- `frontend/` — React + Vite
- `docker-compose.yml` — `postgres`, `backend-init` (migra + seed), `backend`, `frontend`
- `backend/endpoints-bruno/` — colección Bruno (formato YAML `opencollection: 1.0.0`)

## 2. Ramas

Integración: `develop`. `main` solo recibe PR desde `develop`.

```
git checkout develop
git pull origin develop
git checkout -b <tipo>/<work-item-id>-<descripcion>
```

Tipos permitidos: `feature`, `bug`, `fix`, `refactor`, `docs`, `chore`.
Ejemplo: `feature/739-user-profile-endpoints`.

Los nombres de rama van en inglés, aunque la documentación, la UI y las conversaciones estén en español.

## 3. Commits

Formato: `<type>(<scope>): <description> AB#<id>`

- Una línea, máximo 20 palabras.
- Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `build`, `ci`.
- Scopes habituales: `auth`, `users`, `products`, `inventory`, `sales`, `purchases`, `database`, `api`, `ui`, `config`.
- El trailer de co-autor va en línea aparte, no cuenta para el límite:

```
Co-authored-by: CommandCodeBot <noreply@commandcode.ai>
```

Ejemplos reales:

```
feat(users): add own profile endpoints AB#739
test(users): add bruno requests for own profile endpoints AB#739
```

## 4. Pull Requests

- Plantilla: `.azuredevops/pull_request_template/feature-bug-to-develop.md` (a `develop`)
- Plantilla: `.azuredevops/pull_request_template/develop-to-main.md` (a `main`)
- Requisitos hacia `develop`: work item asociado, mínimo 2 revisores, autor no aprueba su propio PR,
  comentarios resueltos, validaciones automáticas en verde.
- Borradores de PR rellenados se guardan **fuera del repositorio**, en:
  `C:\Users\fabia\Documents\Universidad\UPTC\Trabajos\IX Semestre\Trabajo de Campo\PR-<id>-<slug>.md`
  (así no ensucian el working tree ni se cuelan en un commit).

## 5. Reglas de trabajo del agente

- No ejecutar `git commit` ni `git push` sin confirmación explícita del usuario.
- No crear ni modificar Pull Requests.
- Azure Boards es solo lectura: no cambiar estados, no comentar, no crear work items.
- Los cambios se dejan en el working tree; el usuario decide qué se publica.
- Este `AGENTS.md` se mantiene **local (sin versionar)**: no commitearlo. Se agregará a `.gitignore` en una rama aparte.
- Antes de una acción destructiva o irreversible, preguntar.
- Proponer un plan antes de modificar archivos en tareas de más de un archivo.

## 6. Verificación antes de un PR

```powershell
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy      # requiere la BD levantada
npm run build
npm test -- --testPathPatterns "<modulo>"   # jest corre con --experimental-vm-modules
```

Entorno local:

```powershell
docker compose up -d postgres
cd backend; npm run start:prod     # o npm run start:dev
```

Requests de API: `backend/endpoints-bruno/intelligent/` (variables `{{url-back}}` y
`{{json_web_token_15kq}}` en `opencollection.yml`). Desde CLI:
`npx @usebruno/cli run "<archivo>.yml" --env-var "json_web_token_15kq=<token>"`.

Los tests se escriben en inglés: títulos de `describe`/`it` y nombres de helpers o constantes.
Solo las aserciones sobre textos de UI en español se quedan en español.

## 7. Particularidades del modelo de datos

- No existe modelo `User`: la identidad es `Person` (datos personales) + `UserAccount` (credenciales y rol).
- No existe `fullName` en BD: se deriva de `firstName` + `lastName`.
- Las migraciones son carpetas con SQL crudo; se aplican con `prisma migrate deploy`, nunca `db push`.
- El `ValidationPipe` global usa `forbidNonWhitelisted: true`: un campo no declarado en el DTO responde 400.

### Convenciones de datos

- **Los nombres de personas se registran sin tildes** (decisión de arquitectura, bug 783). `Lopez`, no `López`.
  La búsqueda de clientes, proveedores y usuarios no normaliza diacríticos.
- **Los productos sí toleran tildes en la búsqueda**: `product.search_text` es una columna generada
  (`lower(translate(...))`) e indexable; el término se normaliza con `normalizeSearchTerm`
  (`backend/src/common/utils/search.util.ts`). Ambos lados deben producir el mismo texto.
- Categorías, sedes, unidades de medida y métodos de pago no normalizan tildes todavía (bug 783, alcance parcial).

## 8. Deuda conocida

- 3 suites de `inventory` / `inventory-movements` fallan con `Reflect.getMetadata is not a function` en el
  arranque del suite (previo, no relacionado con `users`).
- El Contract API del Sprint 6 no contempla la foto de perfil: `GET/PATCH /users/me` se documentaron sin
  `profilePhotoUrl` y sin endpoint de subida, pese al AC de la 739/679. Requiere actualización por el BA.
