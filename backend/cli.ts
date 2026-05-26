import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'history.db');

if (!fs.existsSync(dbPath)) {
  console.error(`Error: Database not found at ${dbPath}`);
  console.log('Available files in data directory:', fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : 'Data directory not found');
  process.exit(1);
}

const db = new Database(dbPath);

const usage = `
Usage:
  node cli.js list                          - List all users
  node cli.js add <user> <pass> [--admin]   - Create a new user
  node cli.js delete <user>                 - Delete a user
  node cli.js reset-password <user> <pass>  - Reset a user's password
  node cli.js make-admin <user>             - Grant admin rights
`;

const args = process.argv.slice(2);
const command = args[0];

async function run() {
  switch (command) {
    case 'list': {
      const users = db.prepare('SELECT id, username, isAdmin, createdAt FROM users').all() as any[];
      console.log('ID | Username | Admin | Created At');
      console.log('-----------------------------------');
      users.forEach(u => {
        console.log(`${u.id} | ${u.username} | ${u.isAdmin ? 'Yes' : 'No'} | ${new Date(u.createdAt).toLocaleString()}`);
      });
      break;
    }

    case 'add': {
      const username = args[1]?.toLowerCase();
      const password = args[2];
      const isAdmin = args.includes('--admin') ? 1 : 0;

      if (!username || !password) {
        console.log('Error: Username and password required.');
        console.log(usage);
        process.exit(1);
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      try {
        db.prepare('INSERT INTO users (id, username, password, isAdmin, createdAt) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), username, passwordHash, isAdmin, Date.now());
        console.log(`User '${username}' created successfully.`);
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
      break;
    }

    case 'delete': {
      const username = args[1]?.toLowerCase();
      if (!username) {
        console.log('Error: Username required.');
        process.exit(1);
      }

      const info = db.prepare('DELETE FROM users WHERE username = ?').run(username);
      if (info.changes > 0) {
        console.log(`User '${username}' deleted.`);
      } else {
        console.log(`User '${username}' not found.`);
      }
      break;
    }

    case 'reset-password': {
      const username = args[1]?.toLowerCase();
      const password = args[2];
      if (!username || !password) {
        console.log('Error: Username and new password required.');
        process.exit(1);
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      const info = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(passwordHash, username);
      if (info.changes > 0) {
        console.log(`Password reset for user '${username}'.`);
      } else {
        console.log(`User '${username}' not found.`);
      }
      break;
    }

    case 'make-admin': {
      const username = args[1]?.toLowerCase();
      if (!username) {
        console.log('Error: Username required.');
        process.exit(1);
      }

      const info = db.prepare('UPDATE users SET isAdmin = 1 WHERE username = ?').run(username);
      if (info.changes > 0) {
        console.log(`User '${username}' is now an admin.`);
      } else {
        console.log(`User '${username}' not found.`);
      }
      break;
    }

    default:
      console.log(usage);
      break;
  }
}

run();
