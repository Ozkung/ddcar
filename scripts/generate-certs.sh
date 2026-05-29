#!/bin/sh
# Generate TLS certificates for ddreport.local using mkcert inside Docker.
# No local installation of mkcert required — works on Mac and Windows.
#
# Usage:
#   sh scripts/generate-certs.sh
#
# After running, install the CA cert once per machine:
#   Mac:     sudo security add-trusted-cert -d -r trustRoot \
#              -k /Library/Keychains/System.keychain nginx/certs/rootCA.pem
#   Windows: Import-Certificate -FilePath nginx\certs\rootCA.pem \
#              -CertStoreLocation Cert:\LocalMachine\Root

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/../nginx/certs"
mkdir -p "$CERTS_DIR"
CERTS_DIR="$(cd "$CERTS_DIR" && pwd)"

MKCERT_VERSION="v1.4.4"

echo "▶ Generating TLS certificates for ddreport.local via mkcert in Docker..."
echo "  (Certs will be saved to nginx/certs/)"
echo ""

docker run --rm \
  -v "$CERTS_DIR:/certs" \
  -e CAROOT=/certs/ca \
  alpine sh -c "
    set -e

    # Pick the right binary for this CPU architecture
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
      ddreport.local

    # Copy CA cert to top-level for easy access
    cp /certs/ca/rootCA.pem /certs/rootCA.pem
    echo '  Done!'
  "

echo ""
echo "✅ Files created:"
echo "   nginx/certs/ddreport.local.crt  (server certificate)"
echo "   nginx/certs/ddreport.local.key  (private key)"
echo "   nginx/certs/rootCA.pem           (CA cert — install this once per machine)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  ติดตั้ง CA cert เพื่อให้เบราว์เซอร์เชื่อถือ HTTPS (ทำครั้งเดียว):"
echo ""
echo "  Mac (Terminal):"
echo "    sudo security add-trusted-cert -d -r trustRoot \\"
echo "      -k /Library/Keychains/System.keychain nginx/certs/rootCA.pem"
echo ""
echo "  Windows (PowerShell as Administrator):"
echo "    Import-Certificate -FilePath nginx\\certs\\rootCA.pem \\"
echo "      -CertStoreLocation Cert:\\LocalMachine\\Root"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "▶ หลังติดตั้ง CA แล้ว รัน: docker compose up -d"
