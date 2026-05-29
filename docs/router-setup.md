# คู่มือตั้งค่า Router — ให้ทุกอุปกรณ์ใน LAN เข้า ddreport.local

## ภาพรวม

เป้าหมาย: ให้ Router บอก DNS ว่า `ddreport.local` ชี้ไปที่ IP เครื่องที่รัน DDReport เช่น `192.168.1.48`  
เมื่อตั้งค่าแล้ว ทุกอุปกรณ์ใน Wi-Fi เดียวกันพิมพ์ `https://ddreport.local` ได้เลยโดยไม่ต้องแก้ hosts file

---

## ข้อมูลที่ต้องใช้

| รายการ | ตัวอย่าง |
|---|---|
| IP เครื่องที่รัน DDReport | `192.168.1.48` |
| Domain | `ddreport.local` |
| IP ของ Router (gateway) | `192.168.1.1` (ตรวจสอบด้วย `ipconfig` / `ip route`) |

---

## Router แต่ละยี่ห้อ

---

### TP-Link (Archer / TL series)

1. เปิดเบราว์เซอร์ → `http://192.168.1.1` หรือ `http://tplinkwifi.net`
2. Login (default: admin / admin)
3. ไปที่ **Advanced** → **Network** → **DHCP Server** → **Address Reservation**  
   (ทำให้ IP เครื่อง DDReport ไม่เปลี่ยน)
4. ไปที่ **Advanced** → **Network** → **DNS** → **Custom DNS** หรือ  
   **Advanced** → **Wireless** → **DNS**
   
   > ⚠️ TP-Link consumer รุ่นทั่วไป **ไม่มี local DNS** ใช้ **Dnsmasq workaround** ด้านล่างแทน

---

### ASUS (RT series)

1. เปิด `http://192.168.1.1` หรือ `http://router.asus.com`
2. Login → **LAN** → **DHCP Server** → เลื่อนลงหา **Manually Assigned IP around DHCP list**  
   — จองให้ `192.168.1.48` กับ MAC address เครื่อง DDReport
3. ไปที่ **LAN** → **DNS Director** หรือ **Adaptive DNS**  
   — ใส่ `ddreport.local` → `192.168.1.48`

   หาก Router ไม่มี DNS Director ให้ใช้ **Custom DHCP** option:
   - **LAN** → **DHCP Server** → **Custom DHCP list**
   - เพิ่ม: `6,192.168.1.48` (force DNS to DDReport server — ใช้ Pi-hole หรือ dnsmasq แทนดีกว่า)

---

### MikroTik (RouterOS)

1. เปิด **Winbox** หรือ `http://192.168.88.1`
2. ไปที่ **IP** → **DNS**
3. คลิก **Static** → **Add New**:
   - **Name**: `ddreport.local`
   - **Address**: `192.168.1.48`
   - **TTL**: `1d`
4. คลิก **Apply** → **OK**
5. ตรวจสอบ: **Allow Remote Requests** ✅ ต้องเปิด

```
# หรือใช้ CLI:
/ip dns static add name=ddreport.local address=192.168.1.48
```

---

### OpenWrt / LEDE

1. **LuCI**: Services → DHCP and DNS → **Hostnames** → เพิ่ม:
   - Hostname: `ddreport.local`
   - IP Address: `192.168.1.48`
2. บันทึก → Apply

   หรือ SSH แล้วรัน:
   ```sh
   uci add_list dhcp.@dnsmasq[0].address='/ddreport.local/192.168.1.48'
   uci commit dhcp
   /etc/init.d/dnsmasq restart
   ```

---

### pfSense / OPNsense

1. **Services** → **DNS Resolver** → **Host Overrides** → **Add**:
   - Host: `ddreport`
   - Domain: `local`
   - IP Address: `192.168.1.48`
2. **Save** → **Apply Changes**

---

### AIS Fiber / True Online / DTAC (ONU/Router จาก ISP)

Router จาก ISP ส่วนใหญ่ **ไม่รองรับ local DNS**

**แนวทางแก้:**
1. เปิด router อีกตัว (TP-Link, ASUS) ต่อหลัง ONU ในโหมด Router  
   แล้วตั้ง DNS ใน Router ตัวใหม่
2. หรือใช้ **Pi-hole** (ดูด้านล่าง) — วิธีที่แนะนำที่สุด

---

## ✅ วิธีแนะนำ — Pi-hole (ใช้ได้กับ Router ทุกยี่ห้อ)

Pi-hole เป็น DNS server ที่รันบนเครื่องใน LAN รองรับ local DNS ได้ทุก Router

### ติดตั้ง Pi-hole บน Docker (เครื่องเดียวกับ DDReport)

เพิ่มใน `docker-compose.yml`:

```yaml
  pihole:
    image: pihole/pihole:latest
    restart: unless-stopped
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "8080:80"   # Pi-hole web UI
    environment:
      TZ: 'Asia/Bangkok'
      WEBPASSWORD: 'your-pihole-password'
    volumes:
      - pihole_data:/etc/pihole
      - pihole_dnsmasq:/etc/dnsmasq.d
    cap_add:
      - NET_ADMIN
```

เพิ่ม volume:
```yaml
volumes:
  pihole_data:
  pihole_dnsmasq:
```

### ตั้งค่า local DNS ใน Pi-hole

1. เปิด `http://192.168.1.48:8080/admin`
2. **Local DNS** → **DNS Records** → **Add**:
   - Domain: `ddreport.local`
   - IP: `192.168.1.48`

### ตั้ง Router ให้ใช้ Pi-hole เป็น DNS

ใน Router settings → DHCP → DNS Server → ใส่ `192.168.1.48`  
(ทุกอุปกรณ์ใน LAN จะได้รับ DNS จาก Pi-hole อัตโนมัติ)

---

## ติดตั้ง CA cert ในแต่ละอุปกรณ์

ทำครั้งเดียวต่ออุปกรณ์ — ไฟล์ `nginx/certs/rootCA.pem` ต้องส่งไปในแต่ละเครื่อง

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
1. ส่งไฟล์ `rootCA.pem` ด้วย **AirDrop** หรือเปิดลิงก์ใน Safari  
   (สามารถ host ไฟล์ชั่วคราวด้วย `python3 -m http.server 8888` แล้วเปิด `http://192.168.1.48:8888/nginx/certs/rootCA.pem`)
2. ระบบจะถามว่า "ต้องการติดตั้ง profile?" → **Allow** → **Install**
3. ไปที่ **Settings** → **General** → **VPN & Device Management** → เลือก profile → **Install**
4. ไปที่ **Settings** → **General** → **About** → **Certificate Trust Settings**
5. เปิด toggle ของ **DDReport Local CA** → **Continue**

### Android
1. ส่งไฟล์ `rootCA.pem` ไปที่เครื่อง
2. **Settings** → **Security** → **Install from storage**  
   (บางรุ่น: **Biometrics and security** → **Install unknown apps** → **CA Certificate**)
3. เลือกไฟล์ `rootCA.pem` → ตั้งชื่อ `DDReport CA` → **OK**

---

## ทดสอบ

หลังตั้งค่าทั้งหมด ทดสอบจากอุปกรณ์ใน LAN:

```
https://ddreport.local        ← ต้องไม่มีคำเตือน
https://192.168.1.48          ← ต้องไม่มีคำเตือน (cert ครอบคลุม IP ด้วย)
```

หากยังขึ้น "Your connection is not private" → CA cert ยังไม่ได้ติดตั้ง หรือ trust ยังไม่ถูก enable
