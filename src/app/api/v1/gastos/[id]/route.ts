import { withUserParams } from "@/lib/api";
import { prisma } from "@/lib/db";

export const DELETE = withUserParams<{ id: string }, unknown>(async ({ params }) => {
  await prisma.expense.delete({ where: { id: params.id } });
  return { borrado: true };
});

export { OPTIONS } from "@/lib/api";
