import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'mediaunboxed',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');
const MIGRATIONS_TABLE = 'migrations';

interface Migration {
  name: string;
  upPath: string;
  downPath: string;
}

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`,
  );
  return result.rows.map((row) => row.name);
}

function getMigrationFiles(): Migration[] {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  const migrations: Map<string, Migration> = new Map();

  for (const file of files) {
    const match = file.match(/^(\d+_.+)\.(up|down)\.sql$/);
    if (match) {
      const name = match[1];
      const direction = match[2];

      if (!migrations.has(name)) {
        migrations.set(name, {
          name,
          upPath: '',
          downPath: '',
        });
      }

      const migration = migrations.get(name)!;
      if (direction === 'up') {
        migration.upPath = path.join(MIGRATIONS_DIR, file);
      } else {
        migration.downPath = path.join(MIGRATIONS_DIR, file);
      }
    }
  }

  return Array.from(migrations.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

async function runMigration(
  migration: Migration,
  direction: 'up' | 'down',
): Promise<void> {
  const filePath = direction === 'up' ? migration.upPath : migration.downPath;

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(
      `Migration file not found: ${migration.name}.${direction}.sql`,
    );
  }

  const sql = fs.readFileSync(filePath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);

    if (direction === 'up') {
      await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [
        migration.name,
      ]);
    } else {
      await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [
        migration.name,
      ]);
    }

    await client.query('COMMIT');
    console.log(`✅ ${direction.toUpperCase()}: ${migration.name}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed: ${migration.name}`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function migrate(): Promise<void> {
  console.log('🚀 Running migrations...\n');

  await ensureMigrationsTable();
  const executedMigrations = await getExecutedMigrations();
  const allMigrations = getMigrationFiles();

  const pendingMigrations = allMigrations.filter(
    (m) => !executedMigrations.includes(m.name),
  );

  if (pendingMigrations.length === 0) {
    console.log('✅ No pending migrations\n');
    return;
  }

  console.log(`Found ${pendingMigrations.length} pending migration(s):\n`);

  for (const migration of pendingMigrations) {
    await runMigration(migration, 'up');
  }

  console.log('\n✅ All migrations completed\n');
}

async function rollback(steps: number = 1): Promise<void> {
  console.log(`🔄 Rolling back ${steps} migration(s)...\n`);

  await ensureMigrationsTable();
  const executedMigrations = await getExecutedMigrations();
  const allMigrations = getMigrationFiles();

  const toRollback = executedMigrations
    .slice(-steps)
    .reverse()
    .map((name) => allMigrations.find((m) => m.name === name)!)
    .filter(Boolean);

  if (toRollback.length === 0) {
    console.log('✅ Nothing to rollback\n');
    return;
  }

  for (const migration of toRollback) {
    await runMigration(migration, 'down');
  }

  console.log('\n✅ Rollback completed\n');
}

async function status(): Promise<void> {
  console.log('📊 Migration Status\n');

  await ensureMigrationsTable();
  const executedMigrations = await getExecutedMigrations();
  const allMigrations = getMigrationFiles();

  for (const migration of allMigrations) {
    const executed = executedMigrations.includes(migration.name);
    const status = executed ? '✅' : '⏳';
    console.log(`${status} ${migration.name}`);
  }

  console.log('');
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'migrate';
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'migrate':
      case 'up':
        await migrate();
        break;
      case 'rollback':
      case 'down':
        await rollback(arg ? parseInt(arg, 10) : 1);
        break;
      case 'status':
        await status();
        break;
      default:
        console.log(`
Usage:
  npx ts-node src/database/migration-runner.ts migrate   - Run all pending migrations
  npx ts-node src/database/migration-runner.ts rollback [n] - Rollback n migrations (default: 1)
  npx ts-node src/database/migration-runner.ts status    - Show migration status
        `);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
