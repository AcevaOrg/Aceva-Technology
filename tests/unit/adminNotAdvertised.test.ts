/**
 * The console is reachable by typing its URL and by nothing else: no public file links to it,
 * lists it, names it in a feed, or lets the Pulse chatbot mention it.
 *
 * Source files are read with the TypeScript parser, so what counts is code that can reach a
 * visitor (string literals, template text, JSX text, identifiers) and not comments, which are
 * never shipped. Import specifiers are examined separately: a public file importing the
 * console's UI (components/admin, app/admin) would drag it into a public bundle. Importing the
 * shared server helpers in lib/admin (the session check, the IP hash) is fine and not flagged.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { setSqlClientForTests } from "@/lib/db";
import * as nav from "@/lib/nav";

const ROOT = process.cwd();

/** "/admin" as a path, with a boundary: "/administrator" or "/adminx" are different words. */
const ADMIN_PATH = /\/admin(?![A-Za-z0-9_])/i;

/** An import of the console's UI: components/admin or app/admin, by alias or by relative path. */
const ADMIN_UI_IMPORT = /(?:^|\/)(?:components|app)\/admin(?:\/|$)/;

/** Names that exist only to point at the console. */
const ADMIN_IDENTIFIERS = new Set([
  "ADMIN_ROUTES",
  "adminDocumentRoute",
  "ADMIN_HOME_PATH",
  "ADMIN_LOGIN_PATH",
  "ADMIN_OPEN_PATHS",
  "isAdminSurfacePath",
  "requireAdminPage",
  "requireAdminRequest",
]);

/**
 * Public files that may CONTAIN the admin path inside a comparison, because they must recognise
 * the console to get out of its way. Nothing else about them is exempt: a link, a redirect or a
 * label in the same file still fails.
 *
 * Empty on purpose. The marketing chrome used to be the one exemption (it compared the pathname
 * to the console's address); it now just marks itself `data-site-chrome` and the console's own
 * stylesheet hides it, so no public file needs to know the address. Add an entry only with a reason.
 */
const PATH_GUARD_FILES: ReadonlyMap<string, string> = new Map<string, string>();

/* ------------------------------------------------------------------ *
 * Reading source                                                       *
 * ------------------------------------------------------------------ */

interface Literal {
  text: string;
  /** The literal is an operand of ===/!== or the argument of startsWith/endsWith/includes/indexOf. */
  isPathGuard: boolean;
}

interface SourceFacts {
  literals: Literal[];
  identifiers: Set<string>;
  imports: string[];
}

const COMPARISON_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);
const MATCHING_METHODS = new Set(["startsWith", "endsWith", "includes", "indexOf"]);

function isModuleSpecifier(node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): boolean {
  const parent = node.parent;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return parent.moduleSpecifier === node;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent)) return true;
  if (ts.isCallExpression(parent) && parent.arguments[0] === node) {
    return parent.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(parent.expression) && parent.expression.text === "require");
  }
  return false;
}

function isPathGuard(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isBinaryExpression(parent)) return COMPARISON_OPERATORS.has(parent.operatorToken.kind);
  return (
    ts.isCallExpression(parent) &&
    parent.arguments[0] === node &&
    ts.isPropertyAccessExpression(parent.expression) &&
    MATCHING_METHODS.has(parent.expression.name.text)
  );
}

function readSource(file: string): SourceFacts {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, kind);
  const facts: SourceFacts = { literals: [], identifiers: new Set(), imports: [] };

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isModuleSpecifier(node)) facts.imports.push(node.text);
      else facts.literals.push({ text: node.text, isPathGuard: isPathGuard(node) });
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      facts.literals.push({ text: node.text, isPathGuard: false });
    } else if (ts.isJsxText(node)) {
      facts.literals.push({ text: node.text, isPathGuard: false });
    } else if (ts.isIdentifier(node)) {
      facts.identifiers.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return facts;
}

const SOURCE_FILE = /\.(?:ts|tsx)$/;

/** Every .ts/.tsx file beneath `dir` (absolute paths), skipping any directory for which `skip` is true. */
function listSources(dir: string, skip: (relativePath: string) => boolean = () => false): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(ROOT, full).replaceAll("\\", "/");
    if (skip(relative)) continue;
    if (entry.isDirectory()) found.push(...listSources(full, skip));
    else if (SOURCE_FILE.test(entry.name)) found.push(full);
  }
  return found;
}

const rel = (file: string) => path.relative(ROOT, file).replaceAll("\\", "/");
const underAdmin = (relative: string) => /^app\/admin(?:\/|$)/.test(relative) || /^app\/api\/admin(?:\/|$)/.test(relative);

