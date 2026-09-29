/* Kru Check — OfflineBanner component */
export function offlineBannerHTML(isOffline) {
  if (!isOffline) return '';
  return `
    <div class="offline-banner" data-offline-banner role="status">
      <div><strong>กำลังใช้งานแบบออฟไลน์</strong></div>
      <div>ผลตรวจจะถูกซิงก์เมื่อกลับมาออนไลน์ — ข้อมูลของท่านยังอยู่ครบในเครื่อง</div>
    </div>`;
}
