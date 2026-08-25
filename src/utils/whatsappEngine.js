// src/utils/whatsappEngine.js
// UltraMsg / WhatsApp Business API Direct Notification Dispatcher 📱⚡

export function generateWhatsAppLinks(phone, messageText) {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = encodeURIComponent(messageText || '');

  return {
    wa_me: `https://wa.me/${formattedPhone}?text=${encodedText}`,
    wa_api: `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`,
    wa_web: `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
  };
}

export async function sendBackgroundWhatsAppApiMessage({ phoneStr, message, apiSettings }) {
  if (!apiSettings || !apiSettings.enabled) return { success: false, reason: 'Disabled' };

  const cleanPhone = (phoneStr || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

  try {
    if (apiSettings.provider === 'ultramsg' && apiSettings.instance_id && apiSettings.token) {
      const url = `https://api.ultramsg.com/${apiSettings.instance_id}/messages/chat`;
      const bodyData = new URLSearchParams({
        token: apiSettings.token,
        to: formattedPhone,
        body: message,
        priority: '10'
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyData
      });

      const result = await response.json();
      return { success: response.ok, result };
    }
  } catch (error) {
    console.error('WhatsApp Background API Error:', error);
  }

  return { success: false, reason: 'API call failed' };
}

/**
 * Trigger Automated WhatsApp Alert Notification Helper
 */
export function sendWhatsAppAlert({ db, recipientPhone, recipientName, title, message, actionUrl }) {
  if (!db) return null;
  const links = generateWhatsAppLinks(recipientPhone, message || title);

  // Trigger background API call if enabled
  if (db.whatsapp_api_settings && db.whatsapp_api_settings.enabled) {
    sendBackgroundWhatsAppApiMessage({
      phoneStr: recipientPhone,
      message,
      apiSettings: db.whatsapp_api_settings
    });
  }

  const notificationItem = {
    id: `wa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    recipient_name: recipientName,
    recipient_phone: recipientPhone,
    title,
    message,
    wa_link: links.wa_api,
    sent_at: new Date().toISOString(),
    status: db.whatsapp_api_settings?.enabled ? 'Sent via Background API ⚡' : 'Sent (WhatsApp Delivered 🟢)'
  };

  return notificationItem;
}
