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

  async findByUsername(username: string): Promise<User | undefined> {
    return this.db.get<User>('SELECT * FROM users WHERE username = ?', [username]);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.db.get<User>('SELECT * FROM users WHERE email = ?', [email]);
  }

  async findById(id: number): Promise<User | undefined> {
    return this.db.get<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    role?: 'student' | 'admin';
    realName?: string;
    studentNo?: string;
  }): Promise<User> {
    const result = await this.db.run(
      `INSERT INTO users (username, email, password_hash, role, real_name, student_no)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        data.username,
        data.email,
        data.passwordHash,
        data.role || 'student',
        data.realName || null,
        data.studentNo || null,
      ],
    );
    return (await this.findById(Number(result.lastInsertRowid)))!;
  }

  async updateProfile(
    id: number,
    data: { realName?: string; studentNo?: string; displayName?: string; avatar?: string },
  ) {
    await this.db.run(
      `UPDATE users SET real_name = COALESCE(?, real_name),
                        student_no = COALESCE(?, student_no),
                        display_name = COALESCE(?, display_name),
                        avatar = COALESCE(?, avatar),
                        updated_at = datetime('now','localtime')
       WHERE id = ?`,
      [
        data.realName ?? null,
        data.studentNo ?? null,
        data.displayName ?? null,
        data.avatar ?? null,
        id,
      ],
    );
    return this.findById(id);
  }

  async updatePassword(id: number, passwordHash: string) {
    await this.db.run(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [passwordHash, id],
    );
  }

  async updateEmail(id: number, email: string) {
    await this.db.run(
      "UPDATE users SET email = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [email, id],
    );
  }

  /** 更新余额（原子操作，由调用方在事务外/内使用） */
  async updateBalance(id: number, newBalance: number) {
    await this.db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, id]);
  }

  async listAll() {
    return this.db.all<User>(
      "SELECT id, username, email, role, real_name, student_no, display_name, avatar, balance, created_at FROM users WHERE role != 'admin' ORDER BY id DESC",
    );
  }
}
