#!/usr/bin/env node
// Weekly AEO blog drafter for GeoLocally.
// Picks the next unshipped slug from src/lib/content/CONTENT_BRIEF.md, drafts via
// Claude using src/routes/blog/answer-engine-optimization-for-local-businesses/+page.svelte as voice anchor, writes the page,
// and appends the metadata entry to src/lib/content/blog-posts.js.
//
// Env:
//   ANTHROPIC_API_KEY  required unless DRY_RUN=true
//   FORCE_SLUG         optional override
//   DRY_RUN            "true" → picks + prints, no writes
//   QA_MAX_REVISIONS   optional, default 2 — self-correction attempts before shipping as draft
//   GITHUB_OUTPUT      provided by Actions
//
// Loop: draft → verify (deterministic checks + editorial LLM judge) → revise if
// failing (bounded) → write. A clean draft opens a normal PR; a draft that still
// has issues after QA_MAX_REVISIONS ships as a DRAFT PR with the issues listed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const BRIEF_PATH = path.join(ROOT, "src/lib/content/CONTENT_BRIEF.md");
const BLOG_ROUTES = path.join(ROOT, "src/routes/blog");
const BLOG_INDEX = path.join(ROOT, "src/lib/content/blog-posts.js");
const VOICE_ANCHOR = path.join(ROOT, "src/routes/blog/answer-engine-optimization-for-local-businesses/+page.svelte");

const TODAY = new Date().toISOString().slice(0, 10);
const DISPLAY_DATE = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const DRY_RUN = process.env.DRY_RUN === "true";
const FORCE_SLUG = process.env.FORCE_SLUG?.trim() || "";

async function existingSlugs() {
  const entries = await fs.readdir(BLOG_ROUTES, { withFileTypes: true }).catch(() => []);
  return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
}

function parseBriefRows(md) {
  const rows = [];
  const re = /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gm;
  let m;
  while ((m = re.exec(md))) {
    const [, slug, title, keyword, length] = m;
    rows.push({ slug: slug.trim(), title: title.trim(), keyword: keyword.trim(), length: parseInt(length, 10) || 1200 });
  }
  return rows;
}

async function pickTopic() {
  if (FORCE_SLUG) return { slug: FORCE_SLUG, title: FORCE_SLUG.replace(/-/g, " "), keyword: FORCE_SLUG.replace(/-/g, " "), length: 1200 };
  const brief = await fs.readFile(BRIEF_PATH, "utf8");
  const rows = parseBriefRows(brief);
  const taken = await existingSlugs();
  const next = rows.find((r) => !taken.has(r.slug));
  if (!next) throw new Error("No unshipped topics in CONTENT_BRIEF.md. Add more rows or pass FORCE_SLUG.");
  return next;
}

async function loadVoiceAnchor() {
  return await fs.readFile(VOICE_ANCHOR, "utf8").catch(() => "");
}

const INTERNAL_LINKS = [
  "/blog/answer-engine-optimization-for-local-businesses",
  "/blog/how-local-businesses-show-up-in-ai-search",
  "/blog/your-customers-arent-just-googling-anymore",
  "/blog/what-aeo-means-for-local-businesses",
  "/blog/why-a-video-first-storefront-beats-a-generic-website",
  "/blog/how-to-make-your-business-easier-to-understand-online",
  "/pricing",
  "/faq",
  "/tampa/plumbers",
  "/miami/dentists",
  "/orlando/hvac"
];
const BANNED_WORDS = [
  "AI-powered",
  "AI-assisted",
  "leverage",
  "robust",
  "delve",
  "tapestry",
  "navigate the complexities",
  "in this article we will",
  "the world of",
  "harness",
  "unlock"
];

