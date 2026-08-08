/**
 * Drizzle schema for the Attribute Origination Portal.
 *
 * SQL-first: the migrations in /drizzle are the source of truth for
 * constraints, triggers and grants (hash chain, append-only revoke, the
 * one-attribute-per-period firewall). This file mirrors them so application
 * queries are typed.
 *
 * Architecture guardrails encoded at this layer (§3):
 *  - reading_raw is append-only: the app role has no UPDATE/DELETE grant.
 *  - attribute has UNIQUE (site_id, period_id) — the double-counting firewall.
 *  - Mutable business entities are bitemporal (valid_from / valid_to).
 */
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("user_role", [
  "admin",
  "ops",
  "mrv_analyst",
  "carbon_manager",
  "commercial",
  "field_tech",
  "owner",
  "vendor",
  "auditor",
]);

// R1 §4.1: the source hierarchy inverted — ENA billing is the record of
// account. Ranking lives in site.source_rank, not enum order.
export const readingSourceEnum = pgEnum("reading_source", [
  "MANUAL",
  "METER",
  "INVERTER_API",
  "ENA_BILLING",
  "OWNER_STATEMENT",
]);

// R1 §4.2: every reading declares WHAT it measures.
export const measuredQuantityEnum = pgEnum("measured_quantity", [
  "GENERATION",
  "EXPORT",
  "IMPORT",
  "CONSUMPTION",
]);

export const siteStatusEnum = pgEnum("site_status", [
  "LEAD",
  "QUALIFYING",
  "CONTRACTED",
  "METERED",
  "COMMISSIONED",
  "ASSESSED",
  "PRODUCING",
  "SUSPENDED",
  "TERMINATED",
]);

export const attrTrackEnum = pgEnum("attr_track", [
  "UNASSIGNED",
  "IREC",
  "CARBON",
]);

export const attrStatusEnum = pgEnum("attr_status", [
  "MEASURED",
  "RECONCILED",
  "DISPUTED",
  "ELIGIBLE",
  "ALLOCATED",
  "ISSUED",
  "TRANSFERRED",
  "REDEEMED",
  "VOID",
]);

export const deviceTypeEnum = pgEnum("device_type", [
  "METER",
  "GATEWAY",
  "INVERTER",
]);

export const periodStatusEnum = pgEnum("period_status", [
  "OPEN",
  "AWAITING_SOURCE", // R1 §4.3: ENA data lags 30–45 days; waiting is a state, not a bug
  "RECONCILED",
  "DISPUTED",
  "VOID",
]);

export const trackOutcomeEnum = pgEnum("track_outcome", [
  "CARBON_ELIGIBLE",
  "IREC_ONLY",
  "PENDING_REVIEW",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "DRAFT",
  "SUBMITTED",
  "LOCKED",
  "APPROVED",
  "REJECTED",
]);

export const issueRequestStatusEnum = pgEnum("issue_request_status", [
  "DRAFT",
  "CHECKS_PASSED",
  "SUBMITTED",
  "ISSUED",
  "REJECTED",
]);

export const resolutionOutcomeEnum = pgEnum("resolution_outcome", [
  "INSTRUMENT_FAULT",
  "COMMS_GAP",
  "CURTAILMENT",
  "METER_REPLACEMENT",
  "BILLING_LAG",
  "DATA_ERROR",
  "ACCEPTED_WITH_VARIANCE",
  // R1 S6-3R additions
  "ENA_ESTIMATED_READING",
  "INVERTER_OFFLINE",
  "SITE_LOAD_CHANGE",
  "EXTRACTION_ERROR",
]);

