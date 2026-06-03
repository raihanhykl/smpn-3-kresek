# Phase 3 — Media Library (Cloudinary) Implementation Plan

> **For agentic workers:** REQUIRED — use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** wire Cloudinary signed direct upload + a `/admin/media` library so the school can upload teacher photos and replace the kalender-akademik / tata-tertib PDFs. Foundation lands without credentials; live upload follows once `CLOUDINARY_*` env vars arrive.

**Architecture:** publicId-as-source-of-truth (cloud name lives only in env, not in DB rows — this is the handover lever). Two API endpoints: `POST /api/media/sign-upload` (auth → rate-limit → hash dedup → Cloudinary signature) and `POST /api/media/confirm` (auth → host allowlist → Cloudinary-format check → MediaAsset insert with P2002 idempotency). `MediaUsage` is written *only* by form server actions via `linkMediaUsage`, never by `/confirm` — uploads always land as orphans and are linked when something references them. A new `PhotoPicker` component owns a discriminated `Photo` value (gradient OR url-publicId) and replaces the gradient-only `GradientPhotoPicker`. DocumentSlot gets an admin upload UI and the public Kalender/Tatib sections gain a "hide download when no PDF" fallback (the missing piece the spec called for but never shipped).

**Tech Stack:** Next.js 15 App Router, React 19, **jest** (not vitest), Prisma 6 + local Postgres, react-hook-form + zodResolver, NextAuth v5, Cloudinary REST API (signed, no SDK on edge), `cloudinary` Node SDK on server-only for signing.

---

## Non-negotiables

1. **publicId-only storage.** `MediaAsset.publicId` is the source of truth; `MediaAsset.url` exists as a denormalized cache *populated at confirm time*, never read by render code. All render goes through `cldUrl(publicId, variant)` which reads `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. Handover = change env var.
2. **`Teacher.photoSrc` semantics:** when `photoKind='url'`, the column stores a *Cloudinary publicId*, not an `https://…` URL. Zod validator enforces the publicId charset (`/^[a-zA-Z0-9_\-/]+$/`, no `://`). Existing seed is gradient-only so impact is zero, but a Task 0 audit verifies.
3. **Jest, not vitest.** Every test in this plan uses `jest.fn()`, `jest.useFakeTimers()`, etc. No `vi.*`.
4. **No new `withRole` for API routes.** `withRole` is server-action shaped (returns `ActionResult`). API routes need a new tiny helper `withApiAuth(request, allowedRoles)` that calls `getSession()` + `requireRole()` and translates `UnauthorizedError`/`ForbiddenError` to `NextResponse.json(..., {status: 401|403})`. This is built in Chunk 1.
5. **Rate limiter shape:** the existing `createRateLimiter` returns `{ allowed, remaining, retryAfterMs }`. API routes read `.allowed === false` and emit `Retry-After: ${Math.ceil(retryAfterMs/1000)}` on 429. No boolean confusion.
6. **Cloudinary stub gate:** the `signCloudinaryUpload` function returns a stub signature **iff `process.env.NODE_ENV === 'test'`** (jest sets this automatically). Never gate on `CLOUDINARY_API_SECRET === 'test-secret'` — that would silently call the real API once production creds land.
7. **`DocumentSlot` shape change is *additive*:** keep the existing return tag `'documents'` (NOT renaming to `'document-slots'`) and the existing `{ id, mediaId }` minimal shape; add a new `getDocumentSlotWithMedia(id)` helper that joins MediaAsset for the admin + the assemblers. Both callers (current tests + new code) keep working.
8. **`downloadHref` / `downloadLabel` must be REMOVED end-to-end** from `AcademicPageConfig['kalender']`, `FacilitiesPageConfig['tatib']`, their Zod schemas, the assemblers, the page-section seed, AND the static config. Replaced by `documentSlot: { media: PublicMediaAsset | null } | null` populated by the assembler. Otherwise the "hide when null" fix doesn't actually fix anything.
9. **Three importers of `GradientPhotoPicker`** (TeacherManager, GalleryItemManager, FacilityManager) — all three migrated in the *same* PR as the rename. Don't delete `GradientPhotoPicker` until grep returns zero hits.
10. **`writeAudit().catch(() => {})`** pattern preserved for every new action and confirm endpoint — audit failure never breaks the user request.
11. **Audit action names use snake_case** (`media_create`, `media_delete`, `document_slot_update`, `link_media_usage`) — same convention as existing `create_teacher` / `delete_teacher`. Plan does NOT use dotted style.
12. **Suite stays green throughout.** Foundation chunks (1–8) must keep tests passing at every commit. Baseline counts re-verified in Task 0.

---

## Task 0 — Snapshot the green baseline

**Files:** none.

- [ ] `npx tsc --noEmit && npm test && npm run test:int`. Record the exact pass counts (likely 112 unit + 73 integration) in the PR description; every subsequent chunk must keep the totals monotonically non-decreasing.
- [ ] `grep -rn "GradientPhotoPicker" src/` to confirm the three importers (TeacherManager, GalleryItemManager, FacilityManager). Note any new importers added since the survey.
- [ ] `psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "Teacher" WHERE "photoKind"=$$url$$;'` — must be 0 today. If non-zero, list the rows and confirm with user before proceeding (the publicId-vs-URL semantic change would invalidate them).

---

## Chunk 1 — Env, config, API auth helper, cldUrl

**Why:** every later chunk consumes these. They're cheap, fully testable without Cloudinary creds, and unblock parallel work.

### Task 1.1 — Env vars

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Modify: `.env.local` (user adds creds later)
- Modify: `jest.setup.ts` (unit test env) and `jest.integration.setup.ts` (integration env)

