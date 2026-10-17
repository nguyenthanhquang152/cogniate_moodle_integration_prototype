-- T4b1 round 2 (B-T4b1-01): the last failed connect attempt of a pending connection, for the portal and for support.
-- Codes only (never an LTI service description). Cleared when the connection is registered.
ALTER TABLE connection ADD COLUMN last_error_code TEXT;       -- tool page code, for example REGISTRATION_FAILED
ALTER TABLE connection ADD COLUMN last_error_lti_code TEXT;   -- details.message of the LTI service answer, if any
ALTER TABLE connection ADD COLUMN last_error_trace_id TEXT;   -- trace id of the failed request (also in both logs)
ALTER TABLE connection ADD COLUMN last_error_at INTEGER;      -- Unix milliseconds
