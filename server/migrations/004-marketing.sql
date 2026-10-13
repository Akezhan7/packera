ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS "mobileImage" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "titleKk" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "descriptionKk" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "actionType" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "actionTarget" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "startsAt" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "endsAt" TEXT NOT NULL DEFAULT '';

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS "desktopImage" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "mobileImage" TEXT NOT NULL DEFAULT '';

INSERT INTO site_settings (key,value)
VALUES ('hero', json_build_object(
  'image','/Artboard 1.png', 'mobileImage','',
  'title','Всё для переезда и упаковки в одном месте',
  'titleKk','Көшуге және қаптауға қажеттінің бәрі бір жерде',
  'description','Упаковочные материалы для дома и бизнеса.',
  'descriptionKk','Үйге және бизнеске арналған қаптама материалдары.',
  'buttonText','Выбрать упаковку', 'buttonTextKk','Қаптаманы таңдау',
  'actionType','link', 'actionTarget','#tasks-wizard-section'
)::text)
ON CONFLICT (key) DO NOTHING;