**Steps:**
- [ ] Add to server block of `env.ts`: `CLOUDINARY_API_KEY: z.string().min(1)`, `CLOUDINARY_API_SECRET: z.string().min(1)`.
- [ ] Add to client block: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().min(1)`.
- [ ] Update `runtimeEnv` to map all three to `process.env.*`.
- [ ] Append to `.env.example`:
  ```
  # === Cloudinary (Phase 3) ===
  # Free tier OK. Get from https://cloudinary.com/console.
  CLOUDINARY_API_KEY=""
  CLOUDINARY_API_SECRET=""
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=""
  ```
- [ ] In `jest.setup.ts`, add the three Cloudinary env stubs **at the very top of the file, BEFORE any `jest.mock(...)` call or any import** so the t3-env validator sees them when `src/lib/env.ts` is transitively loaded:
  ```ts
  process.env.CLOUDINARY_API_KEY ??= 'test-key';
  process.env.CLOUDINARY_API_SECRET ??= 'test-secret';
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??= 'test-cloud';
  ```
- [ ] In `jest.integration.setup.ts`, add the same three lines **immediately after the existing `process.env.AUTH_URL ??= ...` block and BEFORE the `jest.mock('next/cache', ...)` call**. The exact placement matters because the `next/cache` mock module factory loads `@/lib/env`.
- [ ] Run `npm test && npm run test:int`. Expected: same counts as Task 0, all green. If env validation throws "Required" for any CLOUDINARY_* var, the stub placement is wrong.

### Task 1.2 — next.config.mjs Cloudinary host

**Files:** Modify `next.config.mjs`.

- [ ] Add `images.remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }]`. Do NOT change `images.formats` in this task (that's an orthogonal policy decision per reviewer feedback).
- [ ] Run `npm run build` (or `npx next build`) on dev DB; must succeed.

### Task 1.3 — `withApiAuth` helper

**Why:** API routes can't reuse `withRole` (wrong return shape).

**Files:**
- Create: `src/lib/auth/with-api-auth.ts`
- Create: `src/__tests__/lib/auth/with-api-auth.test.ts`

**Steps:**
- [ ] Write `withApiAuth(allowedRoles: Role[], handler: (req: NextRequest, user: AuthSessionUser) => Promise<NextResponse>)`. Internally: `const session = await getSession(); try { const user = requireRole(session, allowedRoles); return await handler(req, user); } catch (e) { if (e instanceof UnauthorizedError) return NextResponse.json({error:'unauthorized'},{status:401}); if (e instanceof ForbiddenError) return NextResponse.json({error:'forbidden'},{status:403}); console.error('[api]', e); return NextResponse.json({error:'unknown_error'},{status:500}); }`.
- [ ] Unit tests mock `getSession`: returns null → 401; returns role not in allow-list → 403; returns valid user → handler called and its response returned; handler throws → 500 with no leaked message.
- [ ] `npm test -- with-api-auth` green.

### Task 1.4 — `cldUrl` wrapper + tests

**Files:**
- Create: `src/lib/media/cldUrl.ts`
- Create: `src/__tests__/lib/media/cldUrl.test.ts`

**Steps:**
- [ ] Export `type CldVariant = 'avatar' | 'card' | 'hero' | 'pdf' | 'original'`.
- [ ] Export `CLD_VARIANTS: Record<CldVariant, { resourceType: 'image' | 'raw'; transform: string }>` with:
  - `avatar` → `image`, `c_fill,g_face,w_200,h_200,f_auto,q_auto`
  - `card` → `image`, `c_fill,w_640,h_400,f_auto,q_auto`
  - `hero` → `image`, `c_fill,w_1600,h_900,f_auto,q_auto`
  - `original` → `image`, `f_auto,q_auto`
  - `pdf` → `raw`, `''` (no transform)
- [ ] `cldUrl(publicId, variant)` builds `https://res.cloudinary.com/${cloud}/${resourceType}/upload/${transform ? transform + '/' : ''}${publicId}`. Reads `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` via `env`.
- [ ] Tests: each variant produces the documented URL given `test-cloud` env; publicId with subfolders (`smpn3kresek/image/abc`) renders correctly; `pdf` variant omits the transform segment entirely.
- [ ] `npm test -- cldUrl` green.

### Task 1.5 — Photo schema tightens 'url' semantics

**Files:**
- Modify: `src/lib/validation/schemas/shared.ts` (the existing `photoSchema`)
- Modify: `src/__tests__/lib/validation/entities.test.ts` (add cases)

**Steps:**
- [ ] In `photoSchema`, change the `url` branch's `src` from `z.string()` (or whatever it is today) to `z.string().regex(/^[a-zA-Z0-9_\-/]+$/, 'must be a Cloudinary publicId').refine(s => !s.includes('://'), 'must be a publicId, not a URL')`.
- [ ] **Alt-text reconciliation note (R1 blocker):** `photoSchema.url.alt` stays `z.string().min(1, 'Alt wajib diisi untuk aksesibilitas')`. Teacher's DB column `photoAlt` is nullable from earlier phases, so the assembler that constructs Teacher.photo from rows must coerce: `alt: row.photoAlt ?? ''` then the Zod parse fails fast on legacy null rows during read — but Task 0 verified zero such rows exist today, so this can only surface if someone writes raw to DB. Document this in `teacher-repo.ts` rowToTeacher comment: "row.photoAlt must be non-null when row.photoKind='url'; current schema enforces it at write time via photoSchema". No DB migration; just a comment + the audit step in Task 0 keeps us safe.
- [ ] Add unit tests: `photoSchema.parse({kind:'url', src:'smpn3kresek/image/abc123', alt:'Pak Budi'})` succeeds; `{kind:'url', src:'https://res.cloudinary.com/foo/bar.jpg', alt:'x'}` fails with the publicId message; `{kind:'url', src:'/uploads/foo.jpg', alt:'x'}` fails; `{kind:'url', src:'smpn3kresek/image/abc', alt:''}` fails with the alt-required message; gradient kind unchanged.
- [ ] Run the existing teacher integration tests (`npm run test:int -- teacher`) — must remain green because the seed is gradient-only.

### Task 1.6 — Commit

- [ ] `git add` the touched files and commit with message: `feat(phase3-foundation): Cloudinary env, withApiAuth, cldUrl, publicId-only photo schema`.

**Deliverable:** all suites green; env validates without crash; `cldUrl` deterministic; `withApiAuth` handles all three auth states.

---

## Chunk 2 — Validation schemas, file limits, URL allowlist, rate limiter

### Task 2.1 — Limits + Zod request/response schemas

**Files:**
- Create: `src/lib/media/limits.ts`
- Create: `src/lib/validation/schemas/media.ts`
- Create: `src/__tests__/lib/validation/media.test.ts`

**Steps:**
- [ ] `limits.ts` exports:
  ```ts
  export const MEDIA_LIMITS = {
    image: { maxBytes: 5 * 1024 * 1024, mimes: ['image/jpeg','image/png','image/webp'] as const, cldFormats: ['jpg','jpeg','png','webp'] as const },
    pdf:   { maxBytes: 10 * 1024 * 1024, mimes: ['application/pdf'] as const, cldFormats: ['pdf'] as const },
  } as const;
  export type MediaKind = keyof typeof MEDIA_LIMITS;
  ```
- [ ] `schemas/media.ts` exports:
  ```ts
  export const mediaKindSchema = z.enum(['image','pdf']);
  const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, 'Hash tidak valid.');
  export const signUploadRequestSchema = z.object({ kind: mediaKindSchema, mimeType: z.string().min(1).max(100), sizeBytes: z.number().int().positive(), sha256Hex, filename: z.string().min(1).max(255), alt: z.string().max(300).optional() });
  export const confirmRequestSchema = z.object({ kind: mediaKindSchema, declaredMime: z.string(), sha256Hex, alt: z.string().max(300).optional(), cloudinary: z.object({ public_id: z.string(), secure_url: z.string().url(), bytes: z.number().int().positive(), format: z.string(), resource_type: z.enum(['image','raw']), original_filename: z.string(), width: z.number().int().optional(), height: z.number().int().optional(), signature: z.string() }) });
  export type SignUploadRequest = z.infer<typeof signUploadRequestSchema>;
  export type ConfirmRequest = z.infer<typeof confirmRequestSchema>;
  export type PublicMediaAsset = { id: string; kind: MediaKind; url: string; publicId: string; alt: string | null; filename: string; sizeBytes: number; mimeType: string; width: number | null; height: number | null };
  ```
- [ ] Tests: each schema accepts a happy-path object; bad hash (63 chars) rejected; oversize `sizeBytes` accepted at schema layer (limit enforced in the route, not schema); cross-type values rejected.
- [ ] Run: `npm test -- media.test` (the unit test file `media.test.ts`). All pass.

### Task 2.2 — URL allowlist

**Files:**
- Create: `src/lib/media/url-allowlist.ts`
- Create: `src/__tests__/lib/media/url-allowlist.test.ts`

