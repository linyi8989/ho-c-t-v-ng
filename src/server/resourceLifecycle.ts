export function isArchivedRecord(record: Record<string, unknown> | null | undefined) {
  if (!record) return false;
  return record.lifecycleStatus === "archived"
    || record.status === "archived"
    || Boolean(record.archivedAt);
}

export function archiveResourceRecord(
  record: Record<string, unknown>,
  actorId: string,
  now = new Date().toISOString(),
  options: { forceDraftVisibility?: boolean; revokeShareToken?: boolean } = {}
) {
  const archived: Record<string, unknown> = {
    ...record,
    status: "archived",
    lifecycleStatus: "archived",
    archivedAt: record.archivedAt || now,
    archivedBy: record.archivedBy || actorId,
    updatedAt: now,
  };
  if (options.forceDraftVisibility || Object.hasOwn(record, "visibility")) {
    archived.visibility = "draft";
  }
  if (options.revokeShareToken) {
    delete archived.shareToken;
    delete archived.assignmentSlug;
  }
  return archived;
}
