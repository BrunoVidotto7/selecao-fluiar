# Office And Invitation Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let office members rename their office, view members, send/revoke invitations and let invitees create an account in the correct office through the emailed link.

**Architecture:** Reuse the server-only API client, httpOnly session and async form contract from the main integration plan. An authenticated server page loads office members and pending invitations; a separate public auth page inspects and accepts invitation tokens without forwarding an existing session JWT. The API owns office membership, invitation expiry and single-use enforcement.

**Tech Stack:** Next.js 15.5.28 App Router, React 19.1.10, plain JavaScript, npm, Vitest 5.0.5, Testing Library and existing CSS; existing Spring Boot office/invitation endpoints.

**Spec:** `api/PLANO-BACKEND.md` sections "Contrato da API", "Impacto no frontend", office/invitation tasks and accepted risks; `AGENTS.md`; `ui/AGENTS.md`; `docs/superpowers/plans/2026-10-31-ui-api-integration.md` (approved decisions, shared interfaces, quality gates).

## Global Constraints

- Work only in the existing `/Users/brunovidotto/Documents/bruno/selecao-fluiar` worktree. Do not create another worktree or switch branches.
- This companion is included in the user's approved "Everything" scope. Execute only after main-plan Tasks 1-3 are GREEN and reviewed.
- "User-facing text is Brazilian Portuguese." Code and JSON fields are English; routes are `/escritorio` and `/convite?token=`.
- "Keep data loading in pages." Await `params`, `searchParams` and `cookies()`.
- Use `NEXT_PUBLIC_API_URL=http://localhost:8080` locally and the main plan's `ActionResult`, `apiRequest`, `readApi`, `setSession`, `useApiForm` and validation interfaces without a second implementation.
- No dependency/tool/framework changes; no API/security/DTO/migration changes; no member removal, roles or moving an existing account between offices.
- Invitation tokens are 43-character URL-safe opaque strings, valid for 7 days; inspection and acceptance use `/api/auth/**` without Authorization.
- Office names are required, at most 120 characters. Invitee names are required, at most 120 characters; email at most 254; passwords 8-72 UTF-16 code units and at most 72 UTF-8 bytes, never trimmed.
- Preserve the current design; no edits to `ui/html/`, original list CSS tokens, generated output or the historical quality ledger.
- Follow the main plan's baseline, RED-GREEN-REFACTOR, task review and commit procedures. No push/deploy.

## Review Focus

- An expired/revoked/used token must show the API's invalid-link message and never allow a fake successful acceptance (Task 2).
- An existing revoked JWT cookie must not prevent invitation inspection or acceptance (Task 2).
- A pending invitation sent again for the same email replaces the earlier invitation; the list must not show duplicate pending rows (Task 1).
- A user already signed in to another account must explicitly understand that accepting creates the invited account and replaces this browser session, not moves the old account (Task 2).
- A failed invite-email send, duplicate-account email or failed revoke must not show success or remove a pending invitation (Task 1).

---

## File Structure

UI-relative paths below are under `ui/nextjs/`; commands run there.

| File | Responsibility |
| --- | --- |
| `components/escritorio/actions.js` (new) | Rename office, send invitation and revoke invitation; sanitize outputs and invalidate affected private pages. |
| `components/escritorio/OfficeManager.js` (new) | Separate rename/invite forms, read-only members and pending-invitation list with confirmed revocation. |
| `app/(app)/escritorio/page.js` (new) | Parallel authenticated office/invitation reads; server-supplied time for deterministic expiry labels. |
| `components/convite/actions.js` (new) | Accept a public invitation and save its new session without exposing AuthResponse. |
| `components/convite/InvitationForm.js` (new) | Fixed invitation context, name/password inputs and explicit account-creation submission. |
| `app/(auth)/convite/page.js` (new) | Validate and inspect one URL token; choose form or invalid-link state. |
| `components/layout/AppShell.js` | Add "Escritório" navigation and use refreshed office name. |
| `app/styles/app.css` | Only necessary responsive additions using existing tokens/classes. |
| `test-support/fixtures.js` | Reuse main fixtures; add API-shaped `OFFICE` and `INVITATION` fixtures. |

Tests are `actions.test.js` / `OfficeManager.test.js` / `InvitationForm.test.js` beside their production modules and `page.test.js` beside the invitation page.

## Shared Inputs

- `OfficeResponse = {id,name,members:[{id,name,email}]}`.
- `InvitationResponse = {id,email,expiresAt,createdAt}`; expired invitations remain in GET results.
- `InvitationInfoResponse = {email,officeName,invitedByName}`.
- `InvitationAcceptRequest = {name,password}`; email and office ID must not be supplied by the form.
- `ActionResult<T>` and HTTP/session helpers have exactly the main plan's signatures. No raw JWT is returned to a Client Component.

### Task 1: Office Management And Invitation Administration

