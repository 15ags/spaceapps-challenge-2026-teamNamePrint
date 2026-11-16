import { deleteAstronaut } from "@/lib/store"

/** DELETE /api/v1/crew/{id} — remove a live-mode profile and its uploads. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const result = await deleteAstronaut(id)
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json({ status: "deleted", id: result.id })
}
