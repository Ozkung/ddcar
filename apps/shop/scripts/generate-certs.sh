#!/bin/sh
# Generate TLS certificates for ddreport.local + server LAN IP using mkcert in Docker.
# No local installation of mkcert required — works on Mac and Windows.
#
# Usage:
#   sh scripts/generate-certs.sh [IP_ADDRESS]
#
#   IP_ADDRESS (optional) — LAN IP of the server, e.g. 192.168.1.48
#   If omitted, the script auto-detects the LAN IP.
#
# After running, install the CA cert once per device:
#   Mac:     sudo security add-trusted-cert -d -r trustRoot \
#              -k /Library/Keychains/System.keychain nginx/certs/rootCA.pem
#   Windows: Import-Certificate -FilePath nginx\certs\rootCA.pem \
#              -CertStoreLocation Cert:\LocalMachine\Root
#   iOS/Android: see docs/router-setup.md

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/../nginx/certs"
mkdir -p "$CERTS_DIR"
CERTS_DIR="$(cd "$CERTS_DIR" && pwd)"

MKCERT_VERSION="v1.4.4"

# ── Determine server LAN IP ───────────────────────────────────────────────────
if [ -n "$1" ]; then
  SERVER_IP="$1"
else
  # Auto-detect: prefer en0 (Mac Wi-Fi), fallback to en1, then hostname -I (Linux)
  SERVER_IP=$(ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "")
fi

if [ -z "$SERVER_IP" ]; then
  echo "⚠️  ไม่พบ IP อัตโนมัติ กรุณาระบุ IP: sh scripts/generate-certs.sh 192.168.x.x"
  exit 1
fi

echo "▶ Generating TLS certificates for:"
echo "    Domain : ddreport.local"
echo "    LAN IP : $SERVER_IP"
echo "  (Certs → nginx/certs/)"
echo ""

docker run --rm \
  -v "$CERTS_DIR:/certs" \
  -e CAROOT=/certs/ca \
  alpine sh -c "
    set -e
    ARCH=\$(uname -m)
    if [ \"\$ARCH\" = 'aarch64' ]; then
      MKCERT_ARCH='linux-arm64'
    else
      MKCERT_ARCH='linux-amd64'
    fi
    apk add --no-cache curl ca-certificates > /dev/null 2>&1
    echo '  Downloading mkcert (\$MKCERT_ARCH)...'
    curl -fsSL \
      https://github.com/FiloSottile/mkcert/releases/download/${MKCERT_VERSION}/mkcert-${MKCERT_VERSION}-\${MKCERT_ARCH} \
      -o /usr/local/bin/mkcert
    chmod +x /usr/local/bin/mkcert
    mkdir -p /certs/ca
    mkcert -install > /dev/null 2>&1
    mkcert \
      -key-file  /certs/ddreport.local.key \
      -cert-file /certs/ddreport.local.crt \
      ddreport.local ${SERVER_IP}
    cp /certs/ca/rootCA.pem /certs/rootCA.pem
    echo '  Done!'
  "

echo ""
echo "✅ Files created:"
echo "   nginx/certs/ddreport.local.crt  (covers ddreport.local + $SERVER_IP)"
echo "   nginx/certs/ddreport.local.key  (private key)"
echo "   nginx/certs/rootCA.pem          (CA cert — install once per device)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  ขั้นตอนต่อไป (ทำครั้งเดียวต่ออุปกรณ์):"
echo ""
echo "  1. ตั้งค่า DNS ใน Router ให้ ddreport.local → $SERVER_IP"
echo "     (ดูคู่มือ: docs/router-setup.md)"
echo ""
echo "  2. ติดตั้ง CA cert ในแต่ละอุปกรณ์:"
echo ""
echo "     Mac:"
echo "       sudo security add-trusted-cert -d -r trustRoot \\"
echo "         -k /Library/Keychains/System.keychain nginx/certs/rootCA.pem"
echo ""
echo "     Windows (PowerShell Admin):"
echo "       Import-Certificate -FilePath nginx\\certs\\rootCA.pem \\"
echo "         -CertStoreLocation Cert:\\LocalMachine\\Root"
echo ""
echo "     iOS: ส่งไฟล์ rootCA.pem ไปติดตั้งผ่าน AirDrop / Safari"
echo "     Android: ตั้งค่า → ความปลอดภัย → ติดตั้ง cert"
echo ""
echo "  3. รัน: docker compose up -d --force-recreate nginx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
