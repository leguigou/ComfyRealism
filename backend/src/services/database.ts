import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'history.db'));
db.pragma('journal_mode = WAL');

export const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      title TEXT NOT NULL,
      updatedAt INTEGER NOT NULL,
      isArchived INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT,
      prompt TEXT,
      imageUrl TEXT,
      thumbnailUrl TEXT,
      timestamp INTEGER NOT NULL,
      model TEXT,
      width INTEGER,
      height INTEGER,
      steps INTEGER,
      cfg REAL,
      workflow TEXT,
      status TEXT DEFAULT 'completed',
      seed INTEGER,
      duration INTEGER,
      isFavorite INTEGER DEFAULT 0,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId TEXT NOT NULL,
      prompt TEXT NOT NULL,
      originalPrompt TEXT,
      sessionId TEXT NOT NULL,
      params TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
  `);

  // Migrations
  const columnsToCheck = ['model', 'width', 'height', 'steps', 'cfg', 'workflow', 'status', 'thumbnailUrl', 'seed', 'duration', 'isFavorite'];
  columnsToCheck.forEach(col => {
    try {
      db.prepare(`SELECT ${col} FROM messages LIMIT 1`).get();
    } catch (e) {
      let type = 'TEXT';
      if (col === 'cfg') type = 'REAL';
      else if (['width', 'height', 'steps', 'seed', 'duration', 'isFavorite'].includes(col)) type = 'INTEGER';
      db.exec(`ALTER TABLE messages ADD COLUMN ${col} ${type}`);
      console.log(`[Migration] Added column ${col} to messages table`);
    }
  });

  try {
    db.prepare('SELECT userId FROM sessions LIMIT 1').get();
  } catch (e) {
    db.exec('ALTER TABLE sessions ADD COLUMN userId TEXT');
    console.log('[Migration] Added userId column to sessions table');
  }

  // Default Admin
  const APP_PASSWORD = process.env.APP_PASSWORD || 'comfy';
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;

  if (userCount.count === 0) {
    console.log('[Migration] Creating default admin user...');
    const adminId = uuidv4();
    const passwordHash = bcrypt.hashSync(APP_PASSWORD.trim(), 10);
    db.prepare('INSERT INTO users (id, username, password, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(adminId, 'admin', passwordHash, 1, Date.now());
    
    db.prepare('UPDATE sessions SET userId = ? WHERE userId IS NULL').run(adminId);
    console.log('[Migration] Default admin user created and sessions migrated.');
  }
};

export default db;
