import { z } from "zod/v4";

export const financialSummaryQuerySchema = z
  .strictObject({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine(
    ({ from, to }) =>
      (from === undefined && to === undefined) ||
      (from !== undefined && to !== undefined),
    {
      message: "The start and end dates must be provided together.",
      path: ["to"],
    },
  )
  .refine(
    ({ from, to }) => from === undefined || to === undefined || from <= to,
    {
      message: "The end date must be on or after the start date.",
      path: ["to"],
    },
  );

export type FinancialSummaryQuery = z.infer<
  typeof financialSummaryQuerySchema
>;
