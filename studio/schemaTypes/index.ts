import { defineField, defineType } from "sanity";
const category = defineType({
  name: "category",
  title: "دسته‌بندی / Category",
  type: "document",
  fields: [
    defineField({
      name: "titleFa",
      title: "نام فارسی",
      type: "string",
      validation: (r) => r.required().max(60),
    }),
    defineField({
      name: "titleEn",
      title: "English name",
      type: "string",
      validation: (r) => r.required().max(60),
    }),
    defineField({
      name: "slug",
      title: "نشانی دسته / Slug",
      type: "slug",
      options: { source: "titleEn", maxLength: 80 },
      validation: (r) => r.required(),
    }),
  ],
  preview: { select: { title: "titleFa", subtitle: "titleEn" } },
});
const codeBlock = defineType({
  name: "codeBlock",
  title: "قطعه‌کد / Code",
  type: "object",
  fields: [
    defineField({
      name: "language",
      title: "زبان کد",
      type: "string",
      options: {
        list: [
          "typescript",
          "javascript",
          "java",
          "kotlin",
          "html",
          "css",
          "sql",
          "json",
          "bash",
          "text",
        ],
      },
    }),
    defineField({
      name: "filename",
      title: "نام فایل (اختیاری)",
      type: "string",
    }),
    defineField({
      name: "code",
      title: "کد",
      type: "text",
      rows: 14,
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: "filename", subtitle: "language" },
    prepare: ({ title, subtitle }) => ({
      title: title || "Code snippet",
      subtitle,
    }),
  },
});
const post = defineType({
  name: "post",
  title: "نوشته / Post",
  type: "document",
  initialValue: () => ({
    language: "fa",
    publishedAt: new Date().toISOString(),
    tags: [],
  }),
  fields: [
    defineField({
      name: "title",
      title: "عنوان / Title",
      type: "string",
      validation: (r) => r.required().max(180),
    }),
    defineField({
      name: "language",
      title: "زبان نوشته / Language",
      type: "string",
      options: {
        list: [
          { title: "فارسی", value: "fa" },
          { title: "English", value: "en" },
        ],
        layout: "radio",
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "نشانی نوشته / Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 120,
        slugify: (input) =>
          input
            .normalize("NFC")
            .toLowerCase()
            .trim()
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 120),
      },
      description:
        "از حرف، عدد و خط تیره استفاده کنید. پس از انتشار نشانی را تغییر ندهید.",
      validation: (r) =>
        r
          .required()
          .custom(
            (value) =>
              !value?.current ||
              /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value.current) ||
              "فقط حرف، عدد و خط تیره مجاز است.",
          ),
    }),
    defineField({
      name: "excerpt",
      title: "خلاصه / Excerpt",
      type: "text",
      rows: 3,
      validation: (r) => r.required().max(320),
    }),
    defineField({
      name: "cover",
      title: "تصویر اصلی / Cover",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "توضیح تصویر برای دسترس‌پذیری",
          type: "string",
          validation: (r) => r.required(),
        }),
        defineField({
          name: "caption",
          title: "زیرنویس (اختیاری)",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "category",
      title: "دسته‌بندی / Category",
      type: "reference",
      to: [{ type: "category" }],
    }),
    defineField({
      name: "publishedAt",
      title: "تاریخ نوشته / Date",
      type: "datetime",
      description:
        "مطالب دارای تاریخ آینده تا زمان رسیدن تاریخ و بازسازی سایت نمایش داده نمی‌شوند. دکمهٔ Publish انتشار در Sanity را انجام می‌دهد؛ این فیلد جایگزین قابلیت زمان‌بندی رسمی Sanity نیست.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "body",
      title: "متن نوشته / Body",
      type: "array",
      of: [
        {
          type: "block",
          styles: [
            { title: "متن عادی", value: "normal" },
            { title: "عنوان بخش", value: "h2" },
            { title: "زیرعنوان", value: "h3" },
            { title: "نقل‌قول", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "پررنگ", value: "strong" },
              { title: "تأکید", value: "em" },
              { title: "کد", value: "code" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "پیوند",
                fields: [
                  defineField({
                    name: "href",
                    title: "نشانی",
                    type: "url",
                    validation: (r) =>
                      r.required().uri({ scheme: ["https", "http", "mailto"] }),
                  }),
                ],
              },
            ],
          },
        },
        {
          type: "image",
          fields: [
            defineField({
              name: "alt",
              title: "توضیح تصویر",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({ name: "caption", title: "زیرنویس", type: "string" }),
          ],
        },
        { type: "codeBlock" },
      ],
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: "tags",
      title: "برچسب‌ها / Tags",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      validation: (r) => r.max(8).unique(),
    }),
    defineField({
      name: "translation",
      title: "نسخهٔ ترجمه‌شده (اختیاری)",
      type: "reference",
      to: [{ type: "post" }],
      options: {
        filter: ({ document }) => ({
          filter: "_id != $id && language != $language",
          params: {
            id: String(document._id).replace(/^drafts\./, ""),
            language: document.language || "fa",
          },
        }),
      },
    }),
    defineField({
      name: "seoTitle",
      title: "عنوان سئو (اختیاری)",
      type: "string",
      validation: (r) => r.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "توضیح سئو (اختیاری)",
      type: "text",
      rows: 2,
      validation: (r) => r.max(170),
    }),
  ],
  preview: { select: { title: "title", subtitle: "language", media: "cover" } },
  orderings: [
    {
      title: "تازه‌ترین",
      name: "newest",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
});
export const schemaTypes = [category, codeBlock, post];
