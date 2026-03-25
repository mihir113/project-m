CREATE TABLE "useful_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "useful_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "useful_links_select_authenticated"
ON "useful_links"
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "useful_links_insert_authenticated"
ON "useful_links"
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "useful_links_update_authenticated"
ON "useful_links"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "useful_links_delete_authenticated"
ON "useful_links"
FOR DELETE
TO authenticated
USING (true);