function systemPrompt() {
  return `You write AEO (Answer Engine Optimization) content for GeoLocally (geolocally.com), a service that serves: Florida local service businesses (plumbers, dentists, lawyers, HVAC, med spas).

The positioning is: AI search for local business.

VOICE RULES (non-negotiable):
- Direct, operator-tone. No "in today's fast-paced world." No AI throat-clearing. No emojis.
- First paragraph delivers the practical takeaway. Lead with the answer.
- Short paragraphs. Concrete examples. Specific named scenarios.
- Use <h2> for top sections, <h3> for sub-sections. Use <p>, <ul>, <ol>, <li>, <strong>, <em>, <a href="...">.
- Banned words/phrases (do NOT use): ${JSON.stringify(BANNED_WORDS)}.
- Hedge if uncertain. Never invent statistics, company names, or case studies.
- Mix sentence length.

SEO/AEO RULES:
- Primary keyword in title, description, first paragraph, and ≥1 <h2>.
- Include 2-4 internal links using ONLY these verified slugs: ${JSON.stringify(INTERNAL_LINKS)}.
- End with a 1-2 sentence CTA linking to /pricing or the contact form.
- Description ≤ 160 characters.
- Excerpt ≤ 160 characters.
- Category is a short 2-3 word label.

OUTPUT FORMAT — return one JSON object exactly:
{
  "slug": "...",
  "title": "...",
  "description": "...",
  "excerpt": "...",
  "category": "...",
  "reading_time_minutes": 6,
  "body_html": "<p>...</p><h2>...</h2>..."
}

body_html must:
- Be plain HTML (no markdown, no Svelte/JSX directives, no className/class attributes).
- Use only: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a href="...">, <blockquote>.
- Use straight quotes inside attributes.
- Include 2+ internal <a href="/..."> links from the allowed slugs above.

Return ONLY the JSON. No prose before or after, no code fences.`;
}

function userPrompt(topic, voiceSample) {
  return `Write the next GeoLocally AEO article.

Topic: ${topic.title}
Slug: ${topic.slug}
Primary keyword: ${topic.keyword}
Target length: ~${topic.length} words

Voice anchor (study the tone, structure, paragraph length):

---
${voiceSample.slice(0, 9000)}
---

Now produce the JSON object described in the system prompt.`;
}

