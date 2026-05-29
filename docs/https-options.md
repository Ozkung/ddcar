# คู่มือ HTTPS — 3 วิธี

เลือกวิธีที่เหมาะกับการใช้งาน:

| | วิธีที่ 1: HTTP | วิธีที่ 2: Domain จริง + Let's Encrypt | วิธีที่ 3: CA cert (mkcert) |
|---|---|---|---|
| ค่าใช้จ่าย | ฟรี | ~150 บาท/ปี | ฟรี |
| คำเตือนเบราว์เซอร์ | ไม่มี | ไม่มี | ไม่มี |
| ติดตั้งใน device | ไม่ต้อง | ไม่ต้อง | ทุก device (ครั้งเดียว) |
| iOS Chrome | ✅ | ✅ | ✅ |
| Encryption | ❌ | ✅ | ✅ |
| เหมาะกับ | LAN ปิด staff เท่านั้น | ต้องการ HTTPS เต็มรูปแบบ | ยอมติดตั้งครั้งเดียว |

---

## วิธีที่ 1 — HTTP เพียงอย่างเดียว

ไม่มี HTTPS ไม่ต้องติดตั้งอะไร เข้าได้ทุกอุปกรณ์ทันที

### แก้ไข nginx.conf

แก้ไฟล์ `nginx/nginx.conf` เป็นดังนี้:

```nginx
server {
    listen 80;
    server_name ddreport.local;

    client_max_body_size 55M;

    location / {
        proxy_pass         http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### แก้ไข docker-compose.yml

เปลี่ยน nginx ports ให้เหลือแค่ port 80:

```yaml
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app
```

### Apply

```bash
docker compose up -d --force-recreate nginx
```

### เข้าใช้งาน

```
http://ddreport.local
http://192.168.1.48
```

---

## วิธีที่ 2 — Domain จริง + Let's Encrypt (แนะนำ)

cert จาก Let's Encrypt เบราว์เซอร์ทุกตัวเชื่อถืออยู่แล้ว ไม่ต้องติดตั้งอะไรในอุปกรณ์

### ภาพรวม

```
ซื้อ domain → ตั้ง Cloudflare DNS → ขอ cert (DNS challenge) → nginx ใช้ cert → Router DNS ชี้ domain → LAN IP
```

> **DNS challenge คืออะไร?**  
> Let's Encrypt ยืนยันความเป็นเจ้าของ domain ผ่าน DNS record (TXT) แทนการเปิด port 80  
> เซิร์ฟเวอร์ **ไม่ต้องเปิดสู่ internet** เลย

---

### ขั้นตอนที่ 2.1 — ซื้อ domain

แนะนำใช้ **Cloudflare Registrar** (ราคาถูกที่สุด ไม่มีค่า markup)

1. สมัคร [cloudflare.com](https://cloudflare.com) (ฟรี)
2. ไปที่ **Domain Registration** → ค้นหา domain เช่น `ddreport.shop` (~150 บาท/ปี)
3. ซื้อและรอ active (~5 นาที)

> ซื้อที่อื่นก็ได้ (Namecheap, GoDaddy) แต่ต้อง **ย้าย DNS มาที่ Cloudflare** เพื่อใช้ DNS challenge

---

### ขั้นตอนที่ 2.2 — สร้าง Cloudflare API Token

1. Cloudflare Dashboard → **My Profile** → **API Tokens** → **Create Token**
2. เลือก template **Edit zone DNS**
3. **Zone Resources**: เลือก domain ที่ซื้อ
4. **Create Token** → คัดลอก token เก็บไว้

---

### ขั้นตอนที่ 2.3 — ขอ cert ด้วย acme.sh ใน Docker

แทนที่ `YOUR_DOMAIN` และ `YOUR_CF_TOKEN` ด้วยค่าของคุณ:

```bash
# สร้างโฟลเดอร์เก็บ cert
mkdir -p nginx/certs/letsencrypt

# ขอ cert ผ่าน Cloudflare DNS challenge
docker run --rm \
  -v "$(pwd)/nginx/certs/letsencrypt:/acme.sh" \
  -e CF_Token="YOUR_CF_TOKEN" \
  neilpang/acme.sh --issue \
  --dns dns_cf \
  -d YOUR_DOMAIN \
  --server letsencrypt

# ติดตั้ง cert ไปยัง nginx/certs
docker run --rm \
  -v "$(pwd)/nginx/certs/letsencrypt:/acme.sh" \
  -v "$(pwd)/nginx/certs:/certs" \
  neilpang/acme.sh --install-cert \
  -d YOUR_DOMAIN \
  --cert-file   /certs/ddreport.local.crt \
  --key-file    /certs/ddreport.local.key \
  --fullchain-file /certs/ddreport.local.crt
```

ตัวอย่างเช่น domain = `ddreport.shop`:

```bash
docker run --rm \
  -v "$(pwd)/nginx/certs/letsencrypt:/acme.sh" \
  -e CF_Token="abc123xyz..." \
  neilpang/acme.sh --issue \
  --dns dns_cf \
  -d ddreport.shop \
  --server letsencrypt
