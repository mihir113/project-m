CREATE INDEX "dashboard_weekly_week_generated_idx" ON "dashboard_weekly_rundowns" USING btree ("week_start","generated_at");--> statement-breakpoint
CREATE INDEX "manager_observations_member_created_idx" ON "manager_observations" USING btree ("member_id","created_at");--> statement-breakpoint
CREATE INDEX "project_ai_summaries_project_generated_idx" ON "project_ai_summaries" USING btree ("project_id","generated_at");--> statement-breakpoint
CREATE INDEX "requirements_project_id_idx" ON "requirements" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "requirements_status_idx" ON "requirements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requirements_due_date_idx" ON "requirements" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "requirements_owner_id_idx" ON "requirements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "requirements_project_status_due_date_idx" ON "requirements" USING btree ("project_id","status","due_date");--> statement-breakpoint
CREATE INDEX "submissions_requirement_id_idx" ON "submissions" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "submissions_team_member_id_idx" ON "submissions" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "submissions_cycle_label_idx" ON "submissions" USING btree ("cycle_label");--> statement-breakpoint
CREATE INDEX "useful_links_created_at_idx" ON "useful_links" USING btree ("created_at");