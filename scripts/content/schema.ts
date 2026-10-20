/** 课程源文件（作者编写的 YAML/frontmatter）的 schema。 */
import { z } from 'zod';
import { OVERRIDABLE_OPTIONS, RUN_MODES } from '../../src/compiler/config.ts';
import { ALL_RULES } from '../../src/compiler/core/types.ts';

export const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id 只能包含小写字母、数字与连字符');

export const curriculumSchema = z.object({
  version: z.number().int(),
  stages: z.array(
    z.object({
      id: z.string().regex(/^[A-Z]$/),
      title: z.string().min(1),
      summary: z.string().min(1),
      lessons: z.array(
        z.object({
          id: idSchema,
          title: z.string().min(1),
          status: z.enum(['planned', 'draft', 'published']),
          prerequisites: z.array(idSchema),
          representative: z.boolean().optional(),
        }),
      ),
    }),
  ),
});
export type CurriculumSource = z.infer<typeof curriculumSchema>;

const overridesSchema = z
  .record(z.string(), z.boolean())
  .refine((o) => Object.keys(o).every((k) => (OVERRIDABLE_OPTIONS as readonly string[]).includes(k)), {
    message: `只能覆盖这些选项：${OVERRIDABLE_OPTIONS.join(', ')}`,
  });

export const compilerSchema = z
  .object({ overrides: overridesSchema.optional(), note: z.string().min(1).optional() })
  .refine((c) => !c.overrides || Object.keys(c.overrides).length === 0 || c.note, {
    message: '覆盖编译选项时必须用 note 说明原因（会显示给学习者）',
  });

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const lessonFrontmatterSchema = z.object({
  version: z.number().int().min(1),
  mode: z.enum(RUN_MODES as [string, ...string[]]),
  objectives: z.array(z.string().min(1)).min(1),
  problem: z.string().min(1),
  estimatedMinutes: z.number().int().min(5).max(180),
  review: z.enum(['ai-draft', 'self-reviewed', 'reviewed']),
  compiler: compilerSchema.optional(),
  representative: z.boolean().optional(),
  references: z
    .array(z.object({ title: z.string().min(1), url: z.url(), checked: dateSchema, note: z.string().optional() }))
    .min(1),
});

export const exerciseFrontmatterSchema = z.object({
  kind: z.enum(['task', 'challenge']),
  title: z.string().min(1),
  mode: z.enum(RUN_MODES as [string, ...string[]]).optional(),
  entry: z.string().optional(),
  tests: z.boolean().optional(),
  forbid: z.array(z.enum(ALL_RULES as [string, ...string[]])).optional(),
  allow: z.array(z.enum(ALL_RULES as [string, ...string[]])).optional(),
  timeoutMs: z.number().int().min(500).max(60_000).optional(),
  perTestTimeoutMs: z.number().int().min(100).max(30_000).optional(),
  fixtures: z.string().optional(),
  expect: z.string().optional(),
  compiler: compilerSchema.optional(),
  /** 当“至少两个错误解”确实不适用时说明原因 */
  wrongNotApplicable: z.string().optional(),
});

export const quizSchema = z
  .array(
    z.object({
      id: idSchema,
      type: z.enum(['single', 'multiple']),
      prompt: z.string().min(1),
      options: z
        .array(z.object({ text: z.string().min(1), correct: z.boolean().default(false), explain: z.string().min(1) }))
        .min(2)
        .max(6),
      explain: z.string().optional(),
    }),
  )
  .min(1)
  .max(6);

export const fixturesSchema = z.array(
  z.object({
    method: z.string().optional(),
    url: z.string(),
    status: z.number().int().optional(),
    statusText: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
    delayMs: z.number().int().optional(),
    bodyDelayMs: z.number().int().optional(),
    networkError: z.boolean().optional(),
  }),
);