**Steps:**
- [ ] `isOwnCloudinaryUrl(url: string, cloudName: string): boolean` — accepts both `https://res.cloudinary.com/<cloud>/image/upload/...` AND `https://res.cloudinary.com/<cloud>/raw/upload/...`. Anything else → false. Use `new URL(url)` to parse; catch malformed → false.
- [ ] Tests cover: matching image, matching raw, wrong cloud → false, http:// → false, non-cloudinary host → false, path-traversal `https://res.cloudinary.com/evil%00mycloud/...` → false (URL parser normalizes), malformed → false.
- [ ] Run: `npm test -- url-allowlist`. All pass.

### Task 2.3 — Upload rate limiter

**Files:**
- Create: `src/lib/media/upload-rate-limit.ts`
- Create: `src/__tests__/lib/media/upload-rate-limit.test.ts`

**Steps:**
- [ ] `export const uploadRateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 });` and `export function getUploadRateLimitKey(userId: string, ip: string) { return \`upload:${userId}:${ip}\`; }`.
- [ ] Tests use `jest.useFakeTimers()` to advance the clock; first 10 keys allowed, 11th `.allowed === false`, `.retryAfterMs > 0`; after window passes, allowed again. (Mirror existing `rate-limit.test.ts` style.)
- [ ] Run: `npm test -- upload-rate-limit`. All pass.

### Task 2.4 — Commit

- [ ] `git add` and commit: `feat(phase3-foundation): media validation schemas, file limits, URL allowlist, upload rate limiter`.

**Deliverable:** all helpers green; ready to plug into routes.

---

## Chunk 3 — MediaAsset repository + linkMediaUsage helper

### Task 3.1 — `media-repo.ts`

**Files:**
- Create: `src/lib/data/repositories/media-repo.ts`
- Create: `src/__tests__/integration/repositories/media-write.test.ts`

**Steps:**
- [ ] Functions:
  - `createMediaAsset(input: { kind, url, publicId, hash, alt, filename, sizeBytes, mimeType, width, height, uploadedBy }): Promise<PublicMediaAsset>` — wraps `prisma.mediaAsset.create`; catches `P2002` on (`hash`) or (`publicId`) → looks up existing row by hash and returns it (idempotent).
  - `getMediaAssetByHash(hash: string): Promise<PublicMediaAsset | null>`
  - `getMediaAssetById(id: string): Promise<PublicMediaAsset | null>`
  - `listMediaAssets({ kind?, limit?, cursor? }): Promise<{ items: PublicMediaAsset[]; nextCursor: string | null }>` — keyset pagination on `createdAt desc, id desc`.
  - `deleteMediaAsset(id: string): Promise<void>` — also delete-cascades `MediaUsage` rows via the FK already in schema.
  - `getMediaAssetUsage(id: string): Promise<{ usedInTable: string; usedInId: string; usedInField: string }[]>`
  - `toPublic(row): PublicMediaAsset` — strips internal fields (`uploadedBy`, timestamps not needed by client).
- [ ] Wrap reads in `unstable_cache(..., ['media', ...args], { tags: ['media'] })`.
- [ ] Integration tests: roundtrip create + getByHash + listMediaAssets cursor; duplicate hash insert returns the existing row (no exception bubbled); deleteMediaAsset cascades MediaUsage rows; listMediaAssets respects kind filter.
- [ ] Run: `npm run test:int -- media-write`. All pass.

### Task 3.2 — `linkMediaUsage` helper

**Files:**
- Create: `src/lib/media/link-usage.ts`
- Create: `src/__tests__/integration/media/link-usage.test.ts`

**Steps:**
- [ ] `async function linkMediaUsage({ mediaId, usedInTable, usedInId, usedInField })` — `prisma.mediaUsage.create(...)`; catches `P2002` on the composite unique → returns silently (idempotent).
- [ ] `async function unlinkMediaUsage(args)` — best-effort delete; no error if row absent.
- [ ] Tests: link twice on the same composite key produces no error, exactly one row exists; link then unlink leaves zero rows; deleteMediaAsset cascades.
- [ ] Run: `npm run test:int -- link-usage`. All pass.

### Task 3.3 — Commit

- [ ] Commit: `feat(phase3-foundation): MediaAsset repository with hash dedup + linkMediaUsage helper`.

**Deliverable:** repo green against test DB; ready to be called from routes + actions.

---

## Chunk 4 — Cloudinary signer (with NODE_ENV='test' stub) + sign-upload + confirm routes

### Task 4.1 — `cloudinary-sign.ts` (server-only)

**Files:**
- Create: `src/lib/media/cloudinary-sign.ts`
- Create: `src/__tests__/lib/media/cloudinary-sign.test.ts`

**Steps:**
- [ ] At the top, mark `import 'server-only'` so it never bundles into the client.
- [ ] Stub gate at the top of `signCloudinaryUpload`:
  ```ts
  if (process.env.NODE_ENV === 'test') {
    return { signature: 'stub-signature-' + p.publicId, apiKey: 'test-key' };
  }
  ```
- [ ] Live path: import the `cloudinary` npm package (add to deps), call `cloudinary.utils.api_sign_request({ public_id, folder, timestamp, resource_type }, env.CLOUDINARY_API_SECRET)`. Return `{ signature, apiKey: env.CLOUDINARY_API_KEY }`.
- [ ] Tests run under jest with `NODE_ENV='test'`; the stub gate fires; signature is deterministic; live path is NOT exercised in CI. (Live verification deferred to Chunk 9.)
- [ ] Verify with a bundle check: `grep "cloudinary" .next/static/chunks/*.js` after build returns nothing. Document this as a follow-up if `@next/bundle-analyzer` isn't installed (reviewer flagged this).

### Task 4.2 — `POST /api/media/sign-upload`

**Files:**
- Create: `src/app/api/media/sign-upload/route.ts`
- Create: `src/__tests__/integration/api/media-sign-upload.test.ts`

**Steps:**
- [ ] `export const dynamic = 'force-dynamic';`
- [ ] Handler skeleton (FIXED: no outer arrow wrapping, no stray `(req)` suffix on return — `withApiAuth` already returns the handler the route expects):
  ```ts
  export const POST = withApiAuth(['ADMIN','EDITOR'], async (req, user) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rl = uploadRateLimiter.check(getUploadRateLimitKey(user.id, ip));
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }
    let body: SignUploadRequest;
    try { body = signUploadRequestSchema.parse(await req.json()); }
    catch (e) { return NextResponse.json({ error: 'invalid_request', detail: (e as ZodError).errors[0]?.message }, { status: 400 }); }
    const limits = MEDIA_LIMITS[body.kind];
    if (!limits.mimes.includes(body.mimeType as never)) return NextResponse.json({ error: 'unsupported_type' }, { status: 415 });
    if (body.sizeBytes > limits.maxBytes) return NextResponse.json({ error: 'too_large' }, { status: 413 });
    const existing = await getMediaAssetByHash(body.sha256Hex);
    if (existing) return NextResponse.json({ reused: true, media: existing });
    const folder = `smpn3kresek/${body.kind}`;
    const publicId = `${folder}/${body.sha256Hex.slice(0, 16)}`;
    const resourceType = body.kind === 'pdf' ? 'raw' : 'image';
    const timestamp = Math.floor(Date.now() / 1000);
    const { signature, apiKey } = signCloudinaryUpload({ publicId, folder, timestamp, resourceType });
    return NextResponse.json({
      reused: false,
      cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      apiKey, timestamp, signature, publicId, folder, resourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    });
  });
  ```