export const documentClassEnum = pgEnum("document_class", [
  "CONTRACT",
  "CALIBRATION_CERTIFICATE",
  "SITE_PHOTO",
  "NAMEPLATE_PHOTO",
  "METER_SEAL_PHOTO",
  "UTILITY_BILL",
  "REGISTRY_EVIDENCE",
  "OWNER_ID",
  "OTHER",
]);

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable("app_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull(),
  locale: text("locale").notNull().default("hy"),
  // Auditor accounts support an expiry after which login fails (S0-2).
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  // owner/vendor accounts are scoped to their counterparty record
  ownerId: uuid("owner_id"),
  vendorId: uuid("vendor_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

/* ------------------------------------------------------------------ */
/* Master data: owners, vendors, sites                                */
/* ------------------------------------------------------------------ */

export const owners = pgTable("owner", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  taxId: text("tax_id").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  // AES-encrypted at rest via lib/crypto; masked in all list views.
  bankDetailsEncrypted: text("bank_details_encrypted"),
  preferredLanguage: text("preferred_language").notNull().default("hy"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vendors = pgTable("vendor", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  agreementVersion: text("agreement_version"),
  commissionRatePct: numeric("commission_rate_pct", {
    precision: 5,
    scale: 2,
  }),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sites = pgTable("site", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  vendorId: uuid("vendor_id").references(() => vendors.id),
  status: siteStatusEnum("status").notNull().default("LEAD"),
  capacityKw: numeric("capacity_kw", { precision: 10, scale: 2 }),
  commissioningDate: timestamp("commissioning_date", { withTimezone: true }),
  technology: text("technology").notNull().default("SOLAR_PV"),
  inverterMake: text("inverter_make"),
  inverterModel: text("inverter_model"),
  moduleMake: text("module_make"),
  moduleModel: text("module_model"),
  tiltDeg: numeric("tilt_deg", { precision: 4, scale: 1 }),
  orientationDeg: numeric("orientation_deg", { precision: 4, scale: 1 }),
  lat: numeric("lat", { precision: 9, scale: 6 }),
  lon: numeric("lon", { precision: 9, scale: 6 }),
  address: text("address"),
  // The flight-simulator switch (§1.2). Set at creation; changing it requires
  // admin plus a written reason, both audited.
  isSandbox: boolean("is_sandbox").notNull().default(false),
  reconcileTolerancePct: numeric("reconcile_tolerance_pct", {
    precision: 5,
    scale: 2,
  }),
  toleranceOverrideReason: text("tolerance_override_reason"),
  cohort: text("cohort"),
  // R1: ENA identification (S3B-4), certified quantity (§4.2), per-site
  // source ranking (§4.1) and acquisition mode (S3B-2).
  enaAccountNumber: text("ena_account_number"),
  connectionPointId: text("connection_point_id"),
  certifies: measuredQuantityEnum("certifies").notNull().default("EXPORT"),
  sourceRank: jsonb("source_rank").$type<Record<string, number>>(),
  acquisitionMode: text("acquisition_mode").notNull().default("OWNER_UPLOAD"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const siteTransitions = pgTable("site_transition", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  fromStatus: siteStatusEnum("from_status").notNull(),
  toStatus: siteStatusEnum("to_status").notNull(),
  actorId: uuid("actor_id").notNull(),
  note: text("note"),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Devices & calibration                                              */
/* ------------------------------------------------------------------ */

export const devices = pgTable(
  "device",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    type: deviceTypeEnum("type").notNull(),
    serial: text("serial").notNull(),
    make: text("make"),
    model: text("model"),
    accuracyClass: text("accuracy_class"),
    ctRatio: text("ct_ratio"),
    sealNumber: text("seal_number"),
    installedAt: timestamp("installed_at", { withTimezone: true }),
    decommissionedAt: timestamp("decommissioned_at", { withTimezone: true }),
    // Replacement flow records both instruments and the changeover register.
    replacedByDeviceId: uuid("replaced_by_device_id"),
    changeoverRegisterWh: numeric("changeover_register_wh", {
      precision: 18,
      scale: 3,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("device_serial_unique").on(t.type, t.serial)],
);

export const calibrations = pgTable("calibration", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id),
  certificateDocumentId: uuid("certificate_document_id"),
  issueDate: timestamp("issue_date", { withTimezone: true }).notNull(),
  // Bitemporal: never update — insert a new version, close the old one.
  version: integer("version").notNull().default(1),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  supersededBy: uuid("superseded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Contracts & consent                                                */
/* ------------------------------------------------------------------ */

export const contractTemplates = pgTable(
  "contract_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(), // e.g. 'OWNER_ATTRIBUTE_TRANSFER'
    version: integer("version").notNull(),
    locale: text("locale").notNull(),
    body: text("body").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("template_code_version_locale").on(t.code, t.version, t.locale)],
);

export const contracts = pgTable("contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  templateCode: text("template_code").notNull(),
  // Permanently records which template version was signed (S2-1).
  templateVersion: integer("template_version").notNull(),
  attributeScope: text("attribute_scope").notNull().default("ALL"),
  retainedSharePct: numeric("retained_share_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  paymentBasis: text("payment_basis").notNull().default("FIXED_RATE"), // FIXED_RATE | REVENUE_SHARE
  ratePerMwhAmd: numeric("rate_per_mwh_amd", { precision: 12, scale: 2 }),
  revenueSharePct: numeric("revenue_share_pct", { precision: 5, scale: 2 }),
  termMonths: integer("term_months").notNull(),
  noticePeriodDays: integer("notice_period_days").notNull().default(30),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signatoryName: text("signatory_name"),
  signatoryIp: text("signatory_ip"),
  signedPdfDocumentId: uuid("signed_pdf_document_id"),
  // Immutable on signature; changes create an amendment referencing this row.
  amendsContractId: uuid("amends_contract_id"),
  version: integer("version").notNull().default(1),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  supersededBy: uuid("superseded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Document vault (versioned, immutable, asOf-queryable)              */
/* ------------------------------------------------------------------ */

export const documents = pgTable("document", {
  id: uuid("id").primaryKey().defaultRandom(),
  class: documentClassEnum("class").notNull(),
  siteId: uuid("site_id").references(() => sites.id),
  ownerId: uuid("owner_id").references(() => owners.id),
  deviceId: uuid("device_id").references(() => devices.id),
  language: text("language"),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  // Object-lock key in S3-compatible storage. Content is immutable.
  storageKey: text("storage_key").notNull(),
  sha256: text("sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  version: integer("version").notNull().default(1),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  supersededBy: uuid("superseded_by"),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Periods & readings                                                 */
/* ------------------------------------------------------------------ */

export const periods = pgTable(
  "period",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    startsOn: timestamp("starts_on", { withTimezone: true }).notNull(),
    endsOn: timestamp("ends_on", { withTimezone: true }).notNull(),
    status: periodStatusEnum("status").notNull().default("OPEN"),
    // Which sources were present at reconciliation (S6-3).
    sourcesPresent: jsonb("sources_present").$type<string[]>(),
    supervisorApprovalBy: uuid("supervisor_approval_by"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("period_site_window").on(t.siteId, t.startsOn, t.endsOn)],
);

/**
 * Append-only, hash-chained raw readings (§6.1).
 * TimescaleDB hypertable; UPDATE/DELETE revoked from app_user in migration.
 * The hash chain trigger lives in SQL (drizzle/0001).
 */
export const readingRaw = pgTable(
  "reading_raw",
  {
    id: bigserial("id", { mode: "number" }),
    deviceId: uuid("device_id").notNull(),
    siteId: uuid("site_id").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    registerWh: numeric("register_wh", { precision: 18, scale: 3 }),
    intervalWh: numeric("interval_wh", { precision: 18, scale: 3 }).notNull(),
    source: readingSourceEnum("source").notNull(),
    quantity: measuredQuantityEnum("quantity").notNull().default("EXPORT"),
    enteredBy: uuid("entered_by"),
    prevHash: bytea("prev_hash"),
    hash: bytea("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("reading_dedupe").on(t.deviceId, t.ts, t.source),
    index("reading_site_ts").on(t.siteId, t.ts),
    check(
      "manual_needs_operator",
      sql`${t.source} <> 'MANUAL' or ${t.enteredBy} is not null`,
    ),
  ],
);

export const readingAdjustments = pgTable("reading_adjustment", {
  id: uuid("id").primaryKey().defaultRandom(),
  readingId: numeric("reading_id", { precision: 20, scale: 0 }).notNull(),
  effectiveIntervalWh: numeric("effective_interval_wh", {
    precision: 18,
    scale: 3,
  }).notNull(),
  reasonCode: text("reason_code").notNull(),
  justification: text("justification").notNull(),
  operatorId: uuid("operator_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Reconciliation                                                     */
/* ------------------------------------------------------------------ */

export const reconciliations = pgTable("reconciliation", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodId: uuid("period_id")
    .notNull()
    .references(() => periods.id),
  meterMwh: numeric("meter_mwh", { precision: 14, scale: 4 }),
  inverterMwh: numeric("inverter_mwh", { precision: 14, scale: 4 }),
  utilityMwh: numeric("utility_mwh", { precision: 14, scale: 4 }),
  auxiliaryMwh: numeric("auxiliary_mwh", { precision: 14, scale: 4 }),
  adoptedMwh: numeric("adopted_mwh", { precision: 14, scale: 4 }),
  adoptedSource: readingSourceEnum("adopted_source"),
  tolerancePct: numeric("tolerance_pct", { precision: 5, scale: 2 }).notNull(),
  maxVariancePct: numeric("max_variance_pct", { precision: 8, scale: 4 }),
  // R1 S6-1R: quantity-aware figures and the soft-rule FLAGGED outcome.
  generationMwh: numeric("generation_mwh", { precision: 14, scale: 4 }),
  exportMwh: numeric("export_mwh", { precision: 14, scale: 4 }),
  selfConsumedMwh: numeric("self_consumed_mwh", { precision: 14, scale: 4 }),
  flagged: boolean("flagged").notNull().default(false),
  flagReasons: jsonb("flag_reasons").$type<string[]>(),
  outcome: periodStatusEnum("outcome").notNull(),
  detail: jsonb("detail"),
  runBy: uuid("run_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reconciliationResolutions = pgTable("reconciliation_resolution", {
  id: uuid("id").primaryKey().defaultRandom(),
  reconciliationId: uuid("reconciliation_id")
    .notNull()
    .references(() => reconciliations.id),
  outcome: resolutionOutcomeEnum("outcome").notNull(),
  note: text("note").notNull(),
  resolvedBy: uuid("resolved_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Attribute ledger — the double-counting firewall (§6.2)             */
/* ------------------------------------------------------------------ */

export const attributes = pgTable(
  "attribute",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    periodId: uuid("period_id")
      .notNull()
      .references(() => periods.id),
    mwh: numeric("mwh", { precision: 14, scale: 4 }).notNull(),
    track: attrTrackEnum("track").notNull().default("UNASSIGNED"),
    status: attrStatusEnum("status").notNull().default("MEASURED"),
    serialNo: text("serial_no"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    // Inherited from the site at creation; a sandbox attribute can never
    // reach a live registry (enforced again at the service boundary).
    isSandbox: boolean("is_sandbox").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // THE constraint. One MWh-period, one row, one destiny.
    unique("one_attribute_per_period").on(t.siteId, t.periodId),
    check("mwh_non_negative", sql`${t.mwh} >= 0`),
  ],
);

export const attributeTransitions = pgTable("attribute_transition", {
  id: uuid("id").primaryKey().defaultRandom(),
  attributeId: uuid("attribute_id")
    .notNull()
    .references(() => attributes.id),
  fromStatus: attrStatusEnum("from_status").notNull(),
  toStatus: attrStatusEnum("to_status").notNull(),
  actorId: uuid("actor_id").notNull(),
  note: text("note"),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
});

export const trackAssignments = pgTable("track_assignment", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  outcome: trackOutcomeEnum("outcome").notNull(),
  assessorName: text("assessor_name").notNull(),
  assessedOn: timestamp("assessed_on", { withTimezone: true }).notNull(),
  rationale: text("rationale").notNull(),
  cohort: text("cohort"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Carbon: emission factors & calculations                            */
/* ------------------------------------------------------------------ */

export const emissionFactors = pgTable("emission_factor", {
  id: uuid("id").primaryKey().defaultRandom(),
  gridRegion: text("grid_region").notNull().default("AM"),
  omTco2PerMwh: numeric("om_tco2_per_mwh", { precision: 8, scale: 4 }),
  bmTco2PerMwh: numeric("bm_tco2_per_mwh", { precision: 8, scale: 4 }),
  cmTco2PerMwh: numeric("cm_tco2_per_mwh", {
    precision: 8,
    scale: 4,
  }).notNull(),
  omWeight: numeric("om_weight", { precision: 4, scale: 2 }),
  bmWeight: numeric("bm_weight", { precision: 4, scale: 2 }),
  sourceReference: text("source_reference").notNull(),
  sourceDocumentId: uuid("source_document_id"),
  version: integer("version").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  supersededBy: uuid("superseded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const carbonCalculations = pgTable("carbon_calculation", {
  id: uuid("id").primaryKey().defaultRandom(),
  attributeId: uuid("attribute_id")
    .notNull()
    .references(() => attributes.id),
  grossMwh: numeric("gross_mwh", { precision: 14, scale: 4 }).notNull(),
  auxiliaryMwh: numeric("auxiliary_mwh", { precision: 14, scale: 4 })
    .notNull()
    .default("0"),
  netMwh: numeric("net_mwh", { precision: 14, scale: 4 }).notNull(),
  emissionFactorId: uuid("emission_factor_id")
    .notNull()
    .references(() => emissionFactors.id),
  tco2e: numeric("tco2e", { precision: 14, scale: 4 }).notNull(),
  // Every figure traces to source: the raw reading IDs behind this number.
  inputReadingIds: jsonb("input_reading_ids").$type<number[]>().notNull(),
  version: integer("version").notNull().default(1),
  supersededBy: uuid("superseded_by"),
  calculatedBy: uuid("calculated_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Registry: registration, issuance, certificates                     */
/* ------------------------------------------------------------------ */

export const registryRegistrations = pgTable("registry_registration", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  registry: text("registry").notNull().default("I-REC"),
  status: registrationStatusEnum("status").notNull().default("DRAFT"),
  registryDeviceCode: text("registry_device_code"),
  rejectionReason: text("rejection_reason"),
  payload: jsonb("payload"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const issueRequests = pgTable("issue_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  status: issueRequestStatusEnum("status").notNull().default("DRAFT"),
  attributeIds: jsonb("attribute_ids").$type<string[]>().notNull(),
  totalMwh: numeric("total_mwh", { precision: 14, scale: 4 }).notNull(),
  checklist: jsonb("checklist"),
  registryReference: text("registry_reference"),
  submittedBy: uuid("submitted_by"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const certificateEvents = pgTable("certificate_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  attributeId: uuid("attribute_id")
    .notNull()
    .references(() => attributes.id),
  event: text("event").notNull(), // ISSUED | TRANSFERRED | REDEEMED
  counterparty: text("counterparty"),
  beneficiary: text("beneficiary"),
  ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  detail: jsonb("detail"),
});

/* ------------------------------------------------------------------ */
/* Commercial: buyers, offtake, settlement (Sprint 10)                */
/* ------------------------------------------------------------------ */

export const buyers = pgTable("buyer", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country"),
  contactEmail: text("contact_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const offtakeContracts = pgTable("offtake_contract", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => buyers.id),
  product: text("product").notNull(), // IREC | VCU
  pricePerUnitEur: numeric("price_per_unit_eur", { precision: 12, scale: 2 }),
  volumeUnits: numeric("volume_units", { precision: 14, scale: 4 }),
  deliverySchedule: jsonb("delivery_schedule"),
  version: integer("version").notNull().default(1),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  supersededBy: uuid("superseded_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const payouts = pgTable("payout", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id),
  periodLabel: text("period_label").notNull(),
  mwh: numeric("mwh", { precision: 14, scale: 4 }).notNull(),
  grossAmd: numeric("gross_amd", { precision: 14, scale: 2 }).notNull(),
  deductionsAmd: numeric("deductions_amd", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  netAmd: numeric("net_amd", { precision: 14, scale: 2 }).notNull(),
  statementDocumentId: uuid("statement_document_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vendorCommissions = pgTable("vendor_commission", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  periodLabel: text("period_label").notNull(),
  amountAmd: numeric("amount_amd", { precision: 14, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* R1 Sprint 3B — ENA data acquisition                                */
/* ------------------------------------------------------------------ */

/**
 * S3B-1: explicit, separately acknowledged data-release consent. A site
 * cannot enter the acquisition flow without one; allocation requires consent
 * covering the whole period (hasValidEvidenceBasis). Revocation stops future
 * acquisition but does not invalidate historic attributes.
 */
export const dataReleaseConsents = pgTable("data_release_consent", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id),
  scope: text("scope").notNull().default("ENA_BILLING_DATA"),
  signatoryName: text("signatory_name").notNull(),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
  documentId: uuid("document_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * S3B-3: bill parsing with mandatory human confirmation. Extraction is never
 * auto-accepted — every parsed record waits here until an analyst confirms,
 * corrects (recording the original values and reason) or rejects.
 */
export const billExtractions = pgTable("bill_extraction", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").references(() => sites.id),
  enaAccountNumber: text("ena_account_number"),
  documentId: uuid("document_id"),
  filename: text("filename"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  exportKwh: numeric("export_kwh", { precision: 18, scale: 3 }),
  importKwh: numeric("import_kwh", { precision: 18, scale: 3 }),
  tariff: text("tariff"),
  confidence: numeric("confidence", { precision: 4, scale: 3 })
    .notNull()
    .default("0"),
  status: text("status").notNull().default("PENDING"), // PENDING | CONFIRMED | CORRECTED | REJECTED
  originalValues: jsonb("original_values"),
  correctionReason: text("correction_reason"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  readingIds: jsonb("reading_ids").$type<number[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Glossary — the ELI5 subsystem (§5)                                 */
/* ------------------------------------------------------------------ */

export const glossaryEntries = pgTable(
  "glossary_entry",
  {
    key: text("key").notNull(),
    locale: text("locale").notNull(),
    term: text("term").notNull(),
    short: text("short").notNull(),
    eli5: text("eli5").notNull(),
    whyItMatters: text("why_it_matters").notNull(),
    example: text("example"),
    learnMoreUrl: text("learn_more_url"),
    groupKey: text("group_key").notNull(),
    relatedKeys: jsonb("related_keys").$type<string[]>(),
    updatedBy: uuid("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.key, t.locale] })],
);

/* ------------------------------------------------------------------ */
/* Audit & integrity                                                  */
/* ------------------------------------------------------------------ */

export const auditEvents = pgTable(
  "audit_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_actor_ts").on(t.actorId, t.ts),
    index("audit_entity").on(t.entityType, t.entityId),
  ],
);

export const chainVerificationRuns = pgTable("chain_verification_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  devicesChecked: integer("devices_checked").notNull().default(0),
  readingsChecked: integer("readings_checked").notNull().default(0),
  breaks: jsonb("breaks").$type<
    Array<{ deviceId: string; readingId: number; ts: string }>
  >(),
  triggeredBy: text("triggered_by").notNull().default("schedule"), // schedule | auditor | ops
  ok: boolean("ok"),
});

export const alerts = pgTable("alert", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // CALIBRATION_EXPIRY | CONSENT_EXPIRY | CHAIN_BREAK | ISSUANCE_WINDOW | UNDERPERFORMANCE
  severity: text("severity").notNull().default("info"),
  siteId: uuid("site_id"),
  deviceId: uuid("device_id"),
  message: text("message").notNull(),
  detail: jsonb("detail"),
  acknowledgedBy: uuid("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