/** Problems with one file's code: admin paths, admin-only identifiers, imports from an admin folder. */
function advertisingIn(file: string): string[] {
  const relative = rel(file);
  const facts = readSource(file);
  const problems: string[] = [];

  for (const literal of facts.literals) {
    if (!ADMIN_PATH.test(literal.text)) continue;
    if (literal.isPathGuard && PATH_GUARD_FILES.has(relative)) continue;
    problems.push(`${relative}: mentions the admin path in ${JSON.stringify(literal.text.trim().slice(0, 80))}`);
  }
  for (const name of ADMIN_IDENTIFIERS) {
    if (facts.identifiers.has(name)) problems.push(`${relative}: references ${name}`);
  }
  for (const specifier of facts.imports) {
    if (ADMIN_UI_IMPORT.test(specifier)) problems.push(`${relative}: imports the console UI from ${JSON.stringify(specifier)}`);
  }
  return problems;
}

function scan(files: string[]): string[] {
  return files.flatMap(advertisingIn);
}

/* ------------------------------------------------------------------ *
 * (a) Feeds                                                            *
 * ------------------------------------------------------------------ */

beforeEach(() => {
  // sitemap.ts may read the document registry; an empty fake keeps this test off any real database.
  setSqlClientForTests(async () => []);
});

afterEach(() => {
  setSqlClientForTests(null);
});

describe("feeds never mention the console", () => {
  it("robots.txt does not list it, not even as a Disallow", () => {
    const output = JSON.stringify(robots());
    expect(output).not.toMatch(/admin/i);
    expect(output.length).toBeGreaterThan(10); // the feed itself was produced
  });

  it("the sitemap does not list it", async () => {
    const entries = await Promise.resolve(sitemap());
    expect(entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(entries)).not.toMatch(/admin/i);
  });

  it("the web app manifest does not mention it", async () => {
    const { default: manifest } = await import("@/app/manifest");
    expect(JSON.stringify(manifest())).not.toMatch(/admin/i);
  });

  it("the public navigation tables do not hold a console path", () => {
    const internal = new Set(["ADMIN_ROUTES", "adminDocumentRoute"]);
    for (const [name, value] of Object.entries(nav)) {
      if (internal.has(name)) continue;
      let rendered: string;
      try {
        rendered = typeof value === "function" ? String((value as (...args: string[]) => unknown)("x", "y")) : JSON.stringify(value);
      } catch {
        continue; // a helper that rejects placeholder arguments builds no path from them
      }
      expect(rendered, `lib/nav.ts export ${name}`).not.toMatch(ADMIN_PATH);
    }
  });
});

/* ------------------------------------------------------------------ *
 * (b) Public source                                                    *
 * ------------------------------------------------------------------ */