- [ ] Tests with supertest-style fetch against the route via `next-test-api-route-handler` OR direct invocation of the exported handler:
  - No session → 401
  - Session with role VIEWER (if it exists) → 403
  - Valid session + invalid hash → 400
  - Valid + oversized image → 413
  - Valid + disallowed mime → 415
  - Valid + hash already in DB → `{ reused: true, media: {...} }`, no signCloudinaryUpload call (verify via jest.spyOn)
  - Valid + new hash → `{ reused: false, signature: 'stub-signature-...', publicId, ... }`
  - 11th call within 60s → 429 with `Retry-After` header
- [ ] All tests use `NODE_ENV='test'` so signer is stubbed. No real Cloudinary calls.
- [ ] Run: `npm run test:int -- media-sign-upload`. All pass.

### Task 4.3 — `POST /api/media/confirm`

**Files:**
- Create: `src/app/api/media/confirm/route.ts`
- Create: `src/__tests__/integration/api/media-confirm.test.ts`

**Steps:**
- [ ] Handler (FIXED: same single-export pattern, no double-wrap):
  ```ts
  export const POST = withApiAuth(['ADMIN','EDITOR'], async (req, user) => {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rl = uploadRateLimiter.check(getUploadRateLimitKey(user.id, ip));
    if (!rl.allowed) return NextResponse.json({error:'rate_limited'},{status:429,headers:{'Retry-After':String(Math.ceil(rl.retryAfterMs/1000))}});
    const body = confirmRequestSchema.parse(await req.json());
    if (!isOwnCloudinaryUrl(body.cloudinary.secure_url, env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)) return NextResponse.json({error:'forbidden_host'},{status:400});
    const limits = MEDIA_LIMITS[body.kind];
    if (!limits.cldFormats.includes(body.cloudinary.format as never)) return NextResponse.json({error:'format_mismatch'},{status:415});
    if (body.kind === 'image' && body.cloudinary.resource_type !== 'image') return NextResponse.json({error:'resource_type_mismatch'},{status:400});
    if (body.kind === 'pdf' && body.cloudinary.resource_type !== 'raw') return NextResponse.json({error:'resource_type_mismatch'},{status:400});
    if (body.cloudinary.bytes > limits.maxBytes) return NextResponse.json({error:'too_large'},{status:413});
    // createMediaAsset (Task 3.1) catches P2002 on hash and returns the existing row,
    // so two concurrent /confirm calls with the same sha256Hex both receive the SAME media.id.
    const media = await createMediaAsset({
      kind: body.kind, url: body.cloudinary.secure_url, publicId: body.cloudinary.public_id,
      hash: body.sha256Hex, alt: body.alt ?? null, filename: body.cloudinary.original_filename,
      sizeBytes: body.cloudinary.bytes, mimeType: body.declaredMime,
      width: body.cloudinary.width ?? null, height: body.cloudinary.height ?? null,
      uploadedBy: user.id,
    });
    writeAudit({ userId: user.id, action: 'media_create', target: `MediaAsset:${media.id}`, metadata: { kind: media.kind, sizeBytes: media.sizeBytes, publicId: media.publicId } }).catch(() => {});
    revalidateTag('media');
    return NextResponse.json({ ok: true, media });
  });
  ```
- [ ] Tests:
  - Reject foreign host secure_url → 400 forbidden_host
  - Reject format=jpg when kind=pdf → 415
  - Reject resource_type=raw when kind=image → 400 resource_type_mismatch
  - Reject bytes > limit → 413
  - Happy path image → creates MediaAsset, returns it, audit log row exists, `revalidateTag('media')` called (jest mock)
  - Concurrent confirms (Promise.all of two identical bodies) → both responses include the SAME `media.id` (P2002 path tested); only one DB row exists
  - 11th call in 60s → 429
- [ ] Run: `npm run test:int -- media-confirm`. All pass.

### Task 4.4 — Commit

- [ ] Commit: `feat(phase3-foundation): /api/media/sign-upload + /confirm with hash dedup, host allowlist, format check`.

**Deliverable:** both routes work end-to-end against the test DB using the stub signer. No Cloudinary network calls. Ready for Chunk 9 to swap the stub.

---

## Chunk 5 — `/api/media/list` for the library + media actions

### Task 5.1 — `/api/media/list` (GET)

**Files:**
- Create: `src/app/api/media/list/route.ts`
- Create: `src/__tests__/integration/api/media-list.test.ts`

**Steps:**
- [ ] GET handler `withApiAuth(['ADMIN','EDITOR'], ...)` + rate-limit using the **same `uploadRateLimiter`** from Chunk 2.3 (10 req/60s per user+IP). A code comment in this route file documents: "Reusing uploadRateLimiter is intentional for v1; if pagination back-pressure becomes a UX problem add a separate `listRateLimiter({ max: 60, windowMs: 60_000 })`." Query params: `kind?=image|pdf`, `cursor?=string`, `limit?=number (1..50, default 24)`. Body returned: `{ items: PublicMediaAsset[], nextCursor: string | null }`.
- [ ] Auth fail tests; pagination test (seed 30 fixtures, fetch with `limit=10` twice, assert cursors).
- [ ] Run: `npm run test:int -- media-list`. All pass.

### Task 5.2 — `deleteMediaAction` server action

**Files:**
- Create: `src/app/(admin)/admin/media/_actions/media-actions.ts`
- Create: `src/__tests__/integration/admin/media-actions.test.ts`

**Steps:**
- [ ] `deleteMediaAction(id: string): Promise<ActionResult<{ deleted: true } | { deleted: false; usage: Array<{ usedInTable: string; usedInId: string; usedInField: string }> }>>`:
  - `withRole(session, ['ADMIN','EDITOR'], async (user) => { const usage = await getMediaAssetUsage(id); if (usage.length > 0) return { deleted: false, usage }; await deleteMediaAsset(id); writeAudit({userId:user.id, action:'media_delete', target:`MediaAsset:${id}`}).catch(()=>{}); revalidateTag('media'); revalidateTag('teachers'); revalidateTag('documents'); revalidateTag('page:profil'); revalidateTag('page:akademik'); revalidateTag('page:fasilitas'); return { deleted: true }; })`.
  - "Used in N places" surfaces as a non-error result; the UI distinguishes `deleted: true` vs `deleted: false, usage: [...]`.
- [ ] `forceDeleteMediaAction(id: string): Promise<ActionResult<{ deleted: true }>>` — ADMIN-only (drop EDITOR). Skips the usage check, unlinks all MediaUsage rows in a transaction, deletes the MediaAsset row. Used by the /admin/media "Hapus catatan" button for orphan/broken-row cleanup (Chunk 7.1). `writeAudit` uses action `media_force_delete` so the audit trail distinguishes safe deletes from force deletes.
- [ ] Tests: delete unused asset → `{ deleted: true }`, row gone, all 6 revalidateTag calls fired; delete asset linked to a teacher via deleteMediaAction → `{ deleted: false, usage: [{ usedInTable:'Teacher', ... }] }`, row still present; same id with forceDeleteMediaAction (admin) → row gone + usage rows gone; EDITOR calling forceDeleteMediaAction → `{ ok:false, error:'forbidden' }`.
- [ ] Note: these actions run in a server-action context so `withRole` IS the correct primitive (different from the API routes).
- [ ] Run: `npm run test:int -- media-actions`. All pass.

### Task 5.3 — Commit

- [ ] Commit: `feat(phase3-foundation): media list endpoint + delete action with usage guard`.

**Deliverable:** the admin library can read + safely delete; live Cloudinary destroy queued in Chunk 9 (audit row recorded for orphan reconciliation).

---

## Chunk 6 — `PhotoPicker` unified component + ImagePicker modal scaffold