async function callAnthropic(system, user) {
  if (DRY_RUN) {
    console.log("[DRY_RUN] system prompt:\n", system.slice(0, 400), "...\n");
    console.log("[DRY_RUN] user prompt:\n", user.slice(0, 600), "...\n");
    return {
      slug: "dry-run-placeholder", title: "Dry-run placeholder", description: "Dry.", excerpt: "Dry.",
      category: "Test", reading_time_minutes: 4, body_html: "<p>Dry-run placeholder.</p>",
    };
  }
  // Subscription auth (default): shell out to the Claude Code CLI, which uses the
  // logged-in subscription. No API key, no metered spend. Set USE_SUBSCRIPTION=false
  // to fall back to the metered API path below.
  if (process.env.USE_SUBSCRIPTION !== "false") {
    const { spawn } = await import("node:child_process");
    const prompt = `${system}\n\n---\n\n${user}\n\nReturn ONLY the JSON object. No prose, no code fences.`;
    const text = await new Promise((resolve, reject) => {
      const child = spawn("claude", ["-p", "--model", process.env.CLAUDE_MODEL || "opus"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      let out = "", err = "";
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("claude CLI timed out after 15m")); }, 15 * 60 * 1000);
      child.stdout.on("data", (d) => { out += d; });
      child.stderr.on("data", (d) => { err += d; });
      child.on("error", (e) => { clearTimeout(timer); reject(new Error(`claude CLI failed to start: ${e.message}`)); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`claude CLI exited ${code}: ${err.slice(-500)}`));
        resolve(out.trim());
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
    const cleanedSub = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try { return JSON.parse(cleanedSub); }
    catch (err) { console.error("Failed to parse Claude CLI response:\n", cleanedSub.slice(0, 2000)); throw err; }
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY required (or DRY_RUN=true, or USE_SUBSCRIPTION unset).");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-7",
    max_tokens: 8000, system, messages: [{ role: "user", content: user }],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  await logAnthropicUsage(resp, "geolocally-weekly-blog");
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(cleaned); }
  catch (err) { console.error("Failed to parse Claude response:\n", cleaned.slice(0, 2000)); throw err; }
}

async function logAnthropicUsage(resp, project) {
  try {
    const u = resp.usage || {};
    const inTok = u.input_tokens || 0;
    const outTok = u.output_tokens || 0;
    const cost = (inTok / 1_000_000) * 15 + (outTok / 1_000_000) * 75;
    const line = JSON.stringify({
      ts: new Date().toISOString(), service: "anthropic", project,
      model: resp.model || "claude-opus-4-7",
      input_tokens: inTok, output_tokens: outTok,
      est_cost_usd: Math.round(cost * 10000) / 10000,
    }) + "\n";
    const home = process.env.HOME || (await import("node:os")).homedir();
    await (await import("node:fs/promises")).appendFile(`${home}/.openclaw/usage/ai-usage.jsonl`, line);
  } catch (e) { console.warn(`[usage-log] ${e.message}`); }
}

const MAX_REVISIONS = parseInt(process.env.QA_MAX_REVISIONS || "2", 10);

function stripTags(html) { return String(html || "").replace(/<[^>]+>/g, " "); }

// Ground-truth checks — deterministic, no LLM, cannot be argued with.
function deterministicIssues(topic, d) {
  const issues = [];
  const body = String(d.body_html || "");
  const hay = `${d.title || ""}\n${d.description || ""}\n${stripTags(body)}`.toLowerCase();

  for (const w of BANNED_WORDS) {
    if (hay.includes(String(w).toLowerCase())) issues.push(`Banned word/phrase present: "${w}".`);
  }

  const internal = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/"));
  if (internal.length < 2) issues.push(`Need at least 2 internal links; found ${internal.length}.`);
  const allow = INTERNAL_LINKS.map((a) => a.replace(/\/$/, ""));
  for (const h of internal) {
    const base = h.split("#")[0].split("?")[0].replace(/\/$/, "");
    if (!allow.includes(base)) issues.push(`Internal link not in allowlist: "${h}".`);
  }

  if ((d.description || "").length > 160) issues.push(`Description over 160 chars (${(d.description || "").length}).`);
  if ((d.excerpt || "").length > 160) issues.push(`Excerpt over 160 chars (${(d.excerpt || "").length}).`);

  const kw = (topic.keyword || "").toLowerCase();
  if (kw) {
    if (!(d.title || "").toLowerCase().includes(kw)) issues.push(`Primary keyword "${topic.keyword}" missing from title.`);
    if (!(d.description || "").toLowerCase().includes(kw)) issues.push(`Primary keyword missing from description.`);
    const firstP = body.match(/<p>([\s\S]*?)<\/p>/i)?.[1] || "";
    if (!stripTags(firstP).toLowerCase().includes(kw)) issues.push(`Primary keyword missing from first paragraph.`);
  }

  if (!/<h2[ >]/i.test(body)) issues.push("No <h2> section heading.");
  if (/class\s*=|className/i.test(body)) issues.push("Disallowed class/className attribute in body_html.");
  if (/```/.test(body)) issues.push("Markdown code fences present in body_html.");
  for (const f of ["slug", "title", "description", "excerpt", "category", "body_html"]) {
    if (!d[f]) issues.push(`Missing required field: ${f}.`);
  }
  return issues;
}

function judgeSystem() {
  return `You are a strict editorial QA reviewer for GeoLocally (geolocally.com). You judge a drafted AEO blog post against the brand's voice and integrity rules.

Check for:
- Voice: direct operator-tone, answer-first opening, short paragraphs, no AI throat-clearing ("in today's...", "in this article we will"), no emojis, varied sentence length.
- Integrity: NO invented statistics, fabricated company names, or made-up case studies. Claims hedged where uncertain.
- Naturalness: title and meta description read naturally, not keyword-stuffed.
- Genuinely useful to: Florida local service businesses (plumbers, dentists, lawyers, HVAC, med spas).

Return ONLY this JSON, no prose, no code fences:
{ "pass": true|false, "score": 0-100, "issues": ["short actionable issue", ...] }

Set "pass": false if there is ANY invented statistic/case study, a clear voice violation, or unnatural keyword stuffing. Keep each issue short and specific. If clean, return pass:true with an empty issues array.`;
}

function judgeUser(topic, d, voiceSample) {
  return `Voice anchor (target tone):
---
${voiceSample.slice(0, 4000)}
---

DRAFT under review:
Title: ${d.title}
Description: ${d.description}
Primary keyword: ${topic.keyword}

body_html:
${d.body_html}

Return the verdict JSON.`;
}

async function callJudge(topic, d, voiceSample) {
  if (!process.env.ANTHROPIC_API_KEY) return { pass: true, score: null, issues: [] };
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model: process.env.ANTHROPIC_JUDGE_MODEL || process.env.ANTHROPIC_MODEL || "claude-opus-4-7",
    max_tokens: 1200, system: judgeSystem(), messages: [{ role: "user", content: judgeUser(topic, d, voiceSample) }],
  });
  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  await logAnthropicUsage(resp, "geolocally-weekly-blog-qa");
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const v = JSON.parse(cleaned);
    return { pass: !!v.pass, score: typeof v.score === "number" ? v.score : null, issues: Array.isArray(v.issues) ? v.issues : [] };
  } catch {
    // Don't fail silently: surface the unparseable judge as a blocking issue for human review.
    return { pass: false, score: null, issues: ["QA judge returned an unparseable verdict — manual review required."] };
  }
}

function reviseUser(topic, d, issues) {
  return `Your previous draft for "${topic.title}" (slug ${topic.slug}) failed QA. Fix EVERY issue below and return the SAME JSON object format, corrected. Do not introduce new banned words, new disallowed links, or any invented facts.

Issues to fix:
${issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}

Previous draft JSON:
${JSON.stringify(d)}

Return ONLY the corrected JSON object.`;
}

// The verification loop: check → revise → re-check, bounded. Returns the best draft
// plus a qa record describing whether it passed and what (if anything) remains.
async function verifyAndRevise(topic, draft, voiceSample) {
  let current = draft;
  for (let attempt = 0; ; attempt++) {
    const det = deterministicIssues(topic, current);
    const judge = DRY_RUN ? { pass: true, score: null, issues: [] } : await callJudge(topic, current, voiceSample);
    const issues = [...det, ...judge.issues];
    console.log(`QA attempt ${attempt}: ${issues.length ? `${issues.length} issue(s)` : "clean"}${judge.score != null ? `, judge ${judge.score}/100` : ""}`);
    if (issues.length === 0) return { draft: current, qa: { status: "pass", attempts: attempt, issues: [], score: judge.score } };
    if (DRY_RUN || attempt >= MAX_REVISIONS) return { draft: current, qa: { status: "needs-work", attempts: attempt, issues, score: judge.score } };
    console.log(`Revising (attempt ${attempt + 1}/${MAX_REVISIONS})…`);
    current = await callAnthropic(systemPrompt(), reviseUser(topic, current, issues));
  }
}

function qaReportMarkdown(qa) {
  const lines = [`### Automated QA — ${qa.status === "pass" ? "✅ passed" : "⚠️ needs work"}`];
  if (qa.score != null) lines.push(`Editorial judge score: **${qa.score}/100**`);
  lines.push(`Self-correction attempts: ${qa.attempts}`);
  if (qa.issues.length) {
    lines.push("", "**Unresolved issues (fix before merge):**", ...qa.issues.map((i) => `- [ ] ${i}`));
  } else {
    lines.push("", "All deterministic checks (banned words, internal-link allowlist, keyword placement, length limits, structure) and the editorial judge passed.");
  }
  return lines.join("\n") + "\n";
}

function pageSvelte(slug) {
  return `<script>
\timport BlogPostLayout from '$lib/components/marketing/BlogPostLayout.svelte';
\timport { blogPostBySlug } from '$lib/content/blog-posts';

\tconst post = blogPostBySlug['${slug}'];
</script>

<BlogPostLayout {post}>
\t{@html post.bodyHtml}
</BlogPostLayout>
`;
}

function postEntryJs(topic, draft) {
  return `  {
    slug: ${JSON.stringify(topic.slug)},
    title: ${JSON.stringify(draft.title)},
    description: ${JSON.stringify(draft.description)},
    published: ${JSON.stringify(TODAY)},
    displayDate: ${JSON.stringify(DISPLAY_DATE)},
    readingTime: ${JSON.stringify(`${draft.reading_time_minutes || 6} min read`)},
    category: ${JSON.stringify(draft.category || "AEO")},
    coverImage: ${JSON.stringify(`/blog-covers/${topic.slug}.png`)},
    coverAlt: ${JSON.stringify(`GeoLocally blog cover for ${draft.title}.`)},
    excerpt: ${JSON.stringify(draft.excerpt)},
    bodyHtml: ${JSON.stringify(draft.body_html)},
  },
`;
}

async function renderCover(topic, draft) {
  const coverPath = path.join(ROOT, "static", "blog-covers", `${topic.slug}.png`);
  try { await fs.access(coverPath); return; } catch { /* doesn't exist yet, render it */ }
  const { execFile } = await import("node:child_process");
  const overline = (draft.category || "AEO") + " \u00b7 " + (topic.keyword || "AI Search");
  const headline = (draft.title || topic.title).replace(/\s*\|.*$/, "").slice(0, 70);
  await new Promise((resolve, reject) => {
    execFile("node", [path.join(ROOT, "scripts", "render-blog-cover.mjs"), topic.slug, overline, headline],
      { cwd: ROOT, timeout: 60_000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`render-blog-cover.mjs failed: ${stderr || err.message}`));
        console.log(stdout.trim());
        resolve();
      });
  });
}

