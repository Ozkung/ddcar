# คู่มือตั้งค่า Router — ให้ทุกอุปกรณ์ใน LAN เข้า ddreport.local

## ภาพรวม

เป้าหมาย: ให้ Router บอก DNS ว่า `ddreport.local` ชี้ไปที่ IP เครื่องที่รัน DDReport เช่น `192.168.1.48`  
เมื่อตั้งค่าแล้ว ทุกอุปกรณ์ใน Wi-Fi เดียวกันพิมพ์ `https://ddreport.local` ได้เลยโดยไม่ต้องแก้ hosts file

---

## ลำดับขั้นตอน

```
1. ตรวจสอบ IP และ MAC address ของเครื่อง DDReport
         ↓
2. จอง IP (DHCP Reservation) ใน Router — ให้ IP ไม่เปลี่ยน
         ↓
3. ตั้งค่า Local DNS ใน Router — ddreport.local → IP ที่จอง
         ↓
4. สร้าง TLS cert (ถ้ายังไม่มี): sh scripts/generate-certs.sh
         ↓
5. ติดตั้ง CA cert ในแต่ละอุปกรณ์
         ↓
6. เปิด https://ddreport.local ✅
```

---

## ข้อมูลที่ต้องใช้

| รายการ | วิธีหา | ตัวอย่าง |
|---|---|---|
| IP เครื่อง DDReport | Mac: `ipconfig getifaddr en0` · Windows: `ipconfig` | `192.168.1.48` |
| MAC address เครื่อง DDReport | Mac: `ifconfig en0 \| grep ether` · Windows: `ipconfig /all` | `f6:83:29:bb:54:f0` |
| IP ของ Router | Mac: `netstat -rn \| grep default` · Windows: `ipconfig` ดู Default Gateway | `192.168.1.1` |

---

## ขั้นตอนที่ 1 — จอง IP ให้เครื่อง DDReport (DHCP Reservation)

> **ทำไมต้องจอง IP?**  
> ปกติ Router แจก IP ชั่วคราว (DHCP) — ถ้าเครื่อง DDReport รีสตาร์ทอาจได้ IP ใหม่  
> ทำให้ cert และ DNS ที่ตั้งไว้ชี้ผิดเครื่อง  
> การจอง IP ทำให้เครื่อง DDReport ได้ IP เดิมทุกครั้ง

---

### TP-Link (Archer / TL series) — จอง IP

1. เปิดเบราว์เซอร์ → `http://192.168.1.1` หรือ `http://tplinkwifi.net`
2. Login (default: `admin` / `admin`)
3. ไปที่ **Advanced** → **Network** → **DHCP Server**
4. เลื่อนลงหา **Address Reservation** → คลิก **Add**
5. กรอก:
   - **MAC Address**: `f6:83:29:bb:54:f0` *(MAC เครื่อง DDReport)*
   - **Reserved IP**: `192.168.1.48`
   - **Description**: `DDReport Server`
6. คลิก **Save** → รีสตาร์ทเครื่อง DDReport 1 ครั้ง

---

### ASUS (RT series) — จอง IP

1. เปิด `http://192.168.1.1` หรือ `http://router.asus.com`
2. **LAN** → **DHCP Server**
3. เลื่อนลงหา **Manually Assigned IP around DHCP list** → คลิก **+**
4. กรอก:
   - **MAC Address**: `f6:83:29:bb:54:f0`
   - **IP Address**: `192.168.1.48`
   - **Hostname**: `ddreport`
5. คลิก **Add** → **Apply**

---

### MikroTik (RouterOS) — จอง IP

**Winbox / Web UI:**
1. **IP** → **DHCP Server** → แท็บ **Leases**
2. หา MAC `f6:83:29:bb:54:f0` ในรายการ → คลิกขวา → **Make Static**
3. ดับเบิลคลิก entry → ตั้ง **Address**: `192.168.1.48` → **OK**

**CLI:**
```
/ip dhcp-server lease add \
  address=192.168.1.48 \
  mac-address=f6:83:29:bb:54:f0 \
  comment="DDReport Server"
```

---

### OpenWrt / LEDE — จอง IP

