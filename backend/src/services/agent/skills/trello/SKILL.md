---
name: trello
description: Use when the user wants to manage Trello boards, lists, or cards (create cards, move cards, add comments, list boards). Implement via a CODE_BLOCK node that calls the Trello REST API; no dedicated Trello node required.
---

# Trello via CODE_BLOCK

When the user asks to integrate with Trello (boards, lists, cards, comments), use a **CODE_BLOCK** node. The user must have credentials for Trello API key and token (e.g. TRELLO_API_KEY and TRELLO_TOKEN), accessible in CODE_BLOCK via `inputs.credentials`.

## Credential

- User gets API key at https://trello.com/app-key and generates a token (Token link on that page).
- Store in Verxio as credentials (e.g. TRELLO_API_KEY, TRELLO_TOKEN). In CODE_BLOCK: `inputs.credentials?.TRELLO_API_KEY`, `inputs.credentials?.TRELLO_TOKEN`.

## API basics

- Base URL: `https://api.trello.com/1`
- Auth: pass `key` and `token` as query params on every request: `?key=${apiKey}&token=${token}`

## Operations to implement in CODE_BLOCK

**List boards:**  
`GET /members/me/boards?key=...&token=...&fields=name,id`

**Lists in a board:**  
`GET /boards/{boardId}/lists?key=...&token=...`

**Cards in a list:**  
`GET /lists/{listId}/cards?key=...&token=...`

**Create card:**  
`POST /cards?key=...&token=...`  
Body (form or JSON): `idList`, `name`, `desc` (optional)

**Move card:**  
`PUT /cards/{cardId}?key=...&token=...`  
Body: `idList={newListId}`

**Add comment:**  
`POST /cards/{cardId}/actions/comments?key=...&token=...`  
Body: `text=Your comment`

**Archive card:**  
`PUT /cards/{cardId}?key=...&token=...`  
Body: `closed=true`

**Cards on a board:**  
`GET /boards/{boardId}/cards?key=...&token=...`

## CODE_BLOCK pattern

1. Add a CODE_BLOCK node; set variables (e.g. `trelloResult`).
2. In credentialIds, reference the credentials that hold Trello key and token (if your runtime injects them into `inputs.credentials`).
3. In code: read `inputs.credentials?.TRELLO_API_KEY` and `inputs.credentials?.TRELLO_TOKEN`. Use `fetch()` with the base URL, query params for key/token, and the endpoints above. Return a plain object (e.g. `{ boards: [...] }` or `{ card: {...} }`) so later nodes can use `{{trelloResult.boards}}`.
4. If the user provided board/list/card IDs from a previous step or MANUAL_INPUT, read them from `inputs.<previousNode>` and use them in the API calls.

## Notes

- Board/list/card IDs are in Trello URLs or from the list responses. Rate limits: 300 req/10s per key; 100 req/10s per token.
