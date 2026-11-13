-- Read-only analytics views for the Looker Studio dashboard (HS-133).
--
-- Rules shared by every view:
--   * Business day = UTC-5 (America/Bogota), the same rule as GET /reports/sales.
--   * Only COMPLETED sales are exposed; REVERSED sales never appear.
--   * Ids and enums are cast to text because the Looker Studio connector
--     ignores uuid columns.
--   * Column names are ASCII snake_case.
--   * No personal data: no emails, phones, documents or customer/user names.
--
-- The views live in the public schema because the connector only lists
-- tables from that schema. They are read through the bi_reader role, which is
-- created manually (see the Wiki) so that its password is never versioned.
--
-- NOTE: PostgreSQL does not allow altering or dropping a column used by a
-- view. A future migration that touches one of these columns must DROP VIEW
-- and CREATE VIEW again in the same migration.

-- One row per completed sale.
CREATE VIEW "bi_sales" AS
SELECT
  s.id::text                                               AS sale_id,
  s.sale_number,
  (s.sale_at - INTERVAL '5 hours')::date                   AS sale_date,
  EXTRACT(HOUR FROM s.sale_at - INTERVAL '5 hours')::int   AS sale_hour,
  EXTRACT(ISODOW FROM s.sale_at - INTERVAL '5 hours')::int AS iso_weekday,
  b.id::text                                               AS branch_id,
  b.name                                                   AS branch_name,
  (s.customer_id IS NOT NULL)                              AS has_customer,
  pr.name                                                  AS promotion_name,
  s.subtotal,
  s.discount_amount,
  COALESCE(s.promotion_discount, 0)                        AS promotion_discount,
  s.tax_amount,
  s.total
FROM sale s
INNER JOIN branch b ON b.id = s.branch_id
LEFT JOIN promotion pr ON pr.id = s.promotion_id
WHERE s.status = 'COMPLETED';

-- One row per line of a completed sale.
CREATE VIEW "bi_sale_lines" AS
SELECT
  sd.id::text                                              AS sale_detail_id,
  s.id::text                                               AS sale_id,
  (s.sale_at - INTERVAL '5 hours')::date                   AS sale_date,
  b.id::text                                               AS branch_id,
  b.name                                                   AS branch_name,
  p.id::text                                               AS product_id,
  p.name                                                   AS product_name,
  p.reference_code,
  c.name                                                   AS category_name,
  (sd.recipe_id IS NOT NULL)                               AS is_recipe,
  sd.quantity,
  sd.unit_price,
  sd.subtotal                                              AS line_subtotal,
  -- Sale total allocated to each line by subtotal share, so that
  -- SUM(net_amount) per sale equals sale.total (reconciles with HS-120).
  COALESCE(
    s.total * sd.subtotal / NULLIF(SUM(sd.subtotal) OVER (PARTITION BY s.id), 0),
    0
  )                                                        AS net_amount
FROM sale_detail sd
INNER JOIN sale s ON s.id = sd.sale_id
INNER JOIN branch b ON b.id = s.branch_id
INNER JOIN product p ON p.id = sd.product_id
INNER JOIN category c ON c.id = p.category_id
WHERE s.status = 'COMPLETED';

-- One row per purchase line. branch_id and branch_name are the branch that
-- received the line (HS-126); they are NULL until the line is received.
CREATE VIEW "bi_purchase_lines" AS
SELECT
  pd.id::text                                              AS purchase_detail_id,
  pu.id::text                                              AS purchase_id,
  pu.purchase_number,
  (pu.purchase_at - INTERVAL '5 hours')::date              AS purchase_date,
  pu.status::text                                          AS purchase_status,
  COALESCE(
    su.commercial_name,
    pe.business_name,
    NULLIF(TRIM(CONCAT_WS(' ', pe.first_name, pe.last_name)), '')
  )                                                        AS supplier_name,
  pb.id::text                                              AS branch_id,
  pb.name                                                  AS branch_name,
  p.id::text                                               AS product_id,
  p.name                                                   AS product_name,
  c.name                                                   AS category_name,
  pd.requested_quantity,
  pd.received_quantity,
  pd.unit_price,
  pd.subtotal
FROM purchase_detail pd
INNER JOIN purchase pu ON pu.id = pd.purchase_id
INNER JOIN supplier su ON su.person_id = pu.supplier_id
INNER JOIN person pe ON pe.id = su.person_id
INNER JOIN product p ON p.id = pd.product_id
INNER JOIN category c ON c.id = p.category_id
LEFT JOIN branch pb ON pb.id = pd.branch_id;

-- One row per active product and branch. Same grouping and below-minimum rule
-- as GET /reports/restock, but without filtering, so that the dashboard can
-- also show the products that are above their minimum.
CREATE VIEW "bi_stock_status" AS
SELECT
  b.id::text                                               AS branch_id,
  b.name                                                   AS branch_name,
  p.id::text                                               AS product_id,
  p.name                                                   AS product_name,
  p.reference_code,
  c.name                                                   AS category_name,
  SUM(bi.quantity)::int                                    AS current_quantity,
  MAX(bi.minimum_stock)::int                               AS minimum_stock,
  (SUM(bi.quantity) < MAX(bi.minimum_stock))               AS below_minimum
FROM branch_inventory bi
INNER JOIN branch b ON b.id = bi.branch_id
INNER JOIN product p ON p.id = bi.product_id
INNER JOIN category c ON c.id = p.category_id
WHERE p.active = true
GROUP BY b.id, b.name, p.id, p.name, p.reference_code, c.name;
