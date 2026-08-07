/**
 * Scenario seeder (S4-4): one-click generation of realistic sandbox test
 * sites with twelve months of plausible Armenian generation, including
 * seasonal variation and deliberately broken scenarios. Idempotent.
 *
 * Scenarios (each labelled with what it tests):
 *  1. "Bakery Ashtarak"  — clean year, everything reconciles      → happy path
 *  2. "Dairy Gyumri"     — June has a 6% meter/inverter variance  → dispute queue
 *  3. "Winery Areni"     — two-week comms gap in August           → missing-source flow
 *  4. "Hotel Dilijan"    — calibration expired mid-October        → issuance block
 *  5. "Mill Artashat"    — meter replaced mid-May                 → changeover flow
 */
import postgres from "postgres";

// Plausible monthly generation shape for ~10 kW rooftop PV in Armenia (MWh).
const SEASONAL_MWH = [0.7, 0.85, 1.15, 1.35, 1.55, 1.65, 1.7, 1.6, 1.35, 1.05, 0.75, 0.6];

interface Scenario {
  name: string;
  tests: string;
  quirk: "none" | "variance_june" | "gap_august" | "calibration_oct" | "meter_swap_may";
}

const SCENARIOS: Scenario[] = [
  { name: "Bakery Ashtarak", tests: "happy path: clean year, reconciles every month", quirk: "none" },
  { name: "Dairy Gyumri", tests: "6% variance in June → DISPUTED, exception queue", quirk: "variance_june" },
  { name: "Winery Areni", tests: "two-week comms gap in August → missing-source handling", quirk: "gap_august" },
  { name: "Hotel Dilijan", tests: "calibration expires 15 Oct → allocation blocked from October", quirk: "calibration_oct" },
  { name: "Mill Artashat", tests: "meter replaced mid-May → changeover register flow", quirk: "meter_swap_may" },
];

async function main() {
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  const sql = postgres(url, { max: 1, prepare: false });

  const [operator] = await sql`select id from app_account where role = 'admin' limit 1`;
  if (!operator) throw new Error("Run db:seed first (needs an admin account).");
  const operatorId = operator.id as string;

  for (const scenario of SCENARIOS) {
    const existing = await sql`select id from site where name = ${scenario.name}`;
    if (existing.length > 0) {
      console.log(`skip (exists): ${scenario.name}`);
      continue;
    }

    const [owner] = await sql`
      insert into owner (legal_name, tax_id, preferred_language)
      values (${scenario.name + " LLC"}, ${"AM-TAX-" + scenario.name.replace(/\s+/g, "").toUpperCase()}, 'hy')
      returning id`;

    const [site] = await sql`
      insert into site (name, owner_id, status, capacity_kw, technology, is_sandbox, cohort, address)
      values (${scenario.name}, ${owner!.id}, 'PRODUCING', 10.0, 'SOLAR_PV', true,
              'sandbox-demo', ${scenario.name + ", Armenia — seeded scenario: " + scenario.tests})
      returning id`;

    const [meter] = await sql`
      insert into device (site_id, type, serial, make, model, accuracy_class, seal_number, installed_at)
      values (${site!.id}, 'METER', ${"MTR-" + scenario.name.replace(/\s+/g, "-").toUpperCase()},
              'Iskra', 'MT174', '0.5S', 'SEAL-001', '2025-12-15T00:00:00Z')
      returning id`;

    // Calibration: full-year cover, except the calibration_oct scenario.
    const calValidTo =
      scenario.quirk === "calibration_oct" ? "2026-10-15T00:00:00Z" : "2027-01-01T00:00:00Z";
    await sql`
      insert into calibration (device_id, issue_date, valid_from, valid_to)
      values (${meter!.id}, '2025-12-01T00:00:00Z', '2025-12-01T00:00:00Z', ${calValidTo})`;

    // Meter replacement scenario: second instrument, changeover recorded.
    if (scenario.quirk === "meter_swap_may") {
      const [meter2] = await sql`
        insert into device (site_id, type, serial, make, model, accuracy_class, seal_number, installed_at, changeover_register_wh)
        values (${site!.id}, 'METER', ${"MTR-" + scenario.name.replace(/\s+/g, "-").toUpperCase() + "-B"},
                'Iskra', 'MT174', '0.5S', 'SEAL-002', '2026-05-15T00:00:00Z', 6150000)
        returning id`;
      await sql`update device set replaced_by_device_id = ${meter2!.id}, decommissioned_at = '2026-05-15T00:00:00Z'
                where id = ${meter!.id}`;
      await sql`
        insert into calibration (device_id, issue_date, valid_from, valid_to)
        values (${meter2!.id}, '2026-05-01T00:00:00Z', '2026-05-01T00:00:00Z', '2027-05-01T00:00:00Z')`;
    }

    // Twelve months of 2026 readings + periods.
    let register = 0;
    for (let m = 0; m < 12; m++) {
      const mwh = SEASONAL_MWH[m]!;
      const start = new Date(Date.UTC(2026, m, 1));
      const end = new Date(Date.UTC(2026, m + 1, 1));

      const [period] = await sql`
        insert into period (site_id, starts_on, ends_on)
        values (${site!.id}, ${start.toISOString()}, ${end.toISOString()})
        returning id`;

      // Comms gap: August has no meter readings for the first two weeks.
      const gapFactor = scenario.quirk === "gap_august" && m === 7 ? 0.5 : 1;
      const meterMwh = mwh * gapFactor;
      register += meterMwh * 1_000_000;

      await sql`
        insert into reading_raw (device_id, site_id, ts, register_wh, interval_wh, source, entered_by)
        values (${meter!.id}, ${site!.id}, ${new Date(end.getTime() - 1000).toISOString()},
                ${register}, ${meterMwh * 1_000_000}, 'MANUAL', ${operatorId})`;

      // Inverter figure: normally within 1%; June variance scenario drifts 6%.
      const inverterFactor = scenario.quirk === "variance_june" && m === 5 ? 1.06 : 1.01;
      await sql`
        insert into reading_raw (device_id, site_id, ts, interval_wh, source, entered_by)
        values (${meter!.id}, ${site!.id}, ${new Date(end.getTime() - 2000).toISOString()},
                ${mwh * inverterFactor * 1_000_000}, 'MANUAL', ${operatorId})`;

      void period;
    }

    await sql`
      insert into audit_event (actor_id, action, entity_type, entity_id, after)
      values (${operatorId}, 'seed.scenario', 'site', ${site!.id},
              ${JSON.stringify({ scenario: scenario.name, tests: scenario.tests })}::jsonb)`;

    console.log(`seeded: ${scenario.name} — ${scenario.tests}`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
