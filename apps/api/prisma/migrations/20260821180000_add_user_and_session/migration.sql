-- MA-3: first product tables for the auth vertical slice.
--
-- `users` holds registered accounts. Only an Argon2id hash of the password
-- is persisted. `email` is stored lowercase-normalized by the application so
-- the unique index also blocks capitalization-only duplicates.
--
-- `session` is the `express-session` / `connect-pg-simple` store table. Its
-- column names and the `IDX_session_expire` index name are dictated by that
-- store, so they intentionally differ from this schema's other naming.

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" TEXT NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");