```

---

### ขั้นตอนที่ 2.4 — แก้ไข nginx.conf

แก้ `server_name` ให้ใช้ domain จริง:

```nginx
server {
    listen 80;
    server_name ddreport.shop;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name ddreport.shop;

    ssl_certificate     /etc/nginx/certs/ddreport.local.crt;
    ssl_certificate_key /etc/nginx/certs/ddreport.local.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 55M;

    location / {
        proxy_pass         http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### ขั้นตอนที่ 2.5 — ตั้ง Local DNS ใน Router

ให้ Router ชี้ domain → IP เครื่องใน LAN (ไม่ใช่ internet)

ตัวอย่าง: `ddreport.shop` → `192.168.1.48`

ดูวิธีแต่ละ Router ได้ที่ [router-setup.md](router-setup.md#ขั้นตอนที่-2--ตั้งค่า-local-dns-ใน-router)

---

### ขั้นตอนที่ 2.6 — ตั้ง Auto-renewal (ทุก 60 วัน)

cert Let's Encrypt หมดอายุทุก 90 วัน — ตั้ง cron renew อัตโนมัติ:

```bash
# เปิด crontab
crontab -e

# เพิ่มบรรทัดนี้ (รันทุกวันที่ 1 ตี 3)
0 3 1 * * cd /path/to/ddcar && sh scripts/renew-cert.sh >> /tmp/acme-renew.log 2>&1
```

สร้างไฟล์ `scripts/renew-cert.sh`:

```bash
#!/bin/sh
set -e
DOMAIN="ddreport.shop"
CF_TOKEN="YOUR_CF_TOKEN"

echo "$(date): Renewing cert for $DOMAIN..."

docker run --rm \
  -v "$(pwd)/nginx/certs/letsencrypt:/acme.sh" \
  -e CF_Token="$CF_TOKEN" \
  neilpang/acme.sh --renew \
  -d $DOMAIN \
  --server letsencrypt

docker run --rm \
  -v "$(pwd)/nginx/certs/letsencrypt:/acme.sh" \
  -v "$(pwd)/nginx/certs:/certs" \
  neilpang/acme.sh --install-cert \
  -d $DOMAIN \
  --cert-file   /certs/ddreport.local.crt \
  --key-file    /certs/ddreport.local.key \
  --fullchain-file /certs/ddreport.local.crt

docker compose exec nginx nginx -s reload
echo "$(date): Done!"
```

---

### Apply

```bash
docker compose up -d --force-recreate nginx
```

### เข้าใช้งาน

```
https://ddreport.shop     ← ทุกอุปกรณ์ใน LAN เข้าได้ ไม่มีคำเตือน
```

---

## วิธีที่ 3 — CA cert (mkcert)

สร้าง cert ด้วย mkcert ใน Docker แล้วติดตั้ง CA cert ในแต่ละอุปกรณ์ **ครั้งเดียว**

### ขั้นตอนที่ 3.1 — สร้าง cert

```bash
sh scripts/generate-certs.sh
```

cert จะครอบคลุมทั้ง `ddreport.local` และ IP ของเครื่อง (`192.168.1.48`)

---

### ขั้นตอนที่ 3.2 — ติดตั้ง CA cert ในแต่ละอุปกรณ์ (ครั้งเดียว)

ไฟล์ที่ต้องใช้: `nginx/certs/rootCA.pem`

#### Mac

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain nginx/certs/rootCA.pem
```

#### Windows (PowerShell as Administrator)

```powershell
Import-Certificate -FilePath "nginx\certs\rootCA.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

#### iOS (iPhone / iPad)

1. Host ไฟล์ชั่วคราวบนเครื่อง DDReport:
   ```bash
   python3 -m http.server 8888 --directory nginx/certs
   ```
2. เปิด **Safari** บน iPhone → `http://192.168.1.48:8888/rootCA.pem`
3. ระบบถาม "ต้องการติดตั้ง profile?" → **Allow** → **Install**
4. **Settings** → **General** → **VPN & Device Management** → profile → **Install**
5. **Settings** → **General** → **About** → **Certificate Trust Settings**
6. เปิด toggle **DDReport Local CA** → **Continue**

#### Android

1. ส่งไฟล์ `rootCA.pem` ไปที่เครื่อง (Google Drive / USB / AirDrop)
2. **Settings** → **Security** → **Install from storage** → **CA Certificate**
3. เลือกไฟล์ → ตั้งชื่อ `DDReport CA` → **OK**

---

### ขั้นตอนที่ 3.3 — nginx.conf (ใช้ได้เลยถ้า HTTPS ตั้งไว้แล้ว)

ไฟล์ `nginx/nginx.conf` ปัจจุบันรองรับอยู่แล้ว ไม่ต้องแก้

---

### Apply

```bash
docker compose up -d --force-recreate nginx
```

### เข้าใช้งาน

```
https://ddreport.local    ← หลังติดตั้ง CA cert แล้ว ไม่มีคำเตือน
https://192.168.1.48      ← เช่นกัน
```

---

## สรุปการเลือกวิธี

```
ใช้งานใน LAN ปิด staff เท่านั้น?
  └─ ใช่ → วิธีที่ 1 (HTTP) — ง่ายสุด ไม่มีปัญหา

มีงบ ~150 บาท/ปี และต้องการ HTTPS สมบูรณ์?
  └─ ใช่ → วิธีที่ 2 (Let's Encrypt) — ดีที่สุดในระยะยาว

ไม่มีงบ แต่ยอมติดตั้ง cert ในแต่ละเครื่อง?
  └─ ใช่ → วิธีที่ 3 (mkcert CA cert)
```
