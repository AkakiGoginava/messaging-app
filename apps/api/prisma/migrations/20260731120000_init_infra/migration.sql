-- Infrastructure-only baseline migration.
--
-- MA-2 (project enablement) validates clean-database migration deployment
-- without creating product-domain tables. This enables the `pgcrypto`
-- extension used by later stories for server-generated UUID primary keys;
-- it introduces no `User`, session-store, conversation, or message tables.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
