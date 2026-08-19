// Mirrors backend/src/modules/tenants/dto/create-tenant.dto.ts — Slack
// workspace IDs always look like T01ABCDE2F. This only checks shape: Slack
// has no public endpoint to confirm a team ID exists without a bot token for
// that workspace, which is only obtained once "Add to Slack" OAuth install
// completes.
export const SLACK_TEAM_ID_PATTERN = /^T[A-Z0-9]{8,10}$/;
