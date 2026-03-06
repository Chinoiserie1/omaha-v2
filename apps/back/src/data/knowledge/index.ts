import { getAssetGroupRules } from "./asset-groups.js";
import { getProtocolContextRules } from "./protocol-map.js";

export function buildGlobalKnowledgeContext(): string {
  const assetGroups = getAssetGroupRules();
  const protocolContext = getProtocolContextRules();

  return `ASSET EQUIVALENCE GROUPS (critical — prevents double-counting):
${assetGroups}

PROTOCOL/PROJECT CONTEXT (maps non-token mentions to investable assets):
${protocolContext}`;
}