**Files:**
- Create: UI-relative `components/escritorio/actions.js`, `components/escritorio/actions.test.js`, `components/escritorio/OfficeManager.js`, `components/escritorio/OfficeManager.test.js`, `app/(app)/escritorio/page.js`.
- Modify: UI-relative `components/layout/AppShell.js`, `components/layout/AppShell.test.js`, `app/styles/app.css`, `test-support/fixtures.js`.

**Interfaces:**
- Consumes: main Tasks 1-3; `OfficeResponse`, `InvitationResponse`, `useConfirm`.
- Produces: `renameOffice({name}) -> Promise<ActionResult<OfficeResponse>>`, `inviteMember({email}) -> Promise<ActionResult<InvitationResponse>>`, `revokeInvitation(id) -> Promise<ActionResult<undefined>>`.
- Produces: `OfficeManager({office:OfficeResponse,invitations:InvitationResponse[],now:string})`; `now` is one ISO instant captured by the server page, not a separate browser clock read during hydration.

- [x] **Step 1: Write failing action/component tests.** Use `OFFICE={id:ME.officeId,name:ME.officeName,members:[{id:ME.id,name:ME.name,email:ME.email}]}` and an invitation with deterministic UUID, email `new@example.com`, `createdAt:'2026-10-31T12:00:00Z'`, `expiresAt:'2026-11-07T12:00:00Z'`.

```js
test('renaming the office sends only its name', async () => {
  // Render OfficeManager, change "Nome do escritório" to "Ateliê Ana", save.
  expect(renameOffice).toHaveBeenCalledWith({name:'Ateliê Ana'});
  expect(inviteMember).not.toHaveBeenCalled();
});
test('sending an existing pending email refreshes instead of duplicating local rows', async () => {
  // Submit new@example.com; rerender with the API's replacement invitation UUID.
  expect(inviteMember).toHaveBeenCalledWith({email:'new@example.com'});
  expect(screen.getAllByText('new@example.com')).toHaveLength(1);
});
test('a failed revoke keeps the invitation visible', async () => {
  revokeInvitation.mockResolvedValue({ok:false,status:503,detail:'Tente novamente.',errors:{}});
  // Click "Revogar convite para new@example.com", confirm, await failure.
  expect(screen.getByText('new@example.com')).toBeTruthy();
  expect(screen.queryByText('Convite revogado.')).toBeNull();
});
```

Also assert required/121-character office-name rejection, `name -> nomeEscritorio` server-error mapping, duplicate-account email error under `emailConvite`, 429/email-send failure detail without success, pending/expired labels based on supplied `now`, member names/emails from DTOs, confirmation cancellation never invoking DELETE, missing session redirect, malformed revoke UUID rejected before write and upstream other-office invitation 404. Page starts `GET /api/office` and `GET /api/office/invitations` concurrently; no member-delete/role controls exist.
- [x] **Step 2: Run RED.** `npx vitest run components/escritorio/actions.test.js components/escritorio/OfficeManager.test.js components/layout/AppShell.test.js`.
- [x] **Step 3: Implement the three actions.** Use `PUT /api/office`, `POST /api/office/invitations`, `DELETE /api/office/invitations/{id}`. Whitelist bodies/validate IDs, await responses, preserve exact ProblemDetail errors. After rename call `revalidatePath('/(app)','layout')` so `/api/me` office names and private list signatures refresh; after invite/revoke invalidate `/escritorio`. Public signatures are no-store and reflect the API on their next read.
- [x] **Step 4: Implement the page and manager.** Add "Escritório" to `AppShell` navigation. Use separate "Salvar escritório" and "Enviar convite" forms with unique IDs `nomeEscritorio` and `emailConvite`. Pending rows show address, expiry and "Revogar convite"; expired rows remain visible as "Expirado". Await successful mutations before feedback and `router.refresh`; props own member/invitation collections. Warn on revoke that the invitation link stops working. Do not expose invitation tokens or invent a resend API.
- [x] **Step 5: Run GREEN.** Repeat Step 2; all pass.
- [x] **Step 6: Review and commit.** Follow the selected execution approach's main-plan review gate; `git commit -m "Add office management and invitation administration."`

### Task 2: Public Invitation Inspection And Acceptance

**Files:**
- Create: UI-relative `components/convite/actions.js`, `components/convite/actions.test.js`, `components/convite/InvitationForm.js`, `components/convite/InvitationForm.test.js`, `app/(auth)/convite/page.js`, `app/(auth)/convite/page.test.js`.
- Modify: UI-relative `app/routes.test.js`; repository-relative `ui/README.md`.

