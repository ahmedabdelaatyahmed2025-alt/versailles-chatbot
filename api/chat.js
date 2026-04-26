export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, orderNumber } = req.body;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

  let orderInfo = '';
  if (orderNumber && SHOPIFY_TOKEN && SHOPIFY_STORE) {
    try {
      const cleanNumber = orderNumber.replace('#', '');
      const shopRes = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?name=${encodeURIComponent('#' + cleanNumber)}&status=any`,
        { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN, 'Content-Type': 'application/json' } }
      );
      const shopData = await shopRes.json();
      if (shopData.orders && shopData.orders.length > 0) {
        const order = shopData.orders[0];
        const items = order.line_items.map(i => `${i.name} x${i.quantity}`).join(', ');
        orderInfo = `ORDER FOUND - Order: ${order.name}, Status: ${order.fulfillment_status || 'processing'}, Payment: ${order.financial_status}, Total: ${order.total_price} ${order.currency}, Items: ${items}, Tracking: ${order.fulfillments?.[0]?.tracking_number || 'Not yet shipped'}. Use this info naturally.`;
      } else {
        orderInfo = 'ORDER NOT FOUND: Tell the customer politely you could not find that order number.';
      }
    } catch (e) {}
  }

  const systemPrompt = `You are Alex, a customer service representative at Versailles Antique. NEVER say you are an AI. You are a real human team member named Alex. Be friendly and concise. Return policy: 14 days. Domestic shipping: 3-7 days. International: 7-14 days. Email: support@versaillesantique.com ${orderInfo}`;

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, system: systemPrompt, messages })
  });

  const claudeData = await claudeRes.json();
  res.json({ reply: claudeData.content?.[0]?.text || "Sorry, try again!" });
}
