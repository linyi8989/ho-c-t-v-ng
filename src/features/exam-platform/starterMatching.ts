import type {
  ExamInteractionRegion,
  ExamMatchingConnection,
  ExamPartContent,
  StarterImageMatchingLayout,
  StarterImageMatchingLayoutV2,
  StarterImageMatchingNode,
} from './types';

export const STARTER_MATCHING_HITBOX_WIDTH = 0.08;
export const STARTER_MATCHING_HITBOX_HEIGHT = 0.06;
export const STARTER_MATCHING_MAX_CONNECTIONS = 5;

const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value));

export function starterMatchingResponseKey(partId: string) {
  return `starter-matching:${partId}`;
}

export function starterMatchingAnchor(region: ExamInteractionRegion) {
  return {
    x: clamp(region.x + region.width / 2),
    y: clamp(region.y + region.height / 2),
  };
}

export function starterMatchingHitRegionAround(anchor: { x: number; y: number }): ExamInteractionRegion {
  return {
    shape: 'rect',
    x: clamp(anchor.x - STARTER_MATCHING_HITBOX_WIDTH / 2, 1 - STARTER_MATCHING_HITBOX_WIDTH),
    y: clamp(anchor.y - STARTER_MATCHING_HITBOX_HEIGHT / 2, 1 - STARTER_MATCHING_HITBOX_HEIGHT),
    width: STARTER_MATCHING_HITBOX_WIDTH,
    height: STARTER_MATCHING_HITBOX_HEIGHT,
  };
}

function legacyNode(item: Extract<StarterImageMatchingLayout, { kind: 'starter-image-matching-v1' }>['leftItems'][number]): StarterImageMatchingNode {
  const anchor = starterMatchingAnchor(item.region);
  return {
    id: item.id,
    label: item.label,
    hitRegion: starterMatchingHitRegionAround(anchor),
    anchor,
    geometryConfirmedByTeacher: item.geometryConfirmedByTeacher,
  };
}

export function starterMatchingModel(layout: StarterImageMatchingLayout): StarterImageMatchingLayoutV2 {
  if (layout.kind === 'starter-image-matching-v2') return layout;
  return {
    kind: 'starter-image-matching-v2',
    sourceNodes: layout.leftItems.map(legacyNode),
    targetNodes: layout.rightItems.map(legacyNode),
    ...(layout.exampleMapping ? {
      exampleConnection: {
        sourceNodeId: layout.exampleMapping.leftItemId,
        targetNodeId: layout.exampleMapping.rightItemId,
      },
    } : {}),
    maxConnections: STARTER_MATCHING_MAX_CONNECTIONS,
  };
}

export function starterMatchingSourceNodeId(part: ExamPartContent, questionId: string) {
  const question = part.questions.find(item => item.id === questionId);
  if (question?.interactionSourceNodeId) return question.interactionSourceNodeId;
  const layout = part.interactionLayout;
  if (layout?.kind !== 'starter-image-matching-v1') return undefined;
  return layout.leftItems.find(item => item.questionId === questionId)?.id;
}

export function isExamMatchingConnection(value: unknown): value is ExamMatchingConnection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.sourceNodeId === 'string' && typeof row.targetNodeId === 'string';
}

export function readExamMatchingConnections(value: unknown) {
  return Array.isArray(value) ? value.filter(isExamMatchingConnection) : [];
}
