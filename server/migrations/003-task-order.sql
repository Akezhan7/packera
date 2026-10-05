ALTER TABLE products ADD COLUMN "taskSortOrders" JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE products p SET "taskSortOrders" = COALESCE((
  SELECT jsonb_object_agg(task_id, COALESCE(p."sortOrder",0))
  FROM jsonb_object_keys(COALESCE(NULLIF(p.tasks,''),'{}')::jsonb) AS task_id
), '{}'::jsonb);
