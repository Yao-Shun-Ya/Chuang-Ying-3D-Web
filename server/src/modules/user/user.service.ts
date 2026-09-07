import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface User {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: 'student' | 'admin';
  real_name: string | null;
  student_no: string | null;
  avatar: string | null;
  display_name: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class UserService {
  constructor(private db: DatabaseService) {}

  findByUsername(username: string): User | undefined {
    return this.db.get<User>('SELECT * FROM users WHERE username = ?', [username]);
  }

  findByEmail(email: string): User | undefined {
    return this.db.get<User>('SELECT * FROM users WHERE email = ?', [email]);
  }

  findById(id: number): User | undefined {
    return this.db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  create(data: {
    username: string;
    email: string;
    passwordHash: string;
    role?: 'student' | 'admin';
    realName?: string;
    studentNo?: string;
  }): User {
    const stmt = this.db.prepare(
      `INSERT INTO users (username, email, password_hash, role, real_name, student_no)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      data.username,
      data.email,
      data.passwordHash,
      data.role || 'student',
      data.realName || null,
      data.studentNo || null,
    );
    return this.findById(Number(result.lastInsertRowid));
  }

  updateProfile(
    id: number,
    data: { realName?: string; studentNo?: string; displayName?: string; avatar?: string },
  ) {
    this.db.prepare(
      `UPDATE users SET real_name = COALESCE(?, real_name),
                        student_no = COALESCE(?, student_no),
                        display_name = COALESCE(?, display_name),
                        avatar = COALESCE(?, avatar),
                        updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(
      data.realName ?? null,
      data.studentNo ?? null,
      data.displayName ?? null,
      data.avatar ?? null,
      id,
    );
    return this.findById(id);
  }

  updatePassword(id: number, passwordHash: string) {
    this.db
      .prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(passwordHash, id);
  }

  updateEmail(id: number, email: string) {
    this.db
      .prepare('UPDATE users SET email = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')
      .run(email, id);
  }

  /** 更新余额（原子操作，由调用方在事务外/内使用） */
  updateBalance(id: number, newBalance: number) {
    this.db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, id);
  }

  listAll() {
    return this.db.all<User>(
      'SELECT id, username, email, role, real_name, student_no, display_name, avatar, balance, created_at FROM users WHERE role != \'admin\' ORDER BY id DESC',
    );
  }
}
