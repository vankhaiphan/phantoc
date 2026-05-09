-- =============================================================================
-- PHAN TỘC — Seed
-- The founding chi for the Phan family of Cẩm Nê.
-- Members and relationships are added by the family via the application;
-- this file inserts only the structural root.
-- =============================================================================

INSERT INTO public.branches (name, description, display_order, parent_branch_id)
VALUES (
  'Chi tộc Phan - làng Cẩm Nê',
  'Chi tộc Phan tại làng Cẩm Nê, xã Hòa Tiến, huyện Hòa Vang, thành phố Đà Nẵng, Việt Nam.',
  0,
  NULL
)
ON CONFLICT DO NOTHING;
