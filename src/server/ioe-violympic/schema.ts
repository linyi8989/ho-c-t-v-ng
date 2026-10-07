import type { SQLiteSynchronousGateway } from '../../lib/storage/storageTypes';

export function migrateCompetitionSchema(db: SQLiteSynchronousGateway) {
  db.run(`CREATE TABLE IF NOT EXISTS competition_questions (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, subject TEXT NOT NULL, grade INTEGER NOT NULL,
    level TEXT NOT NULL, revision INTEGER NOT NULL, fingerprint TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_question_versions (
    id TEXT PRIMARY KEY, question_id TEXT NOT NULL, revision INTEGER NOT NULL, created_at TEXT NOT NULL, data_json TEXT NOT NULL,
    UNIQUE(question_id, revision))`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_papers (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, subject TEXT NOT NULL, grade INTEGER NOT NULL, level TEXT NOT NULL,
    status TEXT NOT NULL, visibility TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_paper_versions (
    id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, created_at TEXT NOT NULL, data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_imports (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload_hash TEXT NOT NULL, created_at TEXT NOT NULL, data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_asset_usages (
    id TEXT PRIMARY KEY, asset_id TEXT, url TEXT NOT NULL, resource_id TEXT NOT NULL, resource_type TEXT NOT NULL,
    created_at TEXT NOT NULL, data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_attempts (
    id TEXT PRIMARY KEY, owner_key TEXT NOT NULL, paper_id TEXT NOT NULL, version_id TEXT NOT NULL, client_run_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('prepared','active','completed')), revision INTEGER NOT NULL,
    student_name TEXT NOT NULL, user_id TEXT, guest_id TEXT, class_id TEXT, assignment_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, started_at TEXT, deadline TEXT, completed_at TEXT,
    score REAL NOT NULL DEFAULT 0, raw_score REAL NOT NULL DEFAULT 0, max_score REAL NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0, incorrect_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0, data_json TEXT NOT NULL,
    UNIQUE(owner_key, client_run_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS competition_attempt_details (
    attempt_id TEXT PRIMARY KEY REFERENCES competition_attempts(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL)`);
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_questions_scope ON competition_questions(owner_id, subject, grade, level, archived)');
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_questions_fingerprint ON competition_questions(fingerprint, archived)');
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_papers_owner ON competition_papers(owner_id, status, created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_attempts_history ON competition_attempts(owner_key, completed_at DESC, id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_attempts_expiry ON competition_attempts(status, deadline)');
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_attempts_paper ON competition_attempts(paper_id, status, completed_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_competition_asset_usages_asset ON competition_asset_usages(asset_id)');
  db.run("INSERT OR IGNORE INTO migrations(id, applied_at) VALUES ('competition-schema-v1', ?)", [new Date().toISOString()]);
}
