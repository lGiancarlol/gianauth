const fs      = require("fs");
const path    = require("path");
const { execSync } = require("child_process");
const prisma  = require("./prisma");
const log     = require("./logger");

const BACKUP_DIR  = path.resolve(__dirname, "../../prisma/backups");
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || "7");

const IS_POSTGRES = (process.env.DATABASE_URL || "").startsWith("postgresql") ||
                    (process.env.DATABASE_URL || "").startsWith("postgres");

function ensureDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// -- SQLite backup ------------------------------------------------------------
function backupSqlite() {
  const DB_PATH = path.resolve(__dirname, "../../prisma/dev.db");
  if (!fs.existsSync(DB_PATH)) {
    log.job.warn("Backup skipped: dev.db not found");
    return null;
  }
  ensureDir();
  const filename = `backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.db`;
  const destPath = path.join(BACKUP_DIR, filename);
  fs.copyFileSync(DB_PATH, destPath);
  return { filename, destPath, sizeBytes: fs.statSync(destPath).size };
}

// -- PostgreSQL backup --------------------------------------------------------
function backupPostgres() {
  ensureDir();
  const filename = `backup-${new Date().toISOString().slice(0, 10)}-${Date.now()}.sql.gz`;
  const destPath = path.join(BACKUP_DIR, filename);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  // pg_dump must be installed on the server (standard with PostgreSQL)
  execSync(`pg_dump "${dbUrl}" | gzip > "${destPath}"`, {
    stdio: ["ignore", "ignore", "pipe"],
    timeout: 120_000,
  });

  if (!fs.existsSync(destPath)) throw new Error("pg_dump produced no output file");
  return { filename, destPath, sizeBytes: fs.statSync(destPath).size };
}

// -- Rotation -----------------------------------------------------------------
function rotateBackups(ext) {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of files.slice(MAX_BACKUPS)) {
    fs.unlinkSync(path.join(BACKUP_DIR, old.name));
    log.job.info(`Rotated old backup: ${old.name}`);
  }
}

// -- Main ---------------------------------------------------------------------
async function runBackup() {
  let result;
  try {
    result = IS_POSTGRES ? backupPostgres() : backupSqlite();
    if (!result) return null;
  } catch (err) {
    log.job.error(err, "Backup failed");
    throw err; // re-throw so callers know it failed
  }

  await prisma.backupRecord.create({
    data: { filename: result.filename, sizeBytes: result.sizeBytes },
  }).catch(() => {});

  rotateBackups(IS_POSTGRES ? ".sql.gz" : ".db");

  log.job.info({ filename: result.filename, sizeBytes: result.sizeBytes, type: IS_POSTGRES ? "postgres" : "sqlite" }, "Backup completed");
  return { filename: result.filename, sizeBytes: result.sizeBytes };
}

async function getBackupHistory() {
  return prisma.backupRecord.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
}

function getBackupPath(filename) {
  return path.join(BACKUP_DIR, filename);
}

module.exports = { runBackup, getBackupHistory, getBackupPath, BACKUP_DIR };
