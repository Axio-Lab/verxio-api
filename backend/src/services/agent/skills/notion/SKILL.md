---
name: notion
description: Use when the user wants to read or write Notion pages, databases (data sources), or blocks. Implement via a CODE_BLOCK node that calls the Notion API; no dedicated Notion node required.
---

# Notion via CODE_BLOCK

When the user asks to integrate with Notion (create pages, query databases, add blocks, update properties), use a **CODE_BLOCK** node. The user must have a credential holding the Notion API key (e.g. type NOTION or a custom credential with the key).

## Credential

- User creates an integration at https://notion.so/my-integrations and copies the API key (starts with `ntn_` or `secret_`).
- Store in Verxio as a credential the agent can reference. In CODE_BLOCK, access via `inputs.credentials?.NOTION_API_KEY` (or the key name the user configured).
- User must share target pages/databases with the integration in Notion (Share → Connect to → integration name).

## API basics

- Base URL: `https://api.notion.com/v1`
- Headers on every request:
  - `Authorization: Bearer <NOTION_API_KEY>`
  - `Notion-Version: 2025-09-03`
  - `Content-Type: application/json`

## Operations to implement in CODE_BLOCK

**Search (pages and data sources):**  
`POST /search`  
Body: `{"query": "page title"}`

**Get page:**  
`GET /pages/{page_id}`

**Get page blocks:**  
`GET /blocks/{page_id}/children`

**Create page in database:**  
`POST /pages`  
Body: `{"parent": {"database_id": "xxx"}, "properties": {"Name": {"title": [{"text": {"content": "New Item"}}]}, "Status": {"select": {"name": "Todo"}}}}`

**Query database (data source):**  
`POST /data_sources/{data_source_id}/query`  
Body: `{"filter": {"property": "Status", "select": {"equals": "Active"}}, "sorts": [{"property": "Date", "direction": "descending"}]}`

**Update page:**  
`PATCH /pages/{page_id}`  
Body: `{"properties": {"Status": {"select": {"name": "Done"}}}}`

**Append blocks:**  
`PATCH /blocks/{page_id}/children`  
Body: `{"children": [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello"}}]}}]}`

## Property shapes (for database pages)

- Title: `{"title": [{"text": {"content": "..."}}]}`
- Rich text: `{"rich_text": [{"text": {"content": "..."}}]}`
- Select: `{"select": {"name": "Option"}}`
- Multi-select: `{"multi_select": [{"name": "A"}]}`
- Date: `{"date": {"start": "2024-01-15"}}`
- Checkbox: `{"checkbox": true}`
- Number: `{"number": 42}`
- URL: `{"url": "https://..."}`

## CODE_BLOCK pattern

1. Add a CODE_BLOCK node; set variables (e.g. `notionResult`).
2. In credentialIds, reference the credential that holds the Notion API key (if your runtime injects it into `inputs.credentials`).
3. In code: read `inputs.credentials?.NOTION_API_KEY` (or the configured key name), then use `fetch()` with the headers and endpoints above. Return a plain object (e.g. `{ pages: [...] }`) so later nodes can use `{{notionResult.pages}}`.
4. If the user provided page/database IDs from a previous step, read them from `inputs.<previousNode>.<field>` and use them in the API calls.

## Notes

- In API version 2025-09-03, databases are "data sources"; use `database_id` for parent when creating pages, `data_source_id` for query endpoint.
- IDs are UUIDs (with or without dashes). Rate limit ~3 req/s.