describe("no public source file links to the console", () => {
  const publicAppFiles = listSources(path.join(ROOT, "app"), underAdmin);
  const publicComponents = listSources(path.join(ROOT, "components"), (relative) => /^components\/admin(?:\/|$)/.test(relative));

  it("finds the files it is meant to check", () => {
    expect(publicAppFiles.map(rel)).toContain("app/layout.tsx");
    expect(publicAppFiles.map(rel)).toContain("app/page.tsx");
    expect(publicAppFiles.map(rel)).toContain("app/robots.ts");
    expect(publicAppFiles.some((file) => rel(file).startsWith("app/about/"))).toBe(true);
    expect(publicComponents.some((file) => rel(file).startsWith("components/layout/"))).toBe(true);
    expect(publicComponents.some((file) => rel(file).startsWith("components/home/"))).toBe(true);
    expect(publicComponents.some((file) => rel(file).startsWith("components/pulse/"))).toBe(true);
    for (const file of ["app/layout.tsx", "app/manifest.ts", "lib/social.ts"]) {
      expect(existsSync(path.join(ROOT, file)), file).toBe(true);
    }
  });

  it("app/layout.tsx, app/manifest.ts and lib/social.ts", () => {
    expect(scan(["app/layout.tsx", "app/manifest.ts", "lib/social.ts"].map((file) => path.join(ROOT, file)))).toEqual([]);
  });

  it("components/layout, components/home and components/pulse", () => {
    const files = publicComponents.filter((file) => /^components\/(?:layout|home|pulse)\//.test(rel(file)));
    expect(files.length).toBeGreaterThan(10);
    expect(scan(files)).toEqual([]);
  });

  it("every page outside app/admin", () => {
    const pages = publicAppFiles.filter((file) => /\/page\.tsx?$/.test(rel(file)));
    expect(pages.length).toBeGreaterThan(10);
    expect(scan(pages)).toEqual([]);
  });

  it("every other file under app/ outside the console (layouts, handlers, metadata routes)", () => {
    const others = publicAppFiles.filter((file) => !/\/page\.tsx?$/.test(rel(file)));
    expect(scan(others)).toEqual([]);
  });

  it("every other public component", () => {
    const others = publicComponents.filter((file) => !/^components\/(?:layout|home|pulse)\//.test(rel(file)));
    expect(scan(others)).toEqual([]);
  });

  it("the Pulse engine, the SEO helpers and the shared data tables", () => {
    const files = [
      ...listSources(path.join(ROOT, "lib", "pulse")),
      ...listSources(path.join(ROOT, "lib", "data")),
      path.join(ROOT, "lib", "seo.ts"),
    ].filter((file) => existsSync(file));
    expect(files.length).toBeGreaterThan(5);
    expect(scan(files)).toEqual([]);
  });

  it("static files in public/", () => {
    const publicDir = path.join(ROOT, "public");
    const problems: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(?:txt|xml|json|html|webmanifest|md|svg|js|css)$/i.test(entry.name) && statSync(full).size < 2_000_000) {
          if (ADMIN_PATH.test(readFileSync(full, "utf8"))) problems.push(`${rel(full)} mentions the admin path`);
        }
      }
    };
    if (existsSync(publicDir)) walk(publicDir);
    expect(problems).toEqual([]);
  });

  it("only exempts files that still need the exemption", () => {
    // An exemption that outlives its reason is a hole nobody remembers: fail when it is no longer used.
    for (const [file, reason] of PATH_GUARD_FILES) {
      const target = path.join(ROOT, file);
      expect(existsSync(target), `${file} (${reason}) no longer exists: remove it from PATH_GUARD_FILES`).toBe(true);
      const guards = readSource(target).literals.filter((literal) => literal.isPathGuard && ADMIN_PATH.test(literal.text));
      expect(guards.length, `${file} no longer contains a path guard: remove it from PATH_GUARD_FILES`).toBeGreaterThan(0);
    }
  });

  it("only lets an exempt file use the admin path as a comparison operand", () => {
    for (const file of PATH_GUARD_FILES.keys()) {
      const facts = readSource(path.join(ROOT, file));
      for (const literal of facts.literals.filter((entry) => ADMIN_PATH.test(entry.text))) {
        expect(literal.isPathGuard, `${file}: ${JSON.stringify(literal.text)}`).toBe(true);
      }
      expect(facts.identifiers.has("redirect"), `${file} must not redirect anywhere`).toBe(false);
      expect(facts.identifiers.has("href"), `${file} must not render a link`).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ *
 * (c) What the Pulse chatbot can say                                   *
 * ------------------------------------------------------------------ */

/**
 * Wording that points at THIS console. Words like "admin dashboard" or "admin panel" appear in
 * the knowledge base as features ACEVA builds for clients, and must stay possible.
 */
const CONSOLE_MENTIONS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "the /admin path", pattern: ADMIN_PATH },
  { label: "an ADMIN_* environment variable", pattern: /\bADMIN_[A-Z][A-Z_]*\b/ },
  { label: "an admin console, login or sign-in", pattern: /\badmin(?:istrator)?\s+(?:console|log-?in|sign-?in)\b/i },
  { label: "an internal console", pattern: /\binternal\s+(?:admin\s+)?console\b/i },
  { label: "the console's pass key", pattern: /\bpass[\s-]?key\b[^.\n]{0,40}\b(?:admin|console)\b|\b(?:admin|console)\b[^.\n]{0,40}\bpass[\s-]?key\b/i },
];

describe("the Pulse chatbot's knowledge never mentions the console", () => {
  const knowledgeDir = path.join(ROOT, "knowledge");
  const markdown = existsSync(knowledgeDir) ? readdirSync(knowledgeDir).filter((name) => name.endsWith(".md")) : [];

  it("finds the knowledge base", () => {
    expect(markdown.length).toBeGreaterThan(5);
  });

  it.each(CONSOLE_MENTIONS)("has no mention of $label", ({ pattern }) => {
    const hits: string[] = [];
    for (const name of markdown) {
      const lines = readFileSync(path.join(knowledgeDir, name), "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (pattern.test(line)) hits.push(`knowledge/${name}:${index + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it("is not contradicted by the built vector index either", () => {
    const indexFile = path.join(knowledgeDir, "vectorIndex.json");
    if (!existsSync(indexFile)) return;
    const text = readFileSync(indexFile, "utf8");
    for (const { label, pattern } of CONSOLE_MENTIONS) {
      const match = pattern.exec(text);
      expect(match ? text.slice(Math.max(0, match.index - 40), match.index + 80) : null, `vectorIndex.json mentions ${label}`).toBeNull();
    }
  });
});
