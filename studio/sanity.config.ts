import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";
export default defineConfig({
  name: "default",
  title: "نوشته‌های مهدی اسلامی",
  projectId: "kaaepoyb",
  dataset: "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