**LuCI:**
1. **Network** → **DHCP and DNS** → แท็บ **Static Leases** → **Add**
2. กรอก:
   - **MAC Address**: `f6:83:29:bb:54:f0`
   - **IPv4 Address**: `192.168.1.48`
   - **Hostname**: `ddreport`
3. **Save & Apply**

**SSH:**
```sh
uci add dhcp host
uci set dhcp.@host[-1].mac='f6:83:29:bb:54:f0'
uci set dhcp.@host[-1].ip='192.168.1.48'
uci set dhcp.@host[-1].name='ddreport'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

---

### pfSense / OPNsense — จอง IP

1. **Services** → **DHCP Server** → เลือก interface (LAN)
2. เลื่อนลงหา **DHCP Static Mappings** → **Add**
3. กรอก:
   - **MAC Address**: `f6:83:29:bb:54:f0`
   - **IP Address**: `192.168.1.48`
   - **Hostname**: `ddreport`
4. **Save** → **Apply Changes**

---

### AIS Fiber / True Online / DTAC (ONU จาก ISP) — จอง IP

Router จาก ISP บางรุ่นรองรับ DHCP Reservation บางรุ่นไม่รองรับ

**ตรวจสอบ:**
1. Login Router (มักใช้ `http://192.168.1.1` หรือ `http://192.168.100.1`)
2. หาเมนู **LAN** → **DHCP** → **Static/Reserved IP** หรือ **Address Binding**
3. ถ้าไม่มีเมนูนี้ → ใช้ **วิธีตั้ง Static IP บนเครื่อง DDReport** ด้านล่างแทน

---

### 🖥️ ทางเลือก — ตั้ง Static IP บนเครื่อง DDReport โดยตรง

ถ้า Router ไม่รองรับ DHCP Reservation ให้ตั้ง IP ถาวรที่เครื่องเลย

#### Mac (macOS)
1. **System Settings** → **Network** → เลือก Wi-Fi หรือ Ethernet → **Details...**
2. แท็บ **TCP/IP** → **Configure IPv4**: เปลี่ยนจาก `Using DHCP` เป็น **Manually**
3. กรอก:
   - **IP Address**: `192.168.1.48`
   - **Subnet Mask**: `255.255.255.0`
   - **Router**: `192.168.1.1`
   - **DNS**: `192.168.1.1` (หรือ `8.8.8.8`)
4. คลิก **OK** → **Apply**

#### Windows
1. **Settings** → **Network & Internet** → **Wi-Fi** (หรือ Ethernet) → **Hardware properties**
2. **IP Assignment** → **Edit** → เปลี่ยนเป็น **Manual** → เปิด **IPv4**
3. กรอก:
   - **IP address**: `192.168.1.48`
   - **Subnet mask**: `255.255.255.0` (หรือ prefix `24`)
   - **Gateway**: `192.168.1.1`
   - **DNS**: `192.168.1.1`
4. คลิก **Save**

> ⚠️ ควรเลือก IP ที่อยู่**นอกช่วง DHCP** ของ Router เช่น ถ้า Router แจก `192.168.1.100–200` ให้เลือก `192.168.1.48` ซึ่งอยู่นอกช่วง จะไม่ชนกัน

---

## ขั้นตอนที่ 2 — ตั้งค่า Local DNS ใน Router

### TP-Link (Archer / TL series)

> ⚠️ TP-Link consumer รุ่นทั่วไป **ไม่มี local DNS** → ใช้ **Pi-hole** ด้านล่างแทน  
> TP-Link รุ่น Business (EAP/Omada) รองรับ

---

### ASUS (RT series)

1. **LAN** → **DNS Director** (หรือ **Adaptive DNS**)
2. เพิ่ม:
   - Domain: `ddreport.local`
   - IP: `192.168.1.48`
3. **Apply**

---

### MikroTik (RouterOS)

1. **IP** → **DNS** → **Static** → **Add New**:
   - **Name**: `ddreport.local`
   - **Address**: `192.168.1.48`
   - **TTL**: `1d`
2. ตรวจสอบ **Allow Remote Requests** ✅

```
/ip dns static add name=ddreport.local address=192.168.1.48
```

---

### OpenWrt / LEDE

