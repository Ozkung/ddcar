# คู่มือติดตั้ง DDReport บน Windows

---

## สิ่งที่ต้องติดตั้งก่อน

| โปรแกรม | ดาวน์โหลด | หมายเหตุ |
|---|---|---|
| Docker Desktop | https://www.docker.com/products/docker-desktop/ | ต้องเปิด WSL 2 ด้วย |
| Git (ถ้ายังไม่มี) | https://git-scm.com/download/win | สำหรับ clone โปรเจกต์ |

> **WSL 2:** ระหว่างติดตั้ง Docker Desktop ให้เลือก "Use WSL 2 instead of Hyper-V" และรีสตาร์ทเครื่องหลังติดตั้งเสร็จ

---

## ขั้นตอนที่ 1 — คัดลอกโปรเจกต์

เปิด **Command Prompt** หรือ **PowerShell** แล้วรัน:

```bash
git clone <url-ของ-repo> ddcar
cd ddcar
```

หรือถ้าได้รับโฟลเดอร์มาแล้ว ให้เปิด Command Prompt แล้ว `cd` ไปยังโฟลเดอร์นั้น:

```bash
cd C:\path\to\ddcar
```

---

## ขั้นตอนที่ 2 — สร้างไฟล์ .env.production

สร้างไฟล์ชื่อ `.env.production` ในโฟลเดอร์ `ddcar` โดยมีเนื้อหาดังนี้:

```env
DATABASE_URL=postgresql://ddreport:ddreport1234@postgres:5432/ddreport
POSTGRES_USER=ddreport
POSTGRES_PASSWORD=ddreport1234
POSTGRES_DB=ddreport
NODE_ENV=production
```

> ⚠️ เปลี่ยน `ddreport1234` เป็นรหัสผ่านที่ต้องการ (ทั้งสองบรรทัดต้องตรงกัน)

---

## ขั้นตอนที่ 3 — Build และรันแอป

ใน Command Prompt หรือ PowerShell (ต้องอยู่ในโฟลเดอร์ `ddcar`):

```bash
docker compose --env-file .env.production up -d --build
```

รอสักครู่จนกว่า Docker จะ build เสร็จ (ครั้งแรกอาจใช้เวลา 3–5 นาที)

ตรวจสอบว่า containers ทำงานปกติ:

```bash
docker compose ps
```

ควรเห็น 3 services ที่มีสถานะ `Up`:

```
NAME               STATUS
ddcar-app-1        Up
ddcar-nginx-1      Up
ddcar-postgres-1   Up (healthy)
```

---

## ขั้นตอนที่ 4 — ตั้งค่า hosts file

> **จุดประสงค์:** ให้เบราว์เซอร์รู้ว่า `ddreport.local` คือเครื่องของเราเอง

### วิธีแก้ไข hosts file บน Windows

1. กด **Start** แล้วค้นหา `Notepad`
2. คลิกขวาที่ **Notepad** แล้วเลือก **"Run as administrator"**
3. ใน Notepad ไปที่ **File → Open**
4. วางที่อยู่ไฟล์นี้ในช่อง filename:
   ```
   C:\Windows\System32\drivers\etc\hosts
   ```
5. เปลี่ยน dropdown จาก `Text Documents (*.txt)` เป็น **`All Files (*.*)`** แล้วคลิก **Open**
6. เลื่อนไปท้ายไฟล์ แล้วเพิ่มบรรทัดนี้:
   ```
   127.0.0.1   ddreport.local
   ```
7. บันทึกไฟล์ (**Ctrl + S**)

### ทางเลือก — ใช้ PowerShell (Admin)

1. กด **Start** → ค้นหา `PowerShell`
2. คลิกขวา → **"Run as Administrator"**
3. รันคำสั่ง:
   ```powershell
   Add-Content -Path "C:\Windows\System32\drivers\etc\hosts" -Value "127.0.0.1   ddreport.local"
   ```

---

## ขั้นตอนที่ 5 — เปิดแอป

เปิดเบราว์เซอร์แล้วไปที่:

```
http://ddreport.local
```

| หน้า | URL |
|---|---|
| ฟอร์มรับรถ | http://ddreport.local |
| รายงานงานซ่อม | http://ddreport.local/report |

---

## คำสั่งที่ใช้บ่อย

```bash
# เริ่มต้น containers (หลังจากปิดเครื่องหรือ restart Docker)
docker compose up -d

# หยุด containers
docker compose down

# ดู logs
docker compose logs -f app

# Rebuild หลังจากมีการอัปเดตโค้ด
docker compose up -d --build
```

---

## การแก้ปัญหาเบื้องต้น

| ปัญหา | วิธีแก้ |
|---|---|
| เปิด Docker Desktop แล้วขึ้น "WSL 2 installation is incomplete" | ดาวน์โหลด WSL 2 kernel update: https://aka.ms/wsl2kernel |
| `docker compose` ไม่รู้จักคำสั่ง | ใช้ `docker-compose` (มี `-`) แทน หรืออัปเดต Docker Desktop |
| `http://ddreport.local` ไม่โหลด | ตรวจสอบว่าบันทึก hosts file ด้วยสิทธิ์ Administrator แล้ว, ลอง flush DNS: `ipconfig /flushdns` |
| Containers ไม่ขึ้น | รัน `docker compose logs` เพื่อดู error |
| Port 80 ถูกใช้งานอยู่ | ปิดโปรแกรมที่ใช้ port 80 (เช่น IIS, XAMPP) ก่อนรัน |
