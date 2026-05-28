const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();

const SHOP_DOMAIN = process.env.SHOP_DOMAIN || 'https://butik.nynashamnsgf.se';
const SHOP_EMAIL  = process.env.SHOP_EMAIL  || 'butik@nynashamnsgf.se';

/**
 * Queue an email via the Firebase Trigger Email extension.
 * Writes to /mail collection — the extension picks it up automatically.
 *
 * @param {string} orderId
 * @param {object} order    — order data from Firestore
 * @param {string} to       — recipient address or group alias
 * @param {string} template — new_order | confirmed | shipped | cancelled | dispute
 */
async function queueEmail(orderId, order, to, template) {
  const ref  = `#${orderId.slice(0, 8).toUpperCase()}`;
  const subjects = {
    new_order:  `Ny beställning — ${ref}`,
    confirmed:  `Orderbekräftelse — ${ref}`,
    shipped:    `Din order är på väg — ${ref}`,
    cancelled:  `Order avbruten — ${ref}`,
    dispute:    `⚠️ Tvist öppnad — ${ref}`,
  };

  await admin.firestore().collection('mail').add({
    to,
    message: {
      subject: subjects[template] || `Order ${ref}`,
      html:    buildEmailHtml(template, orderId, order),
    },
  });
}

function buildEmailHtml(template, orderId, order) {
  const ref      = `#${orderId.slice(0, 8).toUpperCase()}`;
  const total    = `${((order.totalAmount || 0) / 100).toFixed(0)} kr`;
  const adminUrl = `${SHOP_DOMAIN}/admin#ordrar/${orderId}`;

  const header = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;color:#0A0A0A;">
    <p style="color:#1B36C9;font-weight:700;font-size:18px;margin:0 0 16px;">NGF Butik</p>`;
  const footer = `
    <hr style="margin-top:28px;border:none;border-top:1px solid #eee;">
    <p style="font-size:12px;color:#888;margin-top:10px;">
      Nynäshamns Gymnastikförening &middot;
      <a href="${SHOP_DOMAIN}" style="color:#1B36C9;">${SHOP_DOMAIN}</a> &middot;
      <a href="mailto:${SHOP_EMAIL}" style="color:#1B36C9;">${SHOP_EMAIL}</a>
    </p>
    </div>`;

  if (template === 'new_order') {
    return `${header}
      <p>En ny beställning har inkommit och väntar på bekräftelse.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;">
        <tr><td style="padding:5px 0;color:#555;width:120px;">Order</td><td><strong>${ref}</strong></td></tr>
        <tr><td style="padding:5px 0;color:#555;">Kund</td><td>${order.customerName || '—'}</td></tr>
        <tr><td style="padding:5px 0;color:#555;">E-post</td><td>${order.customerEmail || '—'}</td></tr>
        <tr><td style="padding:5px 0;color:#555;">Telefon</td><td>${order.customerPhone || '—'}</td></tr>
        <tr><td style="padding:5px 0;color:#555;">Totalt</td><td><strong>${total}</strong></td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="${adminUrl}"
          style="background:#1B36C9;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Öppna i adminpanelen →
        </a>
      </p>
    ${footer}`;
  }

  if (template === 'confirmed') {
    return `${header}
      <p>Din beställning har bekräftats — vi arbetar på den nu.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;">
        <tr><td style="padding:5px 0;color:#555;width:120px;">Order</td><td><strong>${ref}</strong></td></tr>
        <tr><td style="padding:5px 0;color:#555;">Totalt</td><td>${total}</td></tr>
      </table>
      <p style="margin-top:16px;">Du får ett nytt mejl när ordern är klar för upphämtning.</p>
      <p>Frågor? Kontakta oss på
        <a href="mailto:${SHOP_EMAIL}" style="color:#1B36C9;">${SHOP_EMAIL}</a>
      </p>
    ${footer}`;
  }

  if (template === 'shipped') {
    return `${header}
      <p>Din beställning är klar!</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;">
        <tr><td style="padding:5px 0;color:#555;width:120px;">Order</td><td><strong>${ref}</strong></td></tr>
      </table>
      ${order.adminNote
        ? `<p style="margin-top:16px;background:#F4F6FC;padding:12px;border-radius:8px;border-left:3px solid #1B36C9;">${order.adminNote}</p>`
        : ''}
      <p style="margin-top:16px;">Kontakta oss om du har frågor:
        <a href="mailto:${SHOP_EMAIL}" style="color:#1B36C9;">${SHOP_EMAIL}</a>
      </p>
    ${footer}`;
  }

  if (template === 'cancelled') {
    return `${header}
      <p>Din order ${ref} har avbrutits.</p>
      <p>Om betalning har genomförts sker återbetalning inom 3–5 bankdagar.</p>
      <p>Kontakta oss om du har frågor:
        <a href="mailto:${SHOP_EMAIL}" style="color:#1B36C9;">${SHOP_EMAIL}</a>
      </p>
    ${footer}`;
  }

  if (template === 'dispute') {
    return `${header}
      <p>⚠️ En tvist har öppnats på order ${ref}.</p>
      <p><a href="${adminUrl}" style="color:#1B36C9;">Hantera i adminpanelen →</a></p>
    ${footer}`;
  }

  return `${header}<p>Order ${ref} — status uppdaterad.</p>${footer}`;
}

module.exports = { queueEmail, buildEmailHtml };
