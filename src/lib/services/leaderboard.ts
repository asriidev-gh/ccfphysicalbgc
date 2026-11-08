import type { Db } from "@/lib/db";
import { formatDuration, type ResultStatusValue } from "@/lib/scoring/engine";
import { buildMatchStandings, rankEntries, type MatchRecord, type RankEntry } from "@/lib/scoring/ranking";
import type { ScoringConfig } from "@/lib/scoring/schema";
import { loadConfig } from "./challenge";

/** Public-safe row: no ids, contact details, or raw scoring data. */
export interface LeaderboardRow {
  rank: number | null;
  name: string;
  /** Cloudinary URL of the participant's registration photo, when one was taken. */
  photoUrl: string | null;
  display: string;
  detail?: string;
  status: ResultStatusValue;
  provisional: boolean;
}

export interface Leaderboard {
  activity: { id: string; name: string; slug: string; icon: string; unit: string | null; template: string };
  rows: LeaderboardRow[];
  /** ISO timestamp of the newest included result (null when empty). */
  updatedAt: string | null;
  generatedAt: string;
}

export function formatValue(cfg: ScoringConfig, value: number | null): string {
  if (value === null) return "—";
  if (cfg.unit === "time" || cfg.template === "TIME" || cfg.template === "MULTI_STATION") return formatDuration(value);
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
  return cfg.unit ? `${n} ${cfg.unit}` : n;
}

interface Opts {
  /** Include results still awaiting approval (shown as provisional). Authorised views only. */
  includeProvisional?: boolean;
  limit?: number;
}

export async function getLeaderboard(db: Db, activityId: string, opts: Opts = {}): Promise<Leaderboard | null> {
  const activity = await db.eventActivity.findUnique({ where: { id: activityId }, include: { sport: { select: { icon: true } } } });
  if (!activity) return null;
  const cfg = loadConfig(activity.scoringConfig);
  const meta = {
    id: activity.id,
    name: activity.name,
    slug: activity.slug,
    icon: activity.sport.icon,
    unit: cfg.unit ?? null,
    template: cfg.template,
  };
  const generatedAt = new Date().toISOString();
  if (!opts.includeProvisional && !activity.leaderboardPublished) return { activity: meta, rows: [], updatedAt: null, generatedAt };

  const results = await db.challengeResult.findMany({
    where: {
      current: true,
      disputed: false,
      attempt: { activityId },
      ...(opts.includeProvisional ? { approvalStatus: { in: ["APPROVED", "PENDING"] } } : { approvalStatus: "APPROVED", published: true }),
    },
    select: {
      id: true,
      resultStatus: true,
      approvalStatus: true,
      finalValue: true,
      calculatedData: true,
      rawData: true,
      submittedAt: true,
      attempt: {
        select: {
          attemptNumber: true,
          activityRegistration: { select: { participantId: true, participant: { select: { fullName: true, photoUrl: true } } } },
          opponentRegistration: { select: { participantId: true, participant: { select: { fullName: true, photoUrl: true } } } },
        },
      },
    },
  });

  const photos = new Map<string, string | null>();
  for (const r of results) {
    for (const reg of [r.attempt.activityRegistration, r.attempt.opponentRegistration]) {
      if (reg) photos.set(reg.participantId, reg.participant.photoUrl);
    }
  }
  const provisionalIds = new Set<string>();
  let entries: RankEntry[];
  if (cfg.template === "MATCH") {
    const matches: MatchRecord[] = [];
    for (const r of results) {
      const opp = r.attempt.opponentRegistration;
      if (!opp) continue;
      const raw = r.rawData as Record<string, number>;
      const a = r.attempt.activityRegistration;
      matches.push({
        id: r.id,
        aId: a.participantId,
        aName: a.participant.fullName,
        bId: opp.participantId,
        bName: opp.participant.fullName,
        scoreA: Number(raw.scoreA ?? 0),
        scoreB: Number(raw.scoreB ?? 0),
        status: r.resultStatus,
        submittedAt: r.submittedAt,
      });
      if (r.approvalStatus === "PENDING") {
        provisionalIds.add(a.participantId);
        provisionalIds.add(opp.participantId);
      }
    }
    entries = buildMatchStandings(cfg, matches);
  } else {
    entries = results.map((r) => {
      const id = r.attempt.activityRegistration.participantId;
      if (r.approvalStatus === "PENDING") provisionalIds.add(`${id}#${r.attempt.attemptNumber}`);
      return {
        id,
        name: r.attempt.activityRegistration.participant.fullName,
        status: r.resultStatus,
        metrics: r.calculatedData as Record<string, number>,
        primary: r.finalValue === null ? null : r.finalValue.toNumber(),
        attemptNumber: r.attempt.attemptNumber,
        submittedAt: r.submittedAt,
      };
    });
  }

  let ranked = rankEntries(cfg, entries);
  if (opts.limit) ranked = ranked.filter((r) => r.rank === null || r.rank <= opts.limit!);
  const newest = results.reduce<Date | null>((m, r) => (!m || r.submittedAt > m ? r.submittedAt : m), null);

  const rows: LeaderboardRow[] = ranked.map((r) => ({
    rank: r.rank,
    name: r.name,
    photoUrl: photos.get(r.id) ?? null,
    display:
      r.status === "VALID"
        ? formatValue(cfg, r.primary)
        : r.status === "DISQUALIFIED"
          ? "DQ"
          : r.status === "INCOMPLETE"
            ? "Incomplete"
            : "—",
    detail:
      cfg.template === "MATCH"
        ? `${r.metrics.wins}W ${r.metrics.draws}D ${r.metrics.losses}L`
        : r.metrics.accuracyPct !== undefined
          ? `${r.metrics.accuracyPct}% acc.`
          : undefined,
    status: r.status,
    provisional: cfg.template === "MATCH" ? provisionalIds.has(r.id) : provisionalIds.has(`${r.id}#${r.attemptNumber}`),
  }));
  return { activity: meta, rows, updatedAt: newest?.toISOString() ?? null, generatedAt };
}

/** All publicly listed activities for an event, each with its published leaderboard. */
export async function getEventBoards(db: Db, eventId: string, limit?: number): Promise<Leaderboard[]> {
  const acts = await db.eventActivity.findMany({
    where: { eventId, leaderboardPublished: true, challengeStatus: { not: "DRAFT" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  const boards = await Promise.all(acts.map((a) => getLeaderboard(db, a.id, { limit })));
  return boards.filter((b): b is Leaderboard => b !== null);
}
