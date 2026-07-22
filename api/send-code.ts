
export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { email, code } = await request.json();

    const apiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;

    if (!apiKey || !emailFrom) {
      // Retorna erro silencioso para o frontend saber que não deve esperar email
      return new Response(JSON.stringify({ error: 'Resend not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: email,
        subject: 'Seu código de verificação VoxGen',
        html: `
          <div style="font-family: sans-serif; font-size: 16px; color: #333;">
            <p>Olá! Use o código abaixo para acessar o VoxGen AI Studio:</p>
            <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h2 style="color: #4f46e5; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h2>
            </div>
            <p style="color: #666; font-size: 14px;">Este código expira em 10 minutos.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to send email');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Email API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
