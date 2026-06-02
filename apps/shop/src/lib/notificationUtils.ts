export function buildNotificationMessage(
  type: string,
  jobNo: string,
  licensePlate?: string,
  status?: string,
): string {
  if (type === 'job_created') {
    return `งานใหม่ ${jobNo} · ${licensePlate ?? ''}`
  }
  return `สถานะเปลี่ยน ${jobNo} → ${status ?? ''}`
}
