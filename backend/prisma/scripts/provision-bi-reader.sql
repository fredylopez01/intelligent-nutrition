DO $provision$
DECLARE
  granted_role record;
  column_privileges record;
  unauthorized_select text;
BEGIN
  IF NULLIF(current_setting('app.bi_reader_password', true), '') IS NULL
     OR length(current_setting('app.bi_reader_password')) < 32 THEN
    RAISE EXCEPTION 'BI_READER_PASSWORD is missing or too short';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bi_reader') THEN
    EXECUTE 'CREATE ROLE bi_reader';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'bi_reader'
      AND (rolsuper OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'bi_reader has elevated attributes and cannot be safely managed';
  END IF;

  EXECUTE 'ALTER ROLE bi_reader WITH NOLOGIN NOCREATEDB NOCREATEROLE '
       || 'NOINHERIT CONNECTION LIMIT 5';

  FOR granted_role IN
    SELECT granted.rolname
    FROM pg_auth_members membership
    JOIN pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'bi_reader'
  LOOP
    EXECUTE format('REVOKE %I FROM bi_reader', granted_role.rolname);
  END LOOP;

  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON DATABASE %I FROM bi_reader',
    current_database()
  );
  EXECUTE 'REVOKE ALL PRIVILEGES ON SCHEMA public FROM bi_reader';
  EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bi_reader';
  EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM bi_reader';

  FOR column_privileges IN
    SELECT ns.nspname,
           relation.relname,
           string_agg(DISTINCT quote_ident(attribute.attname), ', ') AS column_names
    FROM pg_class relation
    JOIN pg_namespace ns ON ns.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    CROSS JOIN LATERAL aclexplode(attribute.attacl) acl
    WHERE ns.nspname = 'public'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'bi_reader')
      AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
    GROUP BY ns.nspname, relation.relname
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES (%s) ON TABLE %I.%I FROM bi_reader',
      column_privileges.column_names,
      column_privileges.nspname,
      column_privileges.relname
    );
  END LOOP;

  EXECUTE 'GRANT USAGE ON SCHEMA public TO bi_reader';
  EXECUTE 'GRANT SELECT ON TABLE public.bi_sales, public.bi_sale_lines, '
       || 'public.bi_purchase_lines, public.bi_stock_status TO bi_reader';
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO bi_reader',
    current_database()
  );
  EXECUTE 'ALTER ROLE bi_reader SET statement_timeout = ''120s''';

  SELECT string_agg(format('%I.%I', ns.nspname, relation.relname), ', ')
  INTO unauthorized_select
  FROM pg_class relation
  JOIN pg_namespace ns ON ns.oid = relation.relnamespace
  WHERE ns.nspname = 'public'
    AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND (
      relation.relkind <> 'v'
      OR relation.relname NOT IN (
        'bi_sales',
        'bi_sale_lines',
        'bi_purchase_lines',
        'bi_stock_status',
        'pg_stat_statements',
        'pg_stat_statements_info'
      )
    )
    AND (
      has_table_privilege('bi_reader', relation.oid, 'SELECT')
      OR EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = relation.oid
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
          AND has_column_privilege(
            'bi_reader',
            relation.oid,
            attribute.attnum,
            'SELECT'
          )
      )
    );

  IF unauthorized_select IS NOT NULL THEN
    RAISE EXCEPTION 'bi_reader can still SELECT outside BI views: %',
      unauthorized_select;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace ns ON ns.oid = relation.relnamespace
    WHERE ns.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (
        has_table_privilege('bi_reader', relation.oid, 'INSERT')
        OR has_table_privilege('bi_reader', relation.oid, 'UPDATE')
        OR has_table_privilege('bi_reader', relation.oid, 'DELETE')
        OR has_table_privilege('bi_reader', relation.oid, 'TRUNCATE')
        OR EXISTS (
          SELECT 1
          FROM pg_attribute attribute
          WHERE attribute.attrelid = relation.oid
            AND attribute.attnum > 0
            AND NOT attribute.attisdropped
            AND (
              has_column_privilege(
                'bi_reader',
                relation.oid,
                attribute.attnum,
                'INSERT'
              )
              OR has_column_privilege(
                'bi_reader',
                relation.oid,
                attribute.attnum,
                'UPDATE'
              )
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'bi_reader still has effective write privileges on public';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class seq
    JOIN pg_namespace ns ON ns.oid = seq.relnamespace
    WHERE ns.nspname = 'public'
      AND seq.relkind = 'S'
      AND (
        has_sequence_privilege('bi_reader', seq.oid, 'USAGE')
        OR has_sequence_privilege('bi_reader', seq.oid, 'SELECT')
        OR has_sequence_privilege('bi_reader', seq.oid, 'UPDATE')
      )
  ) THEN
    RAISE EXCEPTION 'bi_reader still has effective privileges on sequences';
  END IF;

  IF has_schema_privilege('bi_reader', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'bi_reader inherits CREATE on schema public';
  END IF;

  IF has_database_privilege('bi_reader', current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'bi_reader inherits CREATE on the current database';
  END IF;

  EXECUTE format(
    'ALTER ROLE bi_reader WITH LOGIN NOCREATEDB NOCREATEROLE '
    || 'NOINHERIT CONNECTION LIMIT 5 PASSWORD %L',
    current_setting('app.bi_reader_password')
  );
END
$provision$;
