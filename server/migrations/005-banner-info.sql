ALTER TABLE banners ADD COLUMN IF NOT EXISTS "infoImage" TEXT NOT NULL DEFAULT '';

UPDATE site_settings
SET value = (value::jsonb || jsonb_build_object(
  'title', 'Всё для переезда, упаковки и ремонта',
  'titleKk', 'Көшуге, қаптауға және жөндеуге қажеттінің бәрі',
  'description', 'Упаковочные материалы для любых задач',
  'descriptionKk', 'Кез келген міндетке арналған қаптама материалдары',
  'buttonText', 'Выбрать задачу',
  'buttonTextKk', 'Міндетті таңдау',
  'actionType', 'link', 'actionTarget', '#tasks-wizard-section'
))::text,
version = nextval('content_version_seq'), updated_at = clock_timestamp(), updated_by = NULL
WHERE key = 'hero'
  AND value::jsonb->>'title' = 'Всё для переезда и упаковки в одном месте';