### Task 6.1 — `ImagePicker` modal + `useImagePicker` hook

**Files:**
- Create: `src/components/admin/media/ImagePicker.tsx`
- Create: `src/components/admin/media/ImagePickerProvider.tsx` (mounts at admin layout)
- Create: `src/components/admin/media/useImagePicker.ts`
- Modify: `src/app/(admin)/layout.tsx` (wrap children in provider)
- Create: `src/__tests__/components/admin/ImagePicker.test.tsx`

**Steps:**
- [ ] `ImagePickerProvider` mounts a single `<ImagePicker>` modal at admin layout level so it survives drawer open/close. State: `{ open: boolean, kindFilter: 'image' | 'pdf' | null, resolver: ((picked: PickedMedia | null) => void) | null }`. Resolver is set when `open()` is called and resolved (with `null`) when the user dismisses OR the provider unmounts (reviewer flagged the dangle-forever risk).
- [ ] `useImagePicker()` returns `{ open: (opts?: { kind?: 'image'|'pdf' }) => Promise<PickedMedia | null> }`.
- [ ] `<ImagePicker>` UI: grid of thumbnails fetched from `/api/media/list`; "Upload baru" button (wired in Chunk 7's UploadForm); "Pilih" button per tile resolves the promise with `{ publicId, url, alt }`; "Batal" resolves with `null`.
- [ ] Tests: provider unmount mid-open resolves with `null`; pick resolves with the asset; Escape key cancels; filter by kind hides PDFs when kind='image'.

### Task 6.2 — `PhotoPicker` discriminated component

**Files:**
- Create: `src/components/admin/form/PhotoPicker.tsx`
- Create: `src/__tests__/components/admin/PhotoPicker.test.tsx`

**Steps:**
- [ ] Props (Promise-based, aligned with `useImagePicker` from Task 6.1):
  ```ts
  // Defined ONCE in src/components/admin/media/types.ts and imported here:
  export type PickedMedia = { publicId: string; url: string; alt: string };

  export type PhotoPickerProps = {
    value: Photo;
    onChange: (next: Photo) => void;
    gradientDefaults?: { from: string; to: string; emoji: string };
    urlDefaults?: { src: string; alt: string };
    label?: string;
    disabled?: boolean;
    // Promise-based, returned by useImagePicker().open. Resolves to null when
    // the user dismisses or the provider unmounts mid-flow.
    openImagePicker: (opts?: { kind?: 'image' | 'pdf' }) => Promise<PickedMedia | null>;
  };
  ```
- [ ] Internal: `lastGradient` / `lastUrl` refs so toggling kinds doesn't lose user input.
- [ ] When `value.kind === 'gradient'`: extract the body of today's `GradientPhotoPicker` into a local `<GradientFields>` block — preset gradients, emoji input, color pickers.
- [ ] When `value.kind === 'url'`: show a thumbnail (`<img src={cldUrl(value.src,'card')}>`), an "Ganti Foto" button (calls `openImagePicker({ kind: 'image' })`), and an `alt` text input. If `src` is empty (initial state after toggle), show a placeholder card with "Pilih Foto" CTA.
- [ ] When the picker promise resolves, store `picked.publicId` into `value.src` (NOT the URL — publicId is the source of truth per Non-negotiable #1) and use `picked.alt` as the default for `value.alt` if the user hasn't typed one. If the promise resolves with `null` (user dismissed or provider unmount), do nothing — keep `value` as-is.
- [ ] Tests: toggle gradient↔url preserves each side's state; picking a media sets `src` to the publicId (not URL); alt defaults from media but user override sticks; disabled state grays out both toggles.

### Task 6.3 — Rename `GradientPhotoPicker` → `GradientOnlyPhotoPicker` adapter

**Why:** GalleryItem and Facility still want gradient-only today; making them swap to the full `PhotoPicker` would force a Photo-schema migration on entities that don't need it yet. The adapter keeps the existing behavior with a single import path change.

**Files:**
- Rename: `src/components/admin/form/GradientPhotoPicker.tsx` → `src/components/admin/form/GradientOnlyPhotoPicker.tsx`
- Modify: `src/app/(admin)/admin/entities/gallery/GalleryItemManager.tsx`
- Modify: `src/app/(admin)/admin/entities/facilities/FacilityManager.tsx`

**Steps:**
- [ ] Rename file. Internally unchanged.
- [ ] Update both manager imports.
- [ ] `grep -rn "GradientPhotoPicker" src/` returns zero hits. `npx tsc --noEmit` clean.

### Task 6.4 — Migrate `TeacherManager` to `PhotoPicker`

**Files:**
- Modify: `src/app/(admin)/admin/entities/teachers/TeacherManager.tsx`
- Modify: `src/__tests__/integration/admin/teacher-actions.test.ts` (if it constructs a photo)

**Steps:**
- [ ] Replace flat `from/to/emoji` form fields with nested `photo: Photo` via `Controller`. Form schema becomes `z.object({ name, position, badge, category, photo: photoSchema })`.
- [ ] `openCreate` resets with `photo: { kind:'gradient', from:'#DBEAFE', to:'#93C5FD', emoji:'👤' }`.
- [ ] `openEdit` resets with `photo: t.photo` directly (no branch).
- [ ] `toInput(v)` becomes the identity for `photo`.
- [ ] Render `<Controller name="photo" control={control} render={({field}) => <PhotoPicker value={field.value} onChange={field.onChange} openImagePicker={openImagePicker} gradientDefaults={...} urlDefaults={{src:'', alt:''}} />}/>` wrapped in `<FormField label="Foto" error={(errors.photo as any)?.message}/>`.
- [ ] `npm test && npm run test:int -- teacher` green.
- [ ] **Manual smoke checklist** (NOT automated — the Playwright e2e setup is Phase 5). Mark each item with [ ] in the PR description:
  1. Start dev server: `npm run dev` against the dev DB (the real one, not the test DB).
  2. Navigate to `http://localhost:3060/admin/entities/teachers` (login as `admin@smpn3kresek.sch.id` / your local seed password).
  3. Click "Edit" on any existing gradient teacher — drawer opens, "Gradien & Emoji" tab is selected, current colors + emoji visible.
  4. Click "Foto Upload" tab — UI swaps to: empty thumbnail placeholder + "Pilih Foto" CTA + empty alt input.
  5. Click "Pilih Foto" — `<ImagePicker>` modal opens; should show "Belum ada media" empty state (no uploads yet) plus a disabled "Unggah Baru" button (Chunk 7.1 behavior). Press Escape — modal closes; form reverts to pre-toggle state OR keeps the empty url branch (either is acceptable as long as no error).
  6. Toggle back to "Gradien & Emoji" — original colors restored from `lastGradient` ref.
  7. Click Cancel; drawer closes; no console errors throughout (open DevTools).

### Task 6.5 — Commit

- [ ] Commit: `feat(phase3-foundation): PhotoPicker discriminated, ImagePicker modal scaffold, TeacherManager migration, GradientOnlyPhotoPicker adapter for Gallery + Facility`.

**Deliverable:** TeacherManager UI ready to receive uploads; Gallery + Facility unchanged in behavior; build green.

---

## Chunk 7 — `/admin/media` library page

### Task 7.1 — Page + Manager component

**Files:**
- Create: `src/app/(admin)/admin/media/page.tsx`
- Create: `src/app/(admin)/admin/media/MediaManager.tsx`
- Modify: `src/config/admin-nav.ts` (add Media nav item, group: "Konten", icon: `📷`)
- Create: `src/__tests__/components/admin/MediaManager.test.tsx`

**Steps:**
- [ ] `page.tsx`: server component, `export const dynamic = 'force-dynamic'`, calls `auth()`, wraps `<MediaManager />` in `<AdminShell>`.
- [ ] `MediaManager.tsx` client component: fetches first page via `/api/media/list`, infinite scroll on cursor; filter chips for `image`/`pdf`/`all`; grid of cards (thumbnail via `cldUrl(publicId, 'card')` for images, a PDF icon for pdfs); each card has: file name, kind badge, size, "Hapus" button.
- [ ] "Hapus" calls `deleteMediaAction(id)`. If `usage.length > 0`, surface modal: "Berkas ini dipakai di N tempat. Hapus penggunaannya dulu sebelum menghapus berkas." with the list of `usedInTable/usedInId/usedInField`. If `deleted: true`, optimistic-remove the card from the grid.
- [ ] "Unggah Baru" button at top — behavior in Chunk 7 (foundation, no creds):
  - The page server-checks `env.CLOUDINARY_API_SECRET` length OR queries `/api/media/status` (a tiny new GET returning `{ ready: boolean }`) to decide whether upload is wired.
  - If not ready: button stays visible but `disabled={true}` with `title="Akan tersedia setelah kredensial Cloudinary dikonfigurasi"`. Clicking does nothing.
  - If ready (set in Chunk 9): button enabled; clicking opens `<UploadButton>`'s file input directly (built in Task 9.4).
  - Test: render MediaManager with `ready: false` → button has `disabled` attribute; rerender with `ready: true` → button enabled.
- [ ] Broken-row UI: if `<img>` `onerror` fires, replace with "Berkas hilang di penyimpanan" badge and offer a "Hapus catatan" button that calls `forceDeleteMediaAction` (admin-only, defined in Task 5.2). For EDITOR role, the button is hidden (only ADMIN can force-delete).
- [ ] Tests:
  - Render with mocked fetch (3 items), filter chip toggles kind, click delete → confirmation modal → confirm → list shrinks; verify `deleteMediaAction` was called with the id.
  - Click delete on usage-blocked item → response is `{ deleted: false, usage: [...] }` → modal shows usage list ("Dipakai di: Teacher#xyz / photoSrc") → list does NOT shrink; the row remains.
  - Render a row whose URL 404s → `<img>` onerror fires → badge "Berkas hilang di penyimpanan" rendered → "Hapus catatan" button visible for ADMIN; click → `forceDeleteMediaAction` called → row removed from list.
  - Render the same broken row with role=EDITOR → badge visible but "Hapus catatan" button NOT rendered.
- [ ] Run: `npm test -- MediaManager`. All pass.

### Task 7.2 — Audit nav icon collisions

**Files:** none new.

- [ ] `grep -n "icon:" src/config/admin-nav.ts` — confirm `📷` not used. Survey already flagged `🗂️` collision with Struktur Organisasi; `📷` is unused.

### Task 7.3 — Commit

- [ ] Commit: `feat(phase3-foundation): /admin/media library page with list, filter, delete-with-usage-guard, broken-row UI`.

**Deliverable:** Admin can navigate to /admin/media, see existing assets, delete unused ones. Upload not yet functional (Chunk 9).

---

## Chunk 8 — DocumentSlot admin + drop `downloadHref`, public graceful-fallback

### Task 8.1 — `getDocumentSlotWithMedia` (additive, NOT renaming the existing function)

**Files:**
- Modify: `src/lib/data/repositories/document-slot-repo.ts` (add the new helper, leave old `getDocumentSlot` intact)
- Modify: `src/__tests__/integration/repositories/remaining-repos.test.ts` (add coverage)

**Steps:**
- [ ] Add: `async function loadDocumentSlotWithMedia(id: string): Promise<{ id: string; media: PublicMediaAsset | null } | null>` — joins MediaAsset; if `mediaId` null or row missing, `media: null`.
- [ ] Export `export const getDocumentSlotWithMedia = unstable_cache(loadDocumentSlotWithMedia, ['document-slot-with-media'], { tags: ['documents'] });` — same tag as today, so `revalidateTag('documents')` covers both.
- [ ] Tests: returns `null` for unknown id; returns `{ id, media: null }` when slot exists but no media; returns full media object when linked.

### Task 8.2 — Drop `downloadHref` / `downloadLabel` end-to-end

**Files:**
- Modify: `src/config/types.ts` — remove `downloadLabel: string; downloadHref: string` from `AcademicPageConfig['kalender']` (~line 390) and from `FacilitiesPageConfig['tatib']` (~line 447). Add `documentSlot: { media: PublicMediaAsset | null } | null` to both.
- Modify: `src/config/pages/akademik.ts` — drop the two fields from the static `akademikPageConfig.kalender` (~line 175-176).
- Modify: `src/config/pages/fasilitas.ts` — drop the two fields from `fasilitasPageConfig.tatib` (~line 226-227).
- Modify: any Zod schema validating these page-section shapes. Audit with `grep -rn "downloadHref\|downloadLabel" src/lib/validation/`. Likely candidates: a page-section schema, or the seed-content's per-section schemas. Remove the fields wherever Zod expects them.
- Modify: `src/lib/data/assemblers/akademik.ts` — assembler returns `kalender: { meta, events, documentSlot: await getDocumentSlotWithMedia('kalender-akademik') }`. Note that `documentSlot` is the FULL shape (`{ id, media: PublicMediaAsset | null } | null`) — not a curated subset, per the "Admin CRUD must show on public site" memory rule.
- Modify: `src/lib/data/assemblers/fasilitas.ts` — same for `tata-tertib`.
- Modify: `scripts/seed-content.ts` — remove the two fields from PageSection seed payloads for `kalenderMeta` and `tatib`.
- Modify: `src/components/organisms/akademik/KalenderSection.tsx` — change props type to `data: AcademicPageConfig['kalender']` (which now carries `documentSlot`); render download link only when `data.documentSlot?.media` is non-null. Use `cldUrl(data.documentSlot.media.publicId, 'pdf')`.
- Modify: `src/components/organisms/fasilitas/TatibSection.tsx` — same shape change + same conditional render.

**Steps:**
- [ ] Remove the two fields from the TypeScript types and the matching Zod page-section schemas.
- [ ] Akademik assembler: `getPageSections('akademik')` no longer provides `downloadHref`. Add `documentSlot: await getDocumentSlotWithMedia('kalender-akademik')` to `kalender` shape: `{ meta, events, documentSlot: { media: PublicMediaAsset | null } | null }`.
- [ ] Fasilitas assembler: same for `getDocumentSlotWithMedia('tata-tertib')`.
- [ ] Public sections receive `documentSlot` prop. Render logic: `{props.documentSlot?.media ? <a href={cldUrl(props.documentSlot.media.publicId, 'pdf')} download>Unduh PDF</a> : null}`. No button when null — this is the graceful fallback the spec demanded but no one shipped.
- [ ] Update assembler tests in `src/__tests__/integration/assemblers/assemblers.test.ts` to assert the new shape; seed step in test runs first so getDocumentSlot returns valid empty slots.
- [ ] Update seed-content.ts page-section seed for akademik+fasilitas to drop the two fields.
- [ ] `npm test && npm run test:int` — all green; visual snapshot of /akademik should NOT include the broken `/docs/kalender-akademik.pdf` link any more.

### Task 8.3 — `/admin/documents` (or `/admin/entities/documents`)

**Files:**
- Create: `src/app/(admin)/admin/entities/documents/page.tsx`
- Create: `src/app/(admin)/admin/entities/documents/DocumentSlotManager.tsx`
- Create: `src/app/(admin)/admin/entities/_actions/document-slot-actions.ts`
- Modify: `src/config/admin-nav.ts` (add nav entry "Dokumen PDF", icon `📄`, group: "Konten")

**Steps:**
- [ ] Define explicitly: `export const DOCUMENT_SLOT_IDS = ['kalender-akademik', 'tata-tertib'] as const; export type DocumentSlotId = (typeof DOCUMENT_SLOT_IDS)[number];` — place in `src/config/document-slots.ts`. The Zod schema for the action input uses `z.enum(DOCUMENT_SLOT_IDS)`. Any future new slot must be added here AND seeded via `seed-content.ts` AND the FK column allowed by code review — defense in depth against arbitrary id injection.
- [ ] Server action `updateDocumentSlotAction(slotId: DocumentSlotId, mediaId: string | null): Promise<ActionResult<void>>` via `withRole(['ADMIN','EDITOR'])`. Body validates slot id via the Zod enum above (rejects any value not in the allowlist with 400); reads the current `DocumentSlot.mediaId` first (for unlink); `prisma.documentSlot.update({ where:{id:slotId}, data:{ mediaId, updatedBy: user.id } })`; if previous `mediaId` was set, call `unlinkMediaUsage({ mediaId: previous, usedInTable:'DocumentSlot', usedInId:slotId, usedInField:'mediaId' })`; if new `mediaId` is set, call `linkMediaUsage({ mediaId, usedInTable:'DocumentSlot', usedInId:slotId, usedInField:'mediaId' })`. `writeAudit({userId:user.id, action:'document_slot_update', target:`DocumentSlot:${slotId}`, metadata:{previous, next:mediaId}}).catch(()=>{})`; `revalidateTag('documents')` + `revalidateTag('page:akademik')` + `revalidateTag('page:fasilitas')`.
- [ ] Page renders two cards (one per slot) with: current PDF preview (filename + size + "Buka" link), "Ganti PDF" button → opens ImagePicker filtered to `kind='pdf'`, "Lepas PDF" button (sets mediaId null).
- [ ] Tests: action sets mediaId; old usage unlinked; new usage linked exactly once; revalidate tags fire; the public assembler sees the update without a server restart.

### Task 8.4 — Commit

- [ ] Commit: `feat(phase3-foundation): DocumentSlot admin + drop static downloadHref + public hide-button-when-null`.

**Deliverable:** Public pages stop showing dead PDF links; admin can attach/replace/detach PDFs once Chunk 9 wires upload.

---

## Chunk 9 — Live Cloudinary wiring (after credentials arrive)

**Why:** everything above runs on the stub. This chunk is the single switch-throw.

### Task 9.1 — User supplies credentials

- [ ] User runs `cloudinary` registration; writes `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` to `.env.local`.
- [ ] `node -e "require('@t3-oss/env-core')"` validates without throwing.

### Task 9.2 — Install `cloudinary` SDK (server-only) + MSW (testing)

**Files:**
- Modify: `package.json` (deps: `cloudinary`; devDeps: `msw`)

**Steps:**
- [ ] `npm install cloudinary` (server-only usage).
- [ ] `npm install --save-dev msw`.
- [ ] Create `src/__tests__/mocks/cloudinary-handlers.ts` — MSW handlers that intercept `https://api.cloudinary.com/v1_1/*/upload` and return a canned response (publicId derived from POST body, deterministic). Wire MSW server in `jest.integration.setup.ts` (`beforeAll(() => server.listen())`).

### Task 9.3 — Swap the signer stub for the real SDK call

**Files:**
- Modify: `src/lib/media/cloudinary-sign.ts`

**Steps:**
- [ ] The `NODE_ENV === 'test'` gate stays (keeps unit tests fast and offline).
- [ ] Live path imports `cloudinary` lazily and calls `cloudinary.utils.api_sign_request(...)`. Verify the live call in a one-shot manual script (not in CI): `npx tsx scripts/check-cloudinary-creds.ts` — uses the env vars, signs a dummy publicId, expects no throw.

### Task 9.4 — Client uploader

**Files:**
- Create: `src/components/admin/media/uploadToCloudinary.ts`
- Create: `src/components/admin/media/UploadButton.tsx`
- Modify: `src/components/admin/media/ImagePicker.tsx` (wire the "Unggah Baru" button)

**Steps:**
- [ ] `uploadToCloudinary(file: File, kind: 'image'|'pdf'): Promise<PublicMediaAsset>`:
  1. Client-side preflight: `file.size > MEDIA_LIMITS[kind].maxBytes` → throw `Error('Ukuran berkas melebihi batas (maks 5MB untuk foto, 10MB untuk PDF).')`; `!MEDIA_LIMITS[kind].mimes.includes(file.type)` → throw `Error('Format file tidak didukung.')`.
  2. Compute SHA-256 hex client-side via `crypto.subtle.digest('SHA-256', await file.arrayBuffer())`.
  3. POST to `/api/media/sign-upload`. If 401 → "Sesi habis, silakan login lagi." If 429 → "Terlalu banyak unggahan dalam 1 menit, coba lagi sebentar." If 413/415 → user-facing message. If `reused: true` → return `media`.
  4. Build FormData (`file`, `api_key`, `timestamp`, `signature`, `public_id`, `folder`, `resource_type`) and POST to `uploadUrl`. If network error → "Gagal mengunggah berkas. Coba lagi." If Cloudinary 4xx/5xx → "Penyimpanan media bermasalah, coba lagi sebentar."
  5. POST the Cloudinary response to `/api/media/confirm`. Surface any 4xx with its `error` code mapped to Indonesian copy (see Task 9.5).
- [ ] `<UploadButton>` opens a file picker with the right MIME accept list, calls `uploadToCloudinary`, surfaces progress and errors as toasts.
- [ ] Tests using MSW handlers from Task 9.2: happy path uploads return a media; failed network = thrown user-facing message; oversize preflight rejects before any network call.

### Task 9.5 — User-facing error copy table

**Files:**
- Create: `src/components/admin/media/upload-errors.ts`

**Steps:**
- [ ] Centralize all upload error messages keyed on the API `error` code so future tweaks are one-file:
  ```ts
  export const UPLOAD_ERROR_COPY: Record<string, string> = {
    unauthorized: 'Sesi Anda berakhir. Silakan masuk kembali.',
    forbidden: 'Anda tidak punya izin untuk mengunggah.',
    rate_limited: 'Terlalu banyak unggahan dalam 1 menit. Coba lagi sebentar.',
    invalid_request: 'Data permintaan tidak valid.',
    unsupported_type: 'Format file tidak didukung (gunakan JPG/PNG/WebP atau PDF).',
    too_large: 'Ukuran berkas melebihi batas (maks 5MB untuk foto, 10MB untuk PDF).',
    forbidden_host: 'Berkas tidak diunggah ke penyimpanan resmi sekolah.',
    format_mismatch: 'Format file tidak sesuai dengan tipe yang dipilih.',
    resource_type_mismatch: 'Tipe penyimpanan tidak sesuai.',
    unknown_error: 'Terjadi kesalahan. Silakan coba lagi.',
  };
  ```
- [ ] Use in all client surfaces (UploadButton, MediaManager delete error, etc.).

### Task 9.6 — Manual browser smoke (NOT automated)

This step is explicitly manual. Phase 5 may turn it into a Playwright e2e spec; for Phase 3 we accept that a human verifies the live integration once. The checklist:

- [ ] Confirm `.env.local` has the three real `CLOUDINARY_*` values.
- [ ] Start dev server: `npm run dev` against the dev DB.
- [ ] **Teacher photo upload**:
  1. Login → /admin/entities/teachers → Edit any teacher → click "Foto Upload" tab → click "Pilih Foto" → ImagePicker modal opens.
  2. Click "Unggah Baru" → file picker opens → choose a JPG ≤ 5MB → progress indicator appears → on success the new asset appears in the grid.
  3. Click "Pilih" on that asset → modal closes → form preview shows the photo via `cldUrl(publicId, 'card')`.
  4. Fill `alt` text → click "Simpan" → drawer closes, no error toast.
  5. Open `/profil` in a new tab → the teacher's photo renders via `cldUrl(publicId, 'avatar')`. View source: `<img src="https://res.cloudinary.com/<cloud>/image/upload/c_fill,g_face,w_200,h_200,f_auto,q_auto/smpn3kresek/image/...">`.
- [ ] **DocumentSlot PDF**:
  1. /admin/entities/documents → "kalender-akademik" card → "Ganti PDF" → modal filter=pdf → "Unggah Baru" → choose a PDF ≤ 10MB → asset uploads → click "Pilih" → action runs → success.
  2. Open `/akademik` → the "Unduh Kalender Akademik" button now renders (was hidden when documentSlot.media was null per Chunk 8). Click it → PDF downloads from `https://res.cloudinary.com/<cloud>/raw/upload/smpn3kresek/pdf/...`.
- [ ] **/admin/media library**:
  1. /admin/media → both new assets appear in the grid.
  2. Try deleting the teacher's photo → response is `{ deleted: false, usage: [...] }` → modal lists "Dipakai di: Teacher#..." → row remains.
  3. Try deleting an orphan asset (one not yet linked) → confirmation → asset disappears.
- [ ] **Error paths** (each must surface its mapped Indonesian copy from Task 9.5):
  1. Try uploading a 6MB image → preflight client-side rejection: "Ukuran berkas melebihi batas (maks 5MB untuk foto, 10MB untuk PDF)." (no network call).
  2. Try uploading a `.gif` → preflight rejection: "Format file tidak didukung (gunakan JPG/PNG/WebP atau PDF)."
  3. Open DevTools, throttle network to Offline, retry an upload → "Gagal mengunggah berkas. Coba lagi." after the network failure.
- [ ] No console errors anywhere in the flow (open DevTools throughout).

### Task 9.7 — Commit

- [ ] Commit: `feat(phase3): wire Cloudinary live upload, error copy, MSW test harness`.

**Deliverable:** end-to-end upload works against the real Cloudinary account.

---

## Chunk 10 — Handover groundwork (Phase 5 scope, decisions land now)

**Why:** the publicId-only storage rule from Non-negotiable #1 + #2 is enforced from Phase 3 day one, so Phase 5 can write a simple migrate script without retrofitting render code. The script itself is Phase 5.

### Task 10.1 — Document the storage decision

**Files:**
- Create: `docs/superpowers/specs/2026-05-30-phase-3-storage-and-handover.md`

**Steps:**
- [ ] Write a short spec (≤2 pages) capturing:
  - The publicId-is-truth rule (Non-negotiable #1)
  - The `Teacher.photoSrc = publicId` rule (Non-negotiable #2)
  - The `MediaAsset.url` is a *cache, never read by render code*; reads go through `cldUrl(publicId, variant)`
  - The Phase 5 migrate-script signature (see design proposal `handover`)
  - The Phase 5 HANDOVER.md outline

### Task 10.2 — Brand `PublicMediaAsset.url` so render code can't read it without an explicit cast

**Why pick branded type alone (not a separate lint test):** TypeScript's structural type system is the enforcement, and `tsc --noEmit` is already in the test invariants. A separate lint test would duplicate the gate without adding coverage. Simpler is better for a school project.

**Files:**
- Create: `src/lib/media/branded-types.ts`
- Modify: `src/lib/data/repositories/media-repo.ts` (use a branded type)
- Modify: `src/lib/validation/schemas/media.ts` (type the `url` field as branded)

**Steps:**
- [ ] In `branded-types.ts`:
  ```ts
  // Opaque marker — the type is structurally string but its only constructor is
  // toCachedUrl(), so render code can't accidentally hand a raw string to a JSX prop expecting it.
  export type CloudinaryCachedUrl = string & { readonly __brand: 'CloudinaryCachedUrl' };
  export function toCachedUrl(s: string): CloudinaryCachedUrl { return s as CloudinaryCachedUrl; }
  ```
- [ ] `PublicMediaAsset.url: CloudinaryCachedUrl`. The repo's `toPublic(row)` wraps `row.url` via `toCachedUrl(row.url)`. `/api/media/confirm` writes the response url via `toCachedUrl(body.cloudinary.secure_url)`.
- [ ] Render code (TeacherCard, KalenderSection, TatibSection, MediaManager card) MUST call `cldUrl(asset.publicId, variant)` to get a render-safe URL. Trying to render `<img src={asset.url} />` will compile *because* CloudinaryCachedUrl is structurally a string, BUT the convention is captured in a header comment in `media-repo.ts`: "MediaAsset.url is a cache populated at confirm time; render code MUST go through cldUrl(publicId, variant). The branded type is documentation, not a hard wall — code review enforces."
- [ ] No new test file. The `tsc --noEmit` step in Task 0 + every chunk catches type errors. If we ever want a hard wall, replace the brand with an unexported `CachedUrl` class and expose only `toCachedUrl` from `branded-types.ts`; that's a future refinement.

(Reviewer flagged both this and a grep-based lint test. We pick the brand alone; the lint test is not built.)

### Task 10.3 — Commit + close Phase 3

- [ ] Commit: `docs(phase3): handover groundwork, storage decision recorded, CI guard against direct .url read`.
- [ ] Run `npx tsc --noEmit && npm test && npm run test:int` — record final counts, must be ≥ baseline.
- [ ] Update `MEMORY.md` index if needed.

**Deliverable:** Phase 3 closed; Phase 5 has a clear runway with no design retrofits required.

---

## Deferred to Phase 5 (NOT in this plan)

- `scripts/handover-migrate-media.ts` — needs a real second Cloudinary account to test against.
- `docs/HANDOVER.md` — outlined in design proposal, drafted in Phase 5 with the migrate script.
- Cron orphan cleanup job (deletes Cloudinary `publicId`s that have no DB row and are >7 days old). Spec puts this in Phase 3 but it depends on a VPS deployment which is also Phase 5; flag for joint delivery.

## Rejected / explicitly out of scope

- HEIC support (per user decision — keep tipe file: JPG/PNG/WebP + PDF only).
- GIF support (same).
- Cloudinary signed unsigned-preset shortcut (security risk — every upload signed).
- Storing the cloud name in DB (defeats handover).
- Replacing `withRole` with the new `withApiAuth` for server actions (different shapes for different surfaces is correct).

## Test-suite invariants (verified at every commit)

- `npx tsc --noEmit` exits 0.
- `npm test` count ≥ Task 0 baseline.
- `npm run test:int` count ≥ Task 0 baseline.
- No new ESLint warnings.
- No real Cloudinary network call from any jest test (MSW intercepts or stub gate fires).
