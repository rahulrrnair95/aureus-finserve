-- =====================================================================================
-- Aureus Finserve - one-time database setup for Microsoft SQL Server 2019+
-- Run as a sysadmin (e.g. in SSMS or: sqlcmd -S localhost -U sa -i create-database.sql)
-- CHANGE THE PASSWORD below and pass the same value to the app via DB_PASSWORD.
-- The application creates / updates its tables on start-up (ddl-auto=update).
-- =====================================================================================
USE master;
GO

IF DB_ID(N'AureusFinserve') IS NULL
BEGIN
    CREATE DATABASE AureusFinserve COLLATE Latin1_General_100_CI_AS_SC_UTF8;
END
GO

-- Snapshot isolation reduces reader/writer blocking for the reporting queries.
ALTER DATABASE AureusFinserve SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'aureus_app')
BEGIN
    CREATE LOGIN aureus_app WITH PASSWORD = N'ChangeMe@2026', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF,
        DEFAULT_DATABASE = AureusFinserve;
END
GO

USE AureusFinserve;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'aureus_app')
BEGIN
    CREATE USER aureus_app FOR LOGIN aureus_app WITH DEFAULT_SCHEMA = dbo;
END
GO

-- Least privilege that still lets Hibernate create / alter tables (ddl-auto=update):
-- ddladmin (DDL) + datareader + datawriter. Use db_owner instead only if your DBA prefers it.
ALTER ROLE db_ddladmin ADD MEMBER aureus_app;
ALTER ROLE db_datareader ADD MEMBER aureus_app;
ALTER ROLE db_datawriter ADD MEMBER aureus_app;
GO

-- Optional hardening once the schema is stable: switch the app to ddl-auto=validate and
-- remove the ddladmin role:  ALTER ROLE db_ddladmin DROP MEMBER aureus_app;
-- The audit_log table is append-only in the application; to enforce it in the database too:
--   DENY UPDATE, DELETE ON dbo.audit_log TO aureus_app;
GO
