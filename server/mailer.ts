import nodemailer from 'nodemailer';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  if (!isEmailConfigured()) {
    throw Object.assign(new Error('Password reset email delivery is not configured.'), { status: 503, code: 'EMAIL_NOT_CONFIGURED' });
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('Password reset email delivery is not configured correctly.'), { status: 503, code: 'EMAIL_NOT_CONFIGURED' });
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const resetUrl = new URL('/reset-password', process.env.CLIENT_ORIGIN || 'http://localhost:5173');
  resetUrl.searchParams.set('token', token);
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Reset your Traverse Elite password',
      text: `A password reset was requested for your account. Use this link within 30 minutes: ${resetUrl.toString()}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>A password reset was requested for your account.</p><p><a href="${resetUrl.toString()}">Reset your password</a> (link expires in 30 minutes).</p><p>If you did not request this, you can ignore this email.</p>`,
    });
  } catch {
    throw Object.assign(new Error('Password reset email could not be sent. Please try again later.'), { status: 503, code: 'EMAIL_DELIVERY_FAILED' });
  } finally {
    transport.close();
  }
}