**Interfaces:**
- Consumes: main Tasks 1-3, `isLinkToken`, `setSession`, `InvitationInfoResponse`.
- Produces: `acceptInvitation(token,{name,password}) -> Promise<ActionResult<MeResponse>>` in `'use server'` `components/convite/actions.js`.
- Produces: `InvitationForm({token,invitation:InvitationInfoResponse})`; fields `nome/senha/senha2`, error map `name -> nome`, `password -> senha`.

- [x] **Step 1: Write failing public-route/session/acceptance tests.**

```js
test('invitation acceptance cannot choose its office or email', async () => {
  // Render InvitationForm with inspected info; fill name and matching passwords, submit.
  expect(acceptInvitation).toHaveBeenCalledWith('a'.repeat(43),{name:'Nova Arquiteta',password:'password123'});
  // Action test: exact upstream JSON body has only name/password; no Authorization header.
});
test('an existing revoked JWT is replaced without being sent to auth', async () => {
  // Cookie has old-jwt; public POST resolves AuthResponse with invited-jwt and invited ME.
  const result = await acceptInvitation('a'.repeat(43),{name:'Nova Arquiteta',password:'password123'});
  expect(result.ok).toBe(true);
  expect(JSON.stringify(result)).not.toContain('invited-jwt');
  expect(fetchMock.mock.calls.at(-1)[1].headers.get('Authorization')).toBeNull();
  expect(cookieStore.set).toHaveBeenCalledWith('fluiar_session','invited-jwt',expect.objectContaining({httpOnly:true}));
});
test('a token revoked between inspection and acceptance cannot succeed', async () => {
  acceptInvitation.mockResolvedValue({ok:false,status:400,
    detail:'Este link expirou ou já foi usado. Peça um novo.',errors:{}});
  // Submit valid values; await response.
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByText('Este link expirou ou já foi usado. Peça um novo.')).toBeTruthy();
});
```

Add page assertions for missing/array/malformed tokens (no fetch and no form), valid token inspection (public request), expired/used/revoked 400 (exact invalid-link copy, no form), upstream network error (auth boundary, not invalid-link copy), correct office/inviter/fixed email display, mismatched passwords (no accept), duplicate-email 409 (no success), and the explicit account/session-switch copy. Direct action calls must validate token shape and never allow extra email/office fields into the upstream JSON. Inspecting on GET must not set/delete any session cookie.
- [x] **Step 2: Run RED.** `npx vitest run components/convite/actions.test.js components/convite/InvitationForm.test.js app/'(auth)'/convite/page.test.js app/routes.test.js`.
- [x] **Step 3: Implement public invitation inspection.** Await `searchParams`, accept one valid `token`, `GET /api/auth/invitations/{token}` with `auth:'public'`. Render office/inviter/email context from that response. Missing/invalid/expired links show `Este link expirou ou já foi usado. Peça um novo.` plus `Peça um novo convite ao escritório.` and a login link; never display a signup form with a fabricated address.
- [x] **Step 4: Implement explicit invitation acceptance.** Form copy states `Este convite cria uma conta para {email} no escritório {officeName}. Ao aceitar, você entrará nessa conta neste navegador.` Button label is "Criar conta e aceitar convite". `POST /api/auth/invitations/{token}/acceptance` sends only `name/password`; success stores a session cookie (`persistent:false`), returns only `user`, then navigates to `/dashboard` with real data and refreshes. It does not transfer or modify the previously signed-in account.
- [x] **Step 5: Run GREEN.** Repeat Step 2; all pass. Add Mailpit invitation instructions to the existing README runbook, without new infrastructure or credentials.
- [x] **Step 6: Review and commit.** Follow the selected execution approach's main-plan review gate; `git commit -m "Accept office invitations through real email links."`

## Completion And Self-Review

- [x] Execute the main plan's final integration gate once after both plans are complete, including local Mailpit acceptance, same-office shared data, revoked links and cross-office denial. Reuse unchanged focused-test evidence; do not add a second full-suite gate.

Both implementation tasks and reviewed corrections are complete. The shared final UI checks pass
1127 tests, lint with only the accepted warnings, and production build. Recorded local Next/API/Mailpit
checks verify invitation acceptance, shared office data, superseded/single-use/revoked links and
cross-office denial. Overall acceptance remains NOT_VERIFIED: required actual desktop/mobile
browser and Flight-transition evidence is unavailable. This checkbox remains open; evidence is
retained in the main SDD workspace. Owned temporary services were stopped without deleting data.
- Coverage checked: office rename/member listing/pending listing/create/revoke -> Task 1; invitation inspection/acceptance -> Task 2. No unsupported member/role/account-move API is proposed.
- Types checked: management returns `OfficeResponse`/`InvitationResponse`; public inspection returns `InvitationInfoResponse`; acceptance consumes the API's `AuthResponse` privately and returns `MeResponse`.
- Review Focus cases are pinned to the owning task's regression assertions. User-session replacement requires an explicit acceptance submission.
- This document is a plan, not evidence that the workflows have been implemented or verified.
