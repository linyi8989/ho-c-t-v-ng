import type { SQLiteSynchronousGateway } from '../../lib/storage/storageTypes';
export function migrateSpeakingSchema(db: SQLiteSynchronousGateway) {
  db.run(`CREATE TABLE IF NOT EXISTS speaking_lessons (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,status TEXT NOT NULL,grade INTEGER NOT NULL,kind TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS speaking_versions (id TEXT PRIMARY KEY,lesson_id TEXT NOT NULL,revision INTEGER NOT NULL,created_at TEXT NOT NULL,data_json TEXT NOT NULL,UNIQUE(lesson_id,revision))`);
  db.run(`CREATE TABLE IF NOT EXISTS speaking_attempts (id TEXT PRIMARY KEY,owner_key TEXT NOT NULL,lesson_id TEXT NOT NULL,version_id TEXT NOT NULL,client_run_id TEXT NOT NULL,status TEXT NOT NULL,student_name TEXT NOT NULL,user_id TEXT,guest_id TEXT,class_id TEXT,class_name TEXT NOT NULL DEFAULT '',score REAL,created_at TEXT NOT NULL,completed_at TEXT,duration_seconds REAL,data_json TEXT NOT NULL,UNIQUE(owner_key,client_run_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS speaking_attempt_details (attempt_id TEXT PRIMARY KEY,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,data_json TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS speaking_jobs (id TEXT PRIMARY KEY,attempt_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,tries INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS speaking_sessions (id TEXT PRIMARY KEY,owner_key TEXT NOT NULL,lesson_id TEXT NOT NULL,version_id TEXT NOT NULL,client_run_id TEXT NOT NULL,status TEXT NOT NULL,student_name TEXT NOT NULL,user_id TEXT,guest_id TEXT,class_id TEXT,class_name TEXT NOT NULL DEFAULT '',score REAL,completed_count INTEGER NOT NULL DEFAULT 0,total_items INTEGER NOT NULL,created_at TEXT NOT NULL,completed_at TEXT,duration_seconds REAL,data_json TEXT NOT NULL,UNIQUE(owner_key,client_run_id))`);
  const columns = new Set(db.all<{ name: string }>('PRAGMA table_info(speaking_attempts)').map(row => row.name));
  if (!columns.has('session_id')) db.run('ALTER TABLE speaking_attempts ADD COLUMN session_id TEXT');
  if (!columns.has('item_id')) db.run('ALTER TABLE speaking_attempts ADD COLUMN item_id TEXT');
  db.run('CREATE INDEX IF NOT EXISTS idx_speaking_attempts_session ON speaking_attempts(session_id,item_id,created_at,id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_speaking_sessions_history ON speaking_sessions(owner_key,status,completed_at DESC,id)');
  db.run("INSERT OR IGNORE INTO migrations(id,applied_at) VALUES ('speaking-schema-v2-sets',?)", [new Date().toISOString()]);
  db.run('CREATE INDEX IF NOT EXISTS idx_speaking_lessons_owner ON speaking_lessons(owner_id,status,grade,kind)');
  db.run('CREATE INDEX IF NOT EXISTS idx_speaking_attempts_history ON speaking_attempts(owner_key,status,completed_at DESC,id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_speaking_attempts_lesson ON speaking_attempts(lesson_id,status,completed_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_speaking_jobs_pending ON speaking_jobs(status,lease_until,created_at)');
  db.run("INSERT OR IGNORE INTO migrations(id,applied_at) VALUES ('speaking-schema-v1',?)", [new Date().toISOString()]);
}
