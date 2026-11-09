ALTER TABLE "product" ADD COLUMN "search_text" text GENERATED ALWAYS AS (
  lower(
    translate(
      coalesce("name", '') || ' ' || coalesce("reference_code", ''),
      'áéíóúüñÁÉÍÓÚÜÑ',
      'aeiouunAEIOUUN'
    )
  )
) STORED;
