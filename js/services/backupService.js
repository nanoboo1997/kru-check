/* ============================================================
 * Kru Check — backup / restore service
 * Export รวม: Classes, Students, Exams, Answer Keys, Results,
 * Review Queue — เป็นไฟล์ JSON ดาวน์โหลดลงเครื่อง
 * หมายเหตุ: ไม่ export secret ใด ๆ (ไม่มีรหัสผ่านใน data layer)
 * ============================================================ */

const BACKUP_VERSION = 1;

export class BackupService {
  constructor(repos) { this.repos = repos; }

  async exportBackup() {
    const [classes, students, exams, answerKeys, results, reviewQueue] = await Promise.all([
      this.repos.classes.list(),
      this.repos.students.list(),
      this.repos.exams.list(),
      this.repos.answerKeys.list(),
      this.repos.results.list(),
      this.repos.reviews.list(),
    ]);
    const payload = {
      app: 'kru-check',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: { classes, students, exams, answerKeys, results, reviewQueue },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kru-check-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return payload;
  }

  /** นำเข้าไฟล์ backup (JSON ที่ export จากแอปนี้) */
  async importBackup(file) {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (payload.app !== 'kru-check' || !payload.data) {
      throw new Error('ไฟล์นี้ไม่ใช่ข้อมูลสำรองของ Kru Check');
    }
    const { classes = [], students = [], exams = [], answerKeys = [], results = [], reviewQueue = [] } = payload.data;
    const putAll = async (repo, rows) => { for (const r of rows) await repo.save(r); };
    await putAll(this.repos.classes, classes);
    await putAll(this.repos.students, students);
    await putAll(this.repos.exams, exams);
    await putAll(this.repos.answerKeys, answerKeys);
    await putAll(this.repos.results, results);
    await putAll(this.repos.reviews, reviewQueue);
    return {
      classes: classes.length, students: students.length, exams: exams.length,
      results: results.length,
    };
  }
}
