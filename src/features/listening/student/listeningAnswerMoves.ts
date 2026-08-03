export type SingleUseAnswers = Record<string, string>;

export function placeSingleUseAnswer(
  current: SingleUseAnswers,
  targetId: string,
  answerId: string,
) {
  const next: SingleUseAnswers = {};
  Object.entries(current).forEach(([existingTargetId, existingAnswerId]) => {
    if (existingTargetId !== targetId && existingAnswerId !== answerId) {
      next[existingTargetId] = existingAnswerId;
    }
  });
  next[targetId] = answerId;
  return next;
}

export function removeSingleUseAnswer(current: SingleUseAnswers, targetId: string) {
  const next = { ...current };
  delete next[targetId];
  return next;
}

export function getUnusedAnswerIds(allAnswerIds: string[], current: SingleUseAnswers) {
  const used = new Set(Object.values(current));
  return allAnswerIds.filter(answerId => !used.has(answerId));
}
