import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../config';

const ses = new SESClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  await ses.send(new SendEmailCommand({
    Source: config.aws.sesFromEmail,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  }));
}

export async function sendInviteEmail(to: string, inviterName: string, token: string) {
  const link = `${config.app.url}/invite/accept?token=${token}`;
  await sendEmail({
    to,
    subject: 'You have been invited to Firmware Hub',
    html: `
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to Firmware Hub.</p>
      <p>Click the link below to set your password and activate your account:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in ${config.app.inviteTokenExpiresHours} hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${config.app.url}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: 'Reset your Firmware Hub password',
    html: `
      <p>Hi,</p>
      <p>You requested a password reset for your Firmware Hub account.</p>
      <p><a href="${link}">Reset Password</a></p>
      <p>This link expires in ${config.app.resetTokenExpiresHours} hours.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}
