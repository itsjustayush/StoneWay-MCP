import { z } from "zod";

// ==========================================
// 1. Source Authority Hierarchy
// ==========================================
export const SourceTypeSchema = z.enum([
  "user",                // 1.0: Explicit user instructions or StoneWay.md
  "manual_profile_edit", // 0.9: Web dashboard direct edit
  "verified_connector",  // 0.8: OAuth/PAT verified sync (GitHub, Notion)
  "agent_claim",         // 0.6: Autonomous agent proposed claim
  "inferred_data",       // 0.4: Heuristic or pattern extraction
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SOURCE_AUTHORITY: Record<SourceType, number> = {
  user: 1.0,
  manual_profile_edit: 0.9,
  verified_connector: 0.8,
  agent_claim: 0.6,
  inferred_data: 0.4,
};

// ==========================================
// 2. Claim & Observation Schema
// ==========================================
export const ObservationSchema = z.object({
  source: z.string(),
  source_type: SourceTypeSchema,
  source_agent: z.string().optional(),
  source_document: z.string().optional(),
  value: z.any(),
  observed_at: z.string().datetime().or(z.string()).default(() => new Date().toISOString()),
  confidence: z.number().min(0).max(1).default(1.0),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ProfileClaimSchema = z.object({
  id: z.string().default(() => `claim_${Math.random().toString(36).substring(2, 9)}`),
  field: z.string().min(1),
  value: z.any(),
  source: z.string(),
  source_type: SourceTypeSchema,
  source_agent: z.string().optional(),
  source_document: z.string().optional(),
  observed_at: z.string().datetime().or(z.string()).default(() => new Date().toISOString()),
  confidence: z.number().min(0).max(1).default(1.0),
  user_override: z.boolean().default(false),
});
export type ProfileClaim = z.infer<typeof ProfileClaimSchema>;

export const FieldProvenanceSchema = z.object({
  field: z.string(),
  canonical_value: z.any(),
  canonical_source: z.string(),
  canonical_source_type: SourceTypeSchema,
  source_agent: z.string().optional(),
  source_document: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  confidence: z.number(),
  user_override: z.boolean().default(false),
  observations: z.array(ObservationSchema).default([]),
});
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;

// Prompt injection sanitization for claims
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /developer\s+mode/i,
  /override\s+system/i,
  /reveal\s+(api\s+)?key/i,
  /bypass\s+rules/i,
];

export function sanitizeClaimValue(value: any): any {
  if (typeof value === "string") {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        // Disarm injection pattern
        return value.replace(pattern, "[FILTERED_INSTRUCTION]");
      }
    }
  } else if (Array.isArray(value)) {
    return value.map(sanitizeClaimValue);
  } else if (typeof value === "object" && value !== null) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      clean[k] = sanitizeClaimValue(v);
    }
    return clean;
  }
  return value;
}

// ==========================================
// 3. Provenance & Conflict Engine
// ==========================================
export class ProvenanceEngine {
  /**
   * Evaluates an incoming claim against current field provenance.
   * Authority Order:
   * USER (1.0) > MANUAL_PROFILE_EDIT (0.9) > VERIFIED_CONNECTOR (0.8) > AGENT_CLAIM (0.6) > INFERRED_DATA (0.4)
   *
   * User override is absolute: once set by user, external connectors or agent claims cannot overwrite.
   * Lower-authority claims are preserved as observations for transparency.
   */
  static reconcileClaim(
    existing: FieldProvenance | undefined,
    incoming: ProfileClaim
  ): {
    updated: FieldProvenance;
    acceptedAsCanonical: boolean;
    reason: string;
  } {
    const sanitizedValue = sanitizeClaimValue(incoming.value);
    const incomingAuthority = SOURCE_AUTHORITY[incoming.source_type] ?? 0.5;
    const now = incoming.observed_at || new Date().toISOString();

    const incomingObservation: Observation = {
      source: incoming.source,
      source_type: incoming.source_type,
      source_agent: incoming.source_agent,
      source_document: incoming.source_document,
      value: sanitizedValue,
      observed_at: now,
      confidence: incoming.confidence,
    };

    if (!existing) {
      // First observation for this field
      const isUser = incoming.source_type === "user" || incoming.source_type === "manual_profile_edit";
      return {
        updated: {
          field: incoming.field,
          canonical_value: sanitizedValue,
          canonical_source: incoming.source,
          canonical_source_type: incoming.source_type,
          source_agent: incoming.source_agent,
          source_document: incoming.source_document,
          created_at: now,
          updated_at: now,
          confidence: incoming.confidence,
          user_override: incoming.user_override || isUser,
          observations: [incomingObservation],
        },
        acceptedAsCanonical: true,
        reason: "Initial canonical claim established.",
      };
    }

    const currentAuthority = SOURCE_AUTHORITY[existing.canonical_source_type] ?? 0.5;
    const existingObservations = existing.observations || [];
    const updatedObservations = [...existingObservations, incomingObservation];

    // Check 1: User override invariant
    if (existing.user_override && incoming.source_type !== "user" && incoming.source_type !== "manual_profile_edit") {
      return {
        updated: {
          ...existing,
          observations: updatedObservations,
        },
        acceptedAsCanonical: false,
        reason: `Rejected: User override is active on '${existing.field}'. Preserved as observation from '${incoming.source}'.`,
      };
    }

    // Check 2: Authority comparison
    if (incomingAuthority > currentAuthority) {
      // Incoming has strictly higher authority -> becomes canonical
      const isUser = incoming.source_type === "user" || incoming.source_type === "manual_profile_edit";
      return {
        updated: {
          field: existing.field,
          canonical_value: sanitizedValue,
          canonical_source: incoming.source,
          canonical_source_type: incoming.source_type,
          source_agent: incoming.source_agent,
          source_document: incoming.source_document,
          created_at: existing.created_at,
          updated_at: now,
          confidence: incoming.confidence,
          user_override: incoming.user_override || isUser,
          observations: updatedObservations,
        },
        acceptedAsCanonical: true,
        reason: `Promoted: Source '${incoming.source}' (${incoming.source_type}) has higher authority than '${existing.canonical_source}' (${existing.canonical_source_type}).`,
      };
    }

    if (incomingAuthority === currentAuthority) {
      // Same authority: Check confidence or recency
      if (incoming.confidence >= existing.confidence) {
        return {
          updated: {
            field: existing.field,
            canonical_value: sanitizedValue,
            canonical_source: incoming.source,
            canonical_source_type: incoming.source_type,
            source_agent: incoming.source_agent,
            source_document: incoming.source_document,
            created_at: existing.created_at,
            updated_at: now,
            confidence: incoming.confidence,
            user_override: existing.user_override || incoming.user_override,
            observations: updatedObservations,
          },
          acceptedAsCanonical: true,
          reason: `Updated: Newer observation with equal authority (${incoming.source_type}).`,
        };
      }
    }

    // Lower authority: Keep as observation only
    return {
      updated: {
        ...existing,
        observations: updatedObservations,
      },
      acceptedAsCanonical: false,
      reason: `Preserved as observation: Source '${incoming.source}' authority (${incomingAuthority}) is lower than canonical authority (${currentAuthority}).`,
    };
  }
}
