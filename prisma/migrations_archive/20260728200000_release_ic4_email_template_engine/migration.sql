-- Release IC.4: Email Template Engine. Purely additive: one new nullable
-- column on the existing notifications table, and one new table. No
-- existing data is touched.

ALTER TABLE "notifications" ADD COLUMN "bodyHtml" TEXT;

CREATE TABLE "email_templates" (
    "id"              TEXT NOT NULL,
    "code"            TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "subjectTemplate" TEXT NOT NULL,
    "htmlTemplate"    TEXT,
    "textTemplate"    TEXT NOT NULL,
    "variables"       JSONB,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "version"         INTEGER NOT NULL DEFAULT 1,
    "createdById"     TEXT NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_templates_code_key" ON "email_templates"("code");

ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