**LuCI:** Services → DHCP and DNS → **Hostnames** → เพิ่ม `ddreport.local` → `192.168.1.48`

**SSH:**
```sh
uci add_list dhcp.@dnsmasq[0].address='/ddreport.local/192.168.1.48'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

---

### pfSense / OPNsense

**Services** → **DNS Resolver** → **Host Overrides** → **Add**:
- Host: `ddreport` · Domain: `local` · IP: `192.168.1.48`

---

### AIS Fiber / True Online / DTAC (ONU จาก ISP)

Router จาก ISP **ไม่รองรับ local DNS** → ใช้ **Pi-hole** ด้านล่าง

---

## ✅ วิธีแนะนำ — Pi-hole (ใช้ได้กับ Router ทุกยี่ห้อ)

Pi-hole เป็น DNS server ที่รันบนเครื่องใน LAN — แก้ปัญหา Router ที่ไม่รองรับ local DNS

### ติดตั้ง Pi-hole บน Docker (เครื่องเดียวกับ DDReport)

เพิ่มใน `docker-compose.yml`:

```yaml
  pihole:
    image: pihole/pihole:latest
    restart: unless-stopped
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "8080:80"
    environment:
      TZ: 'Asia/Bangkok'
      WEBPASSWORD: 'your-pihole-password'
    volumes:
      - pihole_data:/etc/pihole
      - pihole_dnsmasq:/etc/dnsmasq.d
    cap_add:
      - NET_ADMIN
```

เพิ่ม volumes:
```yaml
volumes:
  pihole_data:
  pihole_dnsmasq:
```

### ตั้งค่า Local DNS ใน Pi-hole

1. เปิด `http://192.168.1.48:8080/admin`
2. **Local DNS** → **DNS Records** → **Add**:
   - Domain: `ddreport.local`
   - IP: `192.168.1.48`

### ตั้ง Router ให้ใช้ Pi-hole เป็น DNS

Router settings → DHCP → **DNS Server** → ใส่ `192.168.1.48`

---

## ขั้นตอนที่ 3 — ติดตั้ง CA cert ในแต่ละอุปกรณ์

ทำครั้งเดียวต่ออุปกรณ์ — ใช้ไฟล์ `nginx/certs/rootCA.pem`

### Mac
```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain nginx/certs/rootCA.pem
```

### Windows (PowerShell as Administrator)
```powershell
Import-Certificate -FilePath "nginx\certs\rootCA.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

### iOS (iPhone / iPad)
1. Host ไฟล์ชั่วคราว (รันบนเครื่อง DDReport):
   ```bash
   python3 -m http.server 8888 --directory nginx/certs
   ```
2. เปิด Safari บน iPhone → `http://192.168.1.48:8888/rootCA.pem`
3. ระบบถาม "ต้องการติดตั้ง profile?" → **Allow** → **Install**
4. **Settings** → **General** → **VPN & Device Management** → เลือก profile → **Install**
5. **Settings** → **General** → **About** → **Certificate Trust Settings**
6. เปิด toggle **DDReport Local CA** → **Continue**

### Android
1. ส่งไฟล์ `rootCA.pem` ไปที่เครื่อง (AirDrop / Google Drive / USB)
2. **Settings** → **Security** → **Install from storage** → **CA Certificate**  
   *(บางรุ่น: Biometrics and security → Other security settings)*
3. เลือกไฟล์ `rootCA.pem` → ตั้งชื่อ `DDReport CA` → **OK**

---

## ทดสอบ

หลังตั้งค่าครบแล้ว ทดสอบจากอุปกรณ์ใน LAN:

```
https://ddreport.local     ← ต้องโหลดได้ ไม่มีคำเตือน
https://192.168.1.48       ← ต้องโหลดได้ ไม่มีคำเตือน
```

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| "Your connection is not private" | CA cert ยังไม่ได้ติดตั้ง | ติดตั้ง rootCA.pem ซ้ำ |
| "This site can't be reached" | DNS ยังไม่ทำงาน | ตรวจสอบ Router DNS หรือ Pi-hole |
| IP เปลี่ยน cert ผิด | ไม่ได้จอง IP | ทำ DHCP Reservation หรือ Static IP |
