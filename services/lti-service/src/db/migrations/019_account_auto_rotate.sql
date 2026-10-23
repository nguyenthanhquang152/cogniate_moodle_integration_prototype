-- LA-E5-20, LA-ADR-06 D2 and D7 (BD-A2-65): scheduled signing-key rotation is an account setting. Every account starts off.
ALTER TABLE tool_account ADD COLUMN auto_rotate INTEGER NOT NULL DEFAULT 0;
