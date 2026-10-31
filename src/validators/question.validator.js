import { z } from 'zod';

const optionSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  isCorrect: z.boolean(),
});

export const createQuestionSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  options: z
    .array(optionSchema)
    .min(2, 'At least 2 options required')
    .max(6, 'At most 6 options allowed')
    .refine(
      (opts) => opts.some((o) => o.isCorrect),
      { message: 'At least one option must be marked as correct' }
    ),
  marks: z.coerce.number().int().min(1).max(100).optional().default(1),
  explanation: z.string().trim().max(2000).optional().default(''),
  order: z.coerce.number().int().min(0).optional().default(0),
});

export const updateQuestionSchema = z.object({
  text: z.string().trim().min(1).max(5000).optional(),
  options: z
    .array(optionSchema)
    .min(2)
    .max(6)
    .refine((opts) => opts.some((o) => o.isCorrect), { message: 'At least one option must be correct' })
    .optional(),
  marks: z.coerce.number().int().min(1).max(100).optional(),
  explanation: z.string().trim().max(2000).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const submitAnswersSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1, 'Question ID is required'),
      selectedOptionId: z.string().nullable().optional().default(null),
    })
  ).min(1, 'At least one answer must be submitted'),
});