async function appendBlogIndex(topic, draft) {
  const file = await fs.readFile(BLOG_INDEX, "utf8");
  if (file.includes(`slug: "${topic.slug}"`) || file.includes(`slug: '${topic.slug}'`)) {
    console.log(`Slug ${topic.slug} already in blog index — skipping.`); return false;
  }
  const entry = postEntryJs(topic, draft);
  // Replacer FUNCTION, not a replacement string. In a replacement string "$1",
  // "$&", "$`" and "$'" are special, so any dollar-digit in the post body (every
  // price we quote: "$95", "$189") was being swapped for the captured text and
  // corrupting the file. A function receives the match verbatim and interprets
  // nothing. This broke the build on 2026-08-27.
  const next = file.replace(/(\n\];\s*\n)/, (m) => entry + m);
  if (next === file) throw new Error("Could not find `];` to insert before in blog index file");
  await fs.writeFile(BLOG_INDEX, next);
  return true;
}

async function emitOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

(async () => {
  const topic = await pickTopic();
  console.log(`Topic: ${topic.slug} — ${topic.title}`);
  console.log(`Keyword: ${topic.keyword}, target ${topic.length} words`);
  const voiceSample = await loadVoiceAnchor();
  const draft0 = await callAnthropic(systemPrompt(), userPrompt(topic, voiceSample));
  const { draft, qa } = await verifyAndRevise(topic, draft0, voiceSample);
  if (DRY_RUN) {
    console.log("\n[DRY_RUN] draft:\n", JSON.stringify(draft, null, 2).slice(0, 2200));
    console.log("\n[DRY_RUN] QA:\n", JSON.stringify(qa, null, 2));
    return;
  }
  const pageDir = path.join(BLOG_ROUTES, topic.slug);
  await fs.mkdir(pageDir, { recursive: true });
  const pagePath = path.join(pageDir, "+page.svelte");
  await fs.writeFile(pagePath, pageSvelte(topic.slug));
  await renderCover(topic, draft);
  const indexUpdated = await appendBlogIndex(topic, draft);
  await fs.writeFile(path.join(ROOT, "qa-report.md"), qaReportMarkdown(qa));
  console.log(`✓ wrote ${pagePath}`);
  console.log(indexUpdated ? `✓ updated ${BLOG_INDEX}` : `· ${BLOG_INDEX} unchanged (slug already indexed)`);
  if (qa.status !== "pass") console.warn(`⚠ QA: needs-work after ${qa.attempts} revision(s), ${qa.issues.length} issue(s) — PR will be opened as DRAFT.`);
  await emitOutput("slug", topic.slug);
  await emitOutput("title", draft.title);
  await emitOutput("primary_keyword", topic.keyword);
  await emitOutput("qa_status", qa.status);
})().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
